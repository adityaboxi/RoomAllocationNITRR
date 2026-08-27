const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

// ---------- INITIALIZE SOCKET.IO SERVER ----------
exports.initSocket = (server) => {
  const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

  io = socketIo(server, {
    cors: {
      origin: allowedOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT Authentication Middleware for Socket Connections
  io.use((socket, next) => {
    const token =
      socket.handshake.query?.token ||
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'default_jwt_secret'
      );
      socket.userId = decoded.userId.toString();
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // Connection Lifecycle Handlers
  io.on('connection', (socket) => {
    // Join a dedicated room named after the userId
    // This delivers events to all open tabs/devices belonging to this user
    socket.join(socket.userId);
    console.log(`🔌 Socket connected: User ${socket.userId} (Socket: ${socket.id})`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: User ${socket.userId} (Reason: ${reason})`);
    });
  });

  return io;
};

// ---------- EMIT EVENT TO SPECIFIC USER (Across all tabs) ----------
exports.emitToUser = (userId, event, data) => {
  if (io && userId) {
    io.to(userId.toString()).emit(event, data);
  }
};

// ---------- GET ACTIVE IO INSTANCE ----------
exports.getIO = () => io;