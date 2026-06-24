import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

import { query, initDb } from "./db.js";

dotenv.config();

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3000;

/**
 * CLIENT_ORIGIN puede tener una o varias URLs separadas por coma:
 *
 * CLIENT_ORIGIN=http://localhost:8081,https://ramworks.netlify.app
 *
 * También se acepta CLIENT_URL como compatibilidad anterior.
 */
function getAllowedOrigins() {
  const rawOrigins = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || "";

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

function isOriginAllowed(origin) {
  // Permite llamadas sin origin, por ejemplo curl, Thunder Client o health checks.
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(server, {
  cors: corsOptions,
});

/**
 * Ruta de prueba.
 */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    name: "shopp-server",
    allowedOrigins,
  });
});

/**
 * Health check.
 */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "running",
  });
});

/**
 * Obtener mensajes de una sala.
 *
 * Ejemplo:
 * GET /api/messages?room=general
 */
app.get("/api/messages", async (req, res) => {
  try {
    const room = String(req.query.room || "general").trim() || "general";

    const result = await query(
      `
      SELECT id, room, username, text, created_at
      FROM chat_messages
      WHERE room = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [room],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo mensajes:", error);
    res.status(500).json({
      ok: false,
      error: "No se pudieron obtener los mensajes",
    });
  }
});

/**
 * Crear mensaje por API REST.
 * Opcional, pero útil para pruebas con Thunder Client.
 *
 * POST /api/messages
 *
 * Body:
 * {
 *   "room": "general",
 *   "username": "Josh",
 *   "text": "Hola"
 * }
 */
app.post("/api/messages", async (req, res) => {
  try {
    const room = String(req.body.room || "general").trim() || "general";
    const username =
      String(req.body.username || "anonymous").trim() || "anonymous";
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
      RETURNING id, room, username, text, created_at
      `,
      [room, username, text],
    );

    const message = result.rows[0];

    io.to(room).emit("chat:message", message);

    res.status(201).json(message);
  } catch (error) {
    console.error("Error creando mensaje:", error);
    res.status(500).json({
      ok: false,
      error: "No se pudo crear el mensaje",
    });
  }
});

/**
 * Socket.IO chat.
 */
io.on("connection", (socket) => {
  console.log("Socket conectado:", socket.id);

  socket.on("chat:join", (payload = {}) => {
    const room = String(payload.room || "general").trim() || "general";
    const username =
      String(payload.username || "anonymous").trim() || "anonymous";

    socket.data.room = room;
    socket.data.username = username;

    socket.join(room);

    console.log(`${username} entró en la sala ${room}`);
  });

  socket.on("chat:message", async (payload = {}) => {
    try {
      const room =
        String(payload.room || socket.data.room || "general").trim() ||
        "general";

      const username =
        String(
          payload.username || socket.data.username || "anonymous",
        ).trim() || "anonymous";

      const text = String(payload.text || "").trim();

      if (!text) {
        return;
      }

      const result = await query(
        `
        INSERT INTO chat_messages (room, username, text)
        VALUES ($1, $2, $3)
        RETURNING id, room, username, text, created_at
        `,
        [room, username, text],
      );

      const message = result.rows[0];

      io.to(room).emit("chat:message", message);
    } catch (error) {
      console.error("Error guardando mensaje de socket:", error);

      socket.emit("chat:error", {
        error: "No se pudo guardar el mensaje",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket desconectado:", socket.id);
  });
});

async function startServer() {
  try {
    await initDb();

    server.listen(PORT, () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
      console.log("Allowed origins:", allowedOrigins);
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor:", error);
    process.exit(1);
  }
}

startServer();
