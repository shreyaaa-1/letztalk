const waitingQueue = [];
const activeRooms = new Map();

// ===============================
// add user to queue
// ===============================
const addToQueue = (socketId) => {
  if (!waitingQueue.includes(socketId)) {
    waitingQueue.push(socketId);
  }
};

// ===============================
// remove user from queue
// ===============================
const removeFromQueue = (socketId) => {
  const index = waitingQueue.indexOf(socketId);
  if (index !== -1) {
    waitingQueue.splice(index, 1);
  }
};

// ===============================
// get match pair
// ===============================
const getMatchPair = () => {
  if (waitingQueue.length >= 2) {
    const user1 = waitingQueue.shift();
    const user2 = waitingQueue.shift();
    return [user1, user2];
  }
  return null;
};

// ===============================
// create room
// ===============================
const createRoom = (roomId, user1, user2) => {
  activeRooms.set(roomId, { user1, user2 });
};

// ===============================
// find partner
// ===============================
const findPartner = (socketId) => {
  for (const [roomId, users] of activeRooms.entries()) {
    if (users.user1 === socketId) return users.user2;
    if (users.user2 === socketId) return users.user1;
  }
  return null;
};

// ===============================
// remove room by user
// ===============================
const removeRoomByUser = (socketId) => {
  for (const [roomId, users] of activeRooms.entries()) {
    if (users.user1 === socketId || users.user2 === socketId) {
      activeRooms.delete(roomId);
      return roomId;
    }
  }
  return null;
};

// ===============================
// DEBUG STATS (very useful later)
// ===============================
const getQueueStats = () => {
  return {
    waitingCount: waitingQueue.length,
    activeRooms: activeRooms.size,
  };
};

module.exports = {
  addToQueue,
  removeFromQueue,
  getMatchPair,
  createRoom,
  findPartner,
  removeRoomByUser,
  getQueueStats,
};