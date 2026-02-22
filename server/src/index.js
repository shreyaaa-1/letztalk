require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const registerMatchSocket = require("./sockets/matchSocket");
const healthRoutes = require("./routes/healthRoutes");

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

// ✅ socket setup (MUST be before io.on)
const io = new Server(server, {
  cors: { origin: "*" },
});

// ✅ socket connection handler
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);
  registerMatchSocket(io, socket);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 LetzTalk server running on port ${PORT}`);
});