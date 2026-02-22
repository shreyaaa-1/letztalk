require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const healthRoutes = require("./routes/healthRoutes");
const userRoutes = require("./routes/userRoutes");
const { v4: uuidv4 } = require("uuid");
const apiLimiter = require("./middleware/rateLimiter");
const moderationRoutes = require("./routes/moderationRoutes");
const blockRoutes = require("./routes/blockRoutes");

const {
  addToQueue,
  removeFromQueue,
  getMatchPair,
  createRoom,
  findPartner,
  removeRoomByUser,
} = require("./services/matchService");

const app = express();
const server = http.createServer(app);

// ✅ connect DB
connectDB();

// ✅ middleware
app.use(cors());
app.use(express.json());
app.use(apiLimiter);

// ✅ routes
app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/mod", moderationRoutes);
app.use("/api/mod", blockRoutes);

// ✅ socket setup (MUST be before io.on)
const io = new Server(server, {
  cors: { origin: "*" },
});

const socialRooms = new Map();
const socketToSocialRoom = new Map();

const generateRoomCode = () => {
  let code = "";
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (socialRooms.has(code));
  return code;
};

const serializeRoom = (room) => ({
  code: room.code,
  name: room.name,
  hostId: room.hostId,
  members: Array.from(room.members.values()),
});

const leaveSocialRoom = (socketId) => {
  const roomCode = socketToSocialRoom.get(socketId);
  if (!roomCode) {
    return;
  }

  const room = socialRooms.get(roomCode);
  socketToSocialRoom.delete(socketId);

  if (!room) {
    return;
  }

  room.members.delete(socketId);

  if (room.members.size === 0) {
    socialRooms.delete(roomCode);
    return;
  }

  if (room.hostId === socketId) {
    const [nextHostId] = room.members.keys();
    room.hostId = nextHostId;
  }

  io.to(roomCode).emit("room_updated", { room: serializeRoom(room) });
};

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  // ===============================
  // Find random match
  // ===============================
  socket.on("find_match", () => {
    console.log("🔎 Finding match for:", socket.id);

    addToQueue(socket.id);

    const pair = getMatchPair();

    if (pair) {
      const [user1, user2] = pair;
      const roomId = uuidv4();

      createRoom(roomId, user1, user2);

      io.to(user1).emit("matched", { roomId, partnerId: user2 });
      io.to(user2).emit("matched", { roomId, partnerId: user1 });

      console.log("✅ Match created:", roomId);
    }
  });

  // ===============================
  // Skip user
  // ===============================
  socket.on("skip", () => {
    removeFromQueue(socket.id);

    const partnerId = findPartner(socket.id);
    removeRoomByUser(socket.id);

    if (partnerId) {
      io.to(partnerId).emit("partner_skipped");
    }

    console.log("⏭️ User skipped:", socket.id);
  });


      // ===============================
    // WebRTC Offer
    // ===============================
    socket.on("webrtc_offer", ({ to, offer }) => {
      io.to(to).emit("webrtc_offer", {
        from: socket.id,
        offer,
      });
    });

    // ===============================
    // WebRTC Answer
    // ===============================
    socket.on("webrtc_answer", ({ to, answer }) => {
      io.to(to).emit("webrtc_answer", {
        from: socket.id,
        answer,
      });
    });

    // ===============================
    // ICE Candidate
    // ===============================
    socket.on("webrtc_ice_candidate", ({ to, candidate }) => {
      io.to(to).emit("webrtc_ice_candidate", {
        from: socket.id,
        candidate,
      });
    });

    // ===============================
    // Call End
    // ===============================
    socket.on("call_end", ({ to }) => {
      io.to(to).emit("call_end");
    });

    // ===============================
    // Text message relay
    // ===============================
    socket.on("chat_message", ({ to, text }) => {
      const safeText = String(text || "").trim();
      if (!to || !safeText) {
        return;
      }

      io.to(to).emit("chat_message", {
        from: socket.id,
        text: safeText,
        sentAt: Date.now(),
      });
    });

    // ===============================
    // Rooms: create/join/leave/message
    // ===============================
    socket.on("create_room", ({ roomName, displayName }) => {
      leaveSocialRoom(socket.id);

      const code = generateRoomCode();
      const name = String(roomName || "Room").trim() || "Room";
      const memberName = String(displayName || "Guest").trim() || "Guest";

      const room = {
        code,
        name,
        hostId: socket.id,
        members: new Map([[socket.id, memberName]]),
      };

      socialRooms.set(code, room);
      socketToSocialRoom.set(socket.id, code);
      socket.join(code);

      socket.emit("room_joined", { room: serializeRoom(room) });
    });

    socket.on("join_room", ({ roomCode, displayName }) => {
      const code = String(roomCode || "").trim().toUpperCase();
      if (!code) {
        socket.emit("room_error", { message: "Enter a room code." });
        return;
      }

      const room = socialRooms.get(code);
      if (!room) {
        socket.emit("room_error", { message: "Room not found." });
        return;
      }

      leaveSocialRoom(socket.id);

      const memberName = String(displayName || "Guest").trim() || "Guest";
      room.members.set(socket.id, memberName);
      socketToSocialRoom.set(socket.id, code);
      socket.join(code);

      const payload = { room: serializeRoom(room) };
      socket.emit("room_joined", payload);
      io.to(code).emit("room_updated", payload);
    });

    socket.on("leave_room", () => {
      const roomCode = socketToSocialRoom.get(socket.id);
      if (!roomCode) {
        return;
      }

      socket.leave(roomCode);
      leaveSocialRoom(socket.id);
    });

    socket.on("room_message", ({ text }) => {
      const roomCode = socketToSocialRoom.get(socket.id);
      const room = roomCode ? socialRooms.get(roomCode) : null;
      const safeText = String(text || "").trim();

      if (!roomCode || !room || !safeText) {
        return;
      }

      io.to(roomCode).emit("room_message", {
        senderName: room.members.get(socket.id) || "Guest",
        text: safeText,
        sentAt: Date.now(),
      });
    });



  // ===============================
  // Disconnect
  // ===============================
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    removeFromQueue(socket.id);

    const partnerId = findPartner(socket.id);
    removeRoomByUser(socket.id);

    const socialRoomCode = socketToSocialRoom.get(socket.id);
    if (socialRoomCode) {
      socket.leave(socialRoomCode);
      leaveSocialRoom(socket.id);
    }

    if (partnerId) {
      io.to(partnerId).emit("partner_disconnected");
    }
  });
});
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 LetzTalk server running on port ${PORT}`);
});