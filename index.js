const http = require("http");

const server = http.createServer();

const io = require("socket.io")(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("Se ha conectado un cliente:", socket.id);

  socket.emit("chat:system", {
    user: "Sistema",
    text: "Conectado al servidor socket de Shopp",
    createdAt: new Date().toISOString(),
  });

  socket.on("chat:message", (message) => {
    console.log("Mensaje recibido:", message);

    io.emit("chat:message", {
      id: `${socket.id}-${Date.now()}`,
      user: message?.user || "Usuario",
      text: message?.text || "",
      createdAt: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    console.log("Se ha desconectado un cliente:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Servidor socket escuchando en http://localhost:3000");
});
