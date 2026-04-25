require("dotenv").config();

const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(
    `❌ Missing required environment variables: ${missingEnv.join(", ")}. ` +
      `See server/.env.example.`
  );
  process.exit(1);
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.JWT_SECRET.length < 32
) {
  console.error(
    "❌ JWT_SECRET must be at least 32 characters in production. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
  );
  process.exit(1);
}

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

// ✅ CORS — restrict to configured client origin(s)
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // allow same-origin / non-browser tools (no Origin header)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

// ✅ middleware
app.use(cors(corsOptions));
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
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
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

  const getConnectedPartnerId = () => findPartner(socket.id);
  const canTargetConnectedPartner = (targetSocketId) => (
    Boolean(targetSocketId) && getConnectedPartnerId() === targetSocketId
  );

  // ===============================
  // Find random match
  // ===============================
  socket.on("find_match", () => {
    console.log("🔎 Finding match for:", socket.id);
    socket.emit("room_state", { state: "searching" });

    addToQueue(socket.id);

    const pair = getMatchPair();

    if (pair) {
      const [user1, user2] = pair;
      const roomId = uuidv4();

      createRoom(roomId, user1, user2);

      io.to(user1).emit("matched", { roomId, partnerId: user2 });
      io.to(user2).emit("matched", { roomId, partnerId: user1 });
      io.to(user1).emit("room_state", { state: "connected", roomId, partnerId: user2 });
      io.to(user2).emit("room_state", { state: "connected", roomId, partnerId: user1 });

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

    socket.emit("room_state", { state: "ended", reason: "self_skipped" });

    if (partnerId) {
      io.to(partnerId).emit("partner_skipped");
      io.to(partnerId).emit("room_state", { state: "ended", reason: "partner_skipped" });
    }

    console.log("⏭️ User skipped:", socket.id);
  });


      // ===============================
    // WebRTC Offer
    // ===============================
    socket.on("webrtc_offer", ({ to, offer }) => {
      if (!canTargetConnectedPartner(to) || !offer) {
        return;
      }

      io.to(to).emit("webrtc_offer", {
        from: socket.id,
        offer,
      });
    });

    // ===============================
    // WebRTC Answer
    // ===============================
    socket.on("webrtc_answer", ({ to, answer }) => {
      if (!canTargetConnectedPartner(to) || !answer) {
        return;
      }

      io.to(to).emit("webrtc_answer", {
        from: socket.id,
        answer,
      });
    });

    // ===============================
    // ICE Candidate
    // ===============================
    socket.on("webrtc_ice_candidate", ({ to, candidate }) => {
      if (!canTargetConnectedPartner(to) || !candidate) {
        return;
      }

      io.to(to).emit("webrtc_ice_candidate", {
        from: socket.id,
        candidate,
      });
    });

    // ===============================
    // Call End
    // ===============================
    socket.on("call_end", ({ to }) => {
      const partnerId = canTargetConnectedPartner(to) ? to : getConnectedPartnerId();
      if (!partnerId) {
        return;
      }

      io.to(partnerId).emit("call_end");
      io.to(partnerId).emit("room_state", { state: "ended", reason: "partner_ended" });
      socket.emit("room_state", { state: "ended", reason: "self_ended" });
    });

    // ===============================
    // Text message relay
    // ===============================
    socket.on("chat_message", ({ to, text }) => {
      const safeText = String(text || "").trim();
      const partnerId = canTargetConnectedPartner(to) ? to : getConnectedPartnerId();

      if (!partnerId || !safeText) {
        return;
      }

      io.to(partnerId).emit("chat_message", {
        from: socket.id,
        text: safeText,
        sentAt: Date.now(),
      });
    });

    socket.on("chat_typing", ({ to }) => {
      const partnerId = canTargetConnectedPartner(to) ? to : getConnectedPartnerId();

      if (!partnerId) {
        return;
      }

      io.to(partnerId).emit("chat_typing", { from: socket.id });
    });

    socket.on("chat_stop_typing", ({ to }) => {
      const partnerId = canTargetConnectedPartner(to) ? to : getConnectedPartnerId();

      if (!partnerId) {
        return;
      }

      io.to(partnerId).emit("chat_stop_typing", { from: socket.id });
    });

    // ===============================
    // Game events relay
    // ===============================
    socket.on("game_dice_roll", ({ to, roll }) => {
      const partnerId = canTargetConnectedPartner(to) ? to : getConnectedPartnerId();

      if (!partnerId || typeof roll !== "number") {
        return;
      }

      io.to(partnerId).emit("game_dice_roll", {
        from: socket.id,
        roll,
      });
    });

    socket.on("game_rps_move", ({ to, choice }) => {
      const partnerId = canTargetConnectedPartner(to) ? to : getConnectedPartnerId();

      if (!partnerId || !choice) {
        return;
      }

      io.to(partnerId).emit("game_rps_move", {
        from: socket.id,
        choice,
      });
    });

    socket.on("game_quiz_answer", ({ to, optionIndex, isCorrect }) => {
      const partnerId = canTargetConnectedPartner(to) ? to : getConnectedPartnerId();

      if (!partnerId || typeof optionIndex !== "number") {
        return;
      }

      io.to(partnerId).emit("game_quiz_answer", {
        from: socket.id,
        optionIndex,
        isCorrect,
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
      io.to(partnerId).emit("room_state", { state: "ended", reason: "partner_disconnected" });
    }
  });
});
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 LetzTalk server running on port ${PORT}`);
});