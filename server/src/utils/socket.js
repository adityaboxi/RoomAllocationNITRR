const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

exports.initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: (origin, callback) => {
        // Dynamically reflects origin for Web & iOS WKWebView
        callback(null, true);
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT, 10) || 30000,
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL, 10) || 25000,
  });

  // JWT Authentication middleware for Socket.IO
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      console.warn(`🔌 [SOCKET] Connection rejected: no token | Socket ${socket.id}`);
      return next(new Error('Authentication error: Missing token'));
    }

    try {
      const secret = process.env.JWT_SECRET || 'nitrr_secret_key_default';
      const decoded = jwt.verify(token, secret);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      console.warn(`🔌 [SOCKET] Connection rejected: invalid/expired token | Socket ${socket.id} | ${err.message}`);
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId?.toString();
    if (userId) {
      socket.join(userId);
    }
    console.log(`🔌 [SOCKET] User connected: ${userId} | Socket: ${socket.id} | Total: ${io.engine.clientsCount}`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 [SOCKET] User disconnected: ${userId} | Reason: ${reason} | Socket: ${socket.id}`);
    });

    socket.on('error', (err) => {
      console.error(`🔌 [SOCKET] Error for user ${userId}:`, err.message);
    });
  });

  console.log(`✅ [SOCKET] Socket.IO initialized and attached to HTTP server`);
  return io;
};

exports.getIO = () => io;

exports.emitToUser = (userId, event, data) => {
  if (io && userId) {
    io.to(userId.toString()).emit(event, data);
    console.log(`📡 [SOCKET] emitToUser | userId: ${userId} | event: ${event}`);
  } else if (!io) {
    console.warn(`📡 [SOCKET] emitToUser called before Socket.IO initialized | event: ${event}`);
  }
};