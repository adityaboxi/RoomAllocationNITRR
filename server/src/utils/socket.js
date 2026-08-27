const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const onlineUsers = new Map();

exports.initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.query.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User ${socket.userId} connected`);
    onlineUsers.set(socket.userId, socket.id);
    socket.on('disconnect', () => {
      console.log(`🔌 User ${socket.userId} disconnected`);
      onlineUsers.delete(socket.userId);
    });
  });

  return io;
};

exports.emitToUser = (userId, event, data) => {
  const socketId = onlineUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

exports.getIO = () => io;