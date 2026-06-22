// index.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { query, initDb } = require("./db");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  "http://localhost:8081",
  "http://localhost:19006",
  "https://shopp.netlify.app",
  process.env.CLIENT_URL,
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Permite peticiones sin origin, por ejemplo Postman, curl o algunas apps nativas.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS bloqueado para origin: ${origin}`));
  },
  methods: ["GET", "POST"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(server, {
  cors: corsOptions,
});

// --------------------------------------------------
// Health check
// --------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "shopp-server",
    message: "Socket chat API funcionando",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const result = await query("SELECT NOW() AS now");
    res.json({
      ok: true,
      database: true,
      now: result.rows[0].now,
    });
  } catch (error) {
    console.error("DB health error:", error);
    res.status(500).json({
      ok: false,
      database: false,
      error: "Database error",
    });
  }
});

// --------------------------------------------------
// API REST: obtener mensajes de una room
// --------------------------------------------------
app.get("/api/chat/:room/messages", async (req, res) => {
  try {
    const { room } = req.params;
    const limit = Math.min(Number(req.query.limit || 50), 100);

    const result = await query(
      `
      SELECT id, room, username, message, created_at
      FROM chat_messages
      WHERE room = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [room, limit],
    );

    res.json({
      ok: true,
      messages: result.rows.reverse(),
    });
  } catch (error) {
    console.error("GET messages error:", error);
    res.status(500).json({
      ok: false,
      error: "Error obteniendo mensajes",
    });
  }
});

// --------------------------------------------------
// API REST: crear mensaje sin socket
// --------------------------------------------------
app.post("/api/chat/:room/messages", async (req, res) => {
  try {
    const { room } = req.params;
    const { username, message } = req.body;

    if (!username || !message) {
      return res.status(400).json({
        ok: false,
        error: "Faltan username o message",
      });
    }

    const result = await query(
      `
      INSERT INTO chat_messages (room, username, message)
      VALUES ($1, $2, $3)
      RETURNING id, room, username, message, created_at
      `,
      [room, username, message],
    );

    const savedMessage = result.rows[0];

    io.to(room).emit("chat:message", savedMessage);

    res.status(201).json({
      ok: true,
      message: savedMessage,
    });
  } catch (error) {
    console.error("POST message error:", error);
    res.status(500).json({
      ok: false,
      error: "Error guardando mensaje",
    });
  }
});

// --------------------------------------------------
// Socket.IO
// --------------------------------------------------
io.on("connection", (socket) => {
  console.log("Socket conectado:", socket.id);

  socket.on("chat:join", async ({ room, username }) => {
    if (!room || !username) {
      socket.emit("chat:error", {
        error: "Faltan room o username",
      });
      return;
    }

    socket.join(room);

    socket.emit("chat:joined", {
      room,
      username,
      socketId: socket.id,
    });

    try {
      const result = await query(
        `
        SELECT id, room, username, message, created_at
        FROM chat_messages
        WHERE room = $1
        ORDER BY created_at DESC
        LIMIT 50
        `,
        [room],
      );

      socket.emit("chat:history", result.rows.reverse());
    } catch (error) {
      console.error("chat:join history error:", error);
      socket.emit("chat:error", {
        error: "Error cargando historial",
      });
    }
  });

  socket.on("chat:message", async ({ room, username, message }) => {
    if (!room || !username || !message) {
      socket.emit("chat:error", {
        error: "Faltan room, username o message",
      });
      return;
    }

    try {
      const result = await query(
        `
        INSERT INTO chat_messages (room, username, message)
        VALUES ($1, $2, $3)
        RETURNING id, room, username, message, created_at
        `,
        [room, username, message],
      );

      const savedMessage = result.rows[0];

      io.to(room).emit("chat:message", savedMessage);
    } catch (error) {
      console.error("chat:message error:", error);
      socket.emit("chat:error", {
        error: "Error guardando mensaje",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket desconectado:", socket.id);
  });
});

// --------------------------------------------------
// Arranque
// --------------------------------------------------
async function start() {
  try {
    await initDb();

    server.listen(PORT, () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("Error iniciando servidor:", error);
    process.exit(1);
  }
}

start();
