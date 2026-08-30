const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

exports.initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: (origin, callback) => {
        // Dynamically reflects origin for both Web & iOS WKWebView
        callback(null, true);
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT, 10) || 30000,
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL, 10) || 25000,
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    try {
      const secret = process.env.JWT_SECRET || 'nitrr_secret_key_default';
      const decoded = jwt.verify(token, secret);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId?.toString();
    if (userId) {
      socket.join(userId);
    }
    // console.log(`🔌 [SOCKET] User connected: ${userId} (Socket: ${socket.id})`);

    socket.on('disconnect', (reason) => {
      // console.log(`🔌 [SOCKET] User disconnected: ${userId} (${reason})`);
    });
  });

  return io;
};

exports.getIO = () => io;

exports.emitToUser = (userId, event, data) => {
  if (io && userId) {
    io.to(userId.toString()).emit(event, data);
  }
};