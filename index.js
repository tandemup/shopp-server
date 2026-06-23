require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { query, initDb } = require("./db");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------

const allowedOrigins = (
  process.env.CLIENT_ORIGIN ||
  process.env.CLIENT_URL ||
  ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Permite Thunder Client, Postman, curl, health checks, etc.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS bloqueado para origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));

// NO uses esto con Express/router actual:
// app.options("*", cors(corsOptions));

app.use(express.json());

// -----------------------------------------------------------------------------
// Socket.io
// -----------------------------------------------------------------------------

const io = new Server(server, {
  cors: corsOptions,
});

io.on("connection", (socket) => {
  console.log("Socket conectado:", socket.id);

  socket.on("joinRoom", (room = "general") => {
    socket.join(room);
    console.log(`Socket ${socket.id} unido a sala: ${room}`);
  });

  socket.on("leaveRoom", (room = "general") => {
    socket.leave(room);
    console.log(`Socket ${socket.id} salió de sala: ${room}`);
  });

  socket.on("chatMessage", async (payload = {}) => {
    try {
      const room = payload.room || "general";
      const username = payload.username || "anonymous";
      const text = String(payload.text || "").trim();

      if (!text) {
        return;
      }

      const result = await query(
        `
        INSERT INTO chat_messages (room, username, text)
        VALUES ($1, $2, $3)
        RETURNING
          id,
          room,
          username,
          text,
          created_at AS "createdAt";
        `,
        [room, username, text],
      );

      const savedMessage = result.rows[0];

      io.to(room).emit("chatMessage", savedMessage);
    } catch (error) {
      console.error("Error guardando mensaje de chat:", error);

      socket.emit("chatError", {
        message: "No se pudo guardar el mensaje",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket desconectado:", socket.id);
  });
});

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "shopp-server",
    allowedOrigins,
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
  });
});

app.get("/api/messages", async (req, res) => {
  try {
    const room = req.query.room || "general";
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const result = await query(
      `
      SELECT
        id,
        room,
        username,
        text,
        created_at AS "createdAt"
      FROM chat_messages
      WHERE room = $1
      ORDER BY created_at ASC
      LIMIT $2;
      `,
      [room, limit],
    );

    res.json({
      ok: true,
      room,
      messages: result.rows,
    });
  } catch (error) {
    console.error("Error obteniendo mensajes:", error);

    res.status(500).json({
      ok: false,
      error: "No se pudieron obtener los mensajes",
    });
  }
});

app.post("/api/messages", async (req, res) => {
  try {
    const room = req.body.room || "general";
    const username = req.body.username || "anonymous";
    const text = String(req.body.text || "").trim();

    if (!text) {
      return res.status(400).json({
        ok: false,
        error: "El mensaje no puede estar vacío",
      });
    }

    const result = await query(
      `
      INSERT INTO chat_messages (room, username, text)
      VALUES ($1, $2, $3)
      RETURNING
        id,
        room,
        username,
        text,
        created_at AS "createdAt";
      `,
      [room, username, text],
    );

    const savedMessage = result.rows[0];

    io.to(room).emit("chatMessage", savedMessage);

    res.status(201).json({
      ok: true,
      message: savedMessage,
    });
  } catch (error) {
    console.error("Error creando mensaje:", error);

    res.status(500).json({
      ok: false,
      error: "No se pudo crear el mensaje",
    });
  }
});

// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
      console.log("CLIENT_ORIGIN:", allowedOrigins);
    });
  })
  .catch((error) => {
    console.error("Error inicializando la base de datos:", error);
    process.exit(1);
  });
