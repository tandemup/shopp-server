require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:19006";

const app = express();

app.use(
  cors({
    origin: CLIENT_ORIGIN,
  }),
);

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Shopp chat server",
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.emit("chat:system", {
    id: `system-${Date.now()}`,
    user: "Sistema",
    text: "Conectado al chat de Shopp",
    createdAt: new Date().toISOString(),
  });

  socket.on("chat:message", (message) => {
    const payload = {
      id: `${Date.now()}-${socket.id}`,
      user: message.user || "Shopp user",
      text: message.text,
      createdAt: new Date().toISOString(),
    };

    io.emit("chat:message", payload);
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
