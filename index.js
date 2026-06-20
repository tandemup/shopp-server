const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

const PORT = process.env.PORT || 3000;

const CLIENT_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
  "http://localhost:3000",
  "https://ramworks.netlify.app",
];

app.use(
  cors({
    origin: CLIENT_ORIGINS,
    methods: ["GET", "POST"],
  }),
);

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Shopp chat server",
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.emit("server:ready", {
    message: "Conectado al servidor de chat de Shopp",
    socketId: socket.id,
  });

  socket.on("chat:join", ({ room }) => {
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

  socket.on("chat:message", (payload) => {
    const room = payload?.room || "general";

    const message = {
      id: payload?.id || `${Date.now()}-${socket.id}`,
      room,
      text: String(payload?.text || ""),
      userName: payload?.userName || "Usuario",
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
