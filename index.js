const pool = require("./db");

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ room, username }) => {
    socket.join(room);
  });

  socket.on("chatMessage", async ({ room, username, message }) => {
    const result = await pool.query(
      `INSERT INTO chat_messages (room, username, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [room, username, message],
    );

    io.to(room).emit("chatMessage", result.rows[0]);
  });
});
