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

// ✅ routes
app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);

// ✅ socket setup (MUST be before io.on)
const io = new Server(server, {
  cors: { origin: "*" },
});

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
  // Disconnect
  // ===============================
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    removeFromQueue(socket.id);

    const partnerId = findPartner(socket.id);
    removeRoomByUser(socket.id);

    if (partnerId) {
      io.to(partnerId).emit("partner_disconnected");
    }
  });
});
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 LetzTalk server running on port ${PORT}`);
});