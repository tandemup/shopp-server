require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const pool = require("./db");

const app = express();

const PORT = process.env.PORT || 3000;

const DEFAULT_ROOM = "general";
const DEFAULT_USER_NAME = "Usuario";

const DEFAULT_CLIENT_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
  "http://localhost:3000",
  "http://localhost:3001",
  "https://ramworks.netlify.app",
];

const ENV_CLIENT_ORIGINS = String(process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const CLIENT_ORIGINS =
  ENV_CLIENT_ORIGINS.length > 0 ? ENV_CLIENT_ORIGINS : DEFAULT_CLIENT_ORIGINS;

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (CLIENT_ORIGINS.includes(origin)) {
    return true;
  }

  if (/^http:\/\/localhost:\d+$/.test(origin)) {
    return true;
  }

  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
    return true;
  }

  if (/^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)) {
    return true;
  }

  if (/^http:\/\/10\.\d+\.\d+\.\d+:\d+$/.test(origin)) {
    return true;
  }

  if (/^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+:\d+$/.test(origin)) {
    return true;
  }

  return false;
}

function normalizeText(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeRoom(value) {
  return normalizeText(value, DEFAULT_ROOM)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

function normalizeUserName(value) {
  return normalizeText(value, DEFAULT_USER_NAME).slice(0, 40);
}

function normalizeLimit(value, fallback = 50) {
  const limit = Number.parseInt(value, 10);

  if (Number.isNaN(limit)) {
    return fallback;
  }

  return Math.min(Math.max(limit, 1), 200);
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  methods: ["GET", "POST"],
};

app.use(cors(corsOptions));
app.use(express.json());

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      room TEXT NOT NULL,
      user_name TEXT NOT NULL,
      text TEXT NOT NULL,
      socket_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created_at
    ON chat_messages (room, created_at DESC);
  `);
}

async function saveMessage(message) {
  const result = await pool.query(
    `
    INSERT INTO chat_messages (
      id,
      room,
      user_name,
      text,
      socket_id,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      room,
      user_name AS "userName",
      text,
      socket_id AS "socketId",
      created_at AS "createdAt";
    `,
    [
      message.id,
      message.room,
      message.userName,
      message.text,
      message.socketId,
      message.createdAt,
    ],
  );

  return result.rows[0];
}

async function getRecentMessages(room, limit = 50) {
  const result = await pool.query(
    `
    SELECT
      id,
      room,
      user_name AS "userName",
      text,
      socket_id AS "socketId",
      created_at AS "createdAt"
    FROM chat_messages
    WHERE room = $1
    ORDER BY created_at DESC
    LIMIT $2;
    `,
    [room, limit],
  );

  return result.rows.reverse();
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Shopp chat server",
    port: PORT,
    socket: true,
    database: true,
  });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      service: "Shopp chat server",
      port: PORT,
      database: "connected",
      allowedOrigins: CLIENT_ORIGINS,
    });
  } catch (error) {
    console.error("Error comprobando PostgreSQL:", error);

    res.status(500).json({
      ok: false,
      service: "Shopp chat server",
      port: PORT,
      database: "error",
      message: error.message,
    });
  }
});

app.get("/api/chat/messages", async (req, res) => {
  try {
    const room = normalizeRoom(req.query.room);
    const limit = normalizeLimit(req.query.limit);

    const messages = await getRecentMessages(room, limit);

    res.json({
      ok: true,
      room,
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error("Error recuperando mensajes:", error);

    res.status(500).json({
      ok: false,
      message: "No se pudieron recuperar los mensajes",
    });
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: corsOptions,
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.data.room = DEFAULT_ROOM;
  socket.data.userName = DEFAULT_USER_NAME;

  socket.join(DEFAULT_ROOM);

  socket.emit("server:ready", {
    message: "Conectado al servidor de chat de Shopp",
    socketId: socket.id,
    room: socket.data.room,
    userName: socket.data.userName,
  });

  socket.on("chat:join", async (payload = {}) => {
    try {
      const previousRoom = socket.data.room || DEFAULT_ROOM;

      const room = normalizeRoom(payload.room);
      const userName = normalizeUserName(payload.userName || payload.user);

      if (previousRoom !== room) {
        socket.leave(previousRoom);
      }

      socket.join(room);

      socket.data.room = room;
      socket.data.userName = userName;

      const messages = await getRecentMessages(room, 50);

      socket.emit("chat:joined", {
        room,
        userName,
        socketId: socket.id,
        messages,
      });

      socket.to(room).emit("chat:userJoined", {
        room,
        userName,
        socketId: socket.id,
        createdAt: new Date().toISOString(),
      });

      console.log(`Usuario ${userName} entró en room ${room}:`, socket.id);
    } catch (error) {
      console.error("Error en chat:join:", error);

      socket.emit("chat:error", {
        message: "No se pudo entrar en la sala de chat",
      });
    }
  });

  socket.on("chat:message", async (payload = {}) => {
    try {
      const room = normalizeRoom(payload.room || socket.data.room);
      const userName = normalizeUserName(
        payload.userName || payload.user || socket.data.userName,
      );

      const text = String(payload.text || "").trim();

      if (!text) {
        socket.emit("chat:error", {
          message: "No se puede enviar un mensaje vacío",
        });
        return;
      }

      socket.data.room = room;
      socket.data.userName = userName;

      if (!socket.rooms.has(room)) {
        socket.join(room);
      }

      const message = {
        id: payload.id || `${Date.now()}-${socket.id}`,
        room,
        text,
        userName,
        createdAt: new Date().toISOString(),
        socketId: socket.id,
      };

      const savedMessage = await saveMessage(message);

      io.to(room).emit("chat:message", savedMessage);
    } catch (error) {
      console.error("Error guardando mensaje:", error);

      socket.emit("chat:error", {
        message: "No se pudo guardar el mensaje",
      });
    }
  });

  socket.on("chat:typing", (payload = {}) => {
    const room = normalizeRoom(payload.room || socket.data.room);
    const userName = normalizeUserName(
      payload.userName || payload.user || socket.data.userName,
    );

    socket.to(room).emit("chat:typing", {
      room,
      userName,
      socketId: socket.id,
      isTyping: Boolean(payload.isTyping),
    });
  });

  socket.on("disconnect", (reason) => {
    const room = socket.data.room || DEFAULT_ROOM;
    const userName = socket.data.userName || DEFAULT_USER_NAME;

    socket.to(room).emit("chat:userLeft", {
      room,
      userName,
      socketId: socket.id,
      reason,
      createdAt: new Date().toISOString(),
    });

    console.log("Usuario desconectado:", socket.id, reason);
  });
});

initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Shopp chat server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("No se pudo inicializar PostgreSQL:", error);
    process.exit(1);
  });
