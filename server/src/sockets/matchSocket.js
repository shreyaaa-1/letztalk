const {
  addToQueue,
  removeFromQueue,
  getMatchPair,
  createRoom,
  findPartner,
  removeRoomByUser,
} = require("../services/matchService");

const registerMatchSocket = (io, socket) => {
  console.log("🟢 Matching ready for:", socket.id);

  // 🔍 User searching
  socket.on("find-stranger", () => {
    console.log("🔍 User searching:", socket.id);

    addToQueue(socket.id);

    const pair = getMatchPair();

    if (pair) {
      const [user1, user2] = pair;

      const roomId = `room_${user1.slice(0, 5)}_${user2.slice(0, 5)}`;

      createRoom(roomId, user1, user2);

      io.to(user1).emit("match-found", { roomId });
      io.to(user2).emit("match-found", { roomId });

      console.log("✅ Match created:", roomId);
    }
  });

  // ⏭️ Skip stranger
  socket.on("skip-stranger", () => {
    const partnerId = findPartner(socket.id);

    if (partnerId) {
      io.to(partnerId).emit("partner-disconnected");
    }

    removeRoomByUser(socket.id);
    removeFromQueue(socket.id);

    console.log("⏭️ User skipped:", socket.id);
  });

  // ❌ Disconnect
  socket.on("disconnect", () => {
    const partnerId = findPartner(socket.id);

    if (partnerId) {
      io.to(partnerId).emit("partner-disconnected");
    }

    removeRoomByUser(socket.id);
    removeFromQueue(socket.id);

    console.log("❌ Cleaned user:", socket.id);
  });
};

module.exports = registerMatchSocket;