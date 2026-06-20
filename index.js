const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

const PORT = process.env.PORT || 3000;

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

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Shopp chat server",
    port: PORT,
    allowedOrigins: CLIENT_ORIGINS,
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: corsOptions,
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.emit("server:ready", {
    message: "Conectado al servidor de chat de Shopp",
    socketId: socket.id,
  });

  socket.on("chat:join", ({ room } = {}) => {
    const safeRoom = room || "general";

    socket.join(safeRoom);

    socket.emit("chat:joined", {
      room: safeRoom,
    });

    socket.to(safeRoom).emit("chat:userJoined", {
      socketId: socket.id,
      room: safeRoom,
    });
  });

  socket.on("chat:message", (payload = {}) => {
    const room = payload.room || "general";
    const text = String(payload.text || "").trim();

    if (!text) {
      socket.emit("chat:error", {
        message: "No se puede enviar un mensaje vacío",
      });
      return;
    }

    const message = {
      id: payload.id || `${Date.now()}-${socket.id}`,
      room,
      text,
      userName: payload.userName || "Usuario",
      createdAt: new Date().toISOString(),
      socketId: socket.id,
    };

    io.to(room).emit("chat:message", message);
  });

  socket.on("disconnect", (reason) => {
    console.log("Usuario desconectado:", socket.id, reason);
  });
});

server.listen(PORT, () => {
  console.log(`Shopp chat server listening on port ${PORT}`);
});
