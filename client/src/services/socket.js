import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socket = null;
let currentToken = null;

// ---------- INITIALIZE SOCKET CLIENT ----------
export const initSocket = (token) => {
  if (!token) return null;

  // If token changed, recreate connection
  if (socket && currentToken !== token) {
    disconnectSocket();
  }

  if (!socket) {
    currentToken = token;
    socket = io(SOCKET_URL, {
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected successfully (ID:', socket.id, ')');
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Socket connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });
  }

  return socket;
};

// ---------- GET SOCKET INSTANCE ----------
export const getSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('token');
    if (token) {
      return initSocket(token);
    }
  }
  return socket;
};

// ---------- DISCONNECT SOCKET ----------
export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
};

// ---------- EVENT LISTENER HELPERS ----------

// Booking Created
export const onBookingCreated = (callback) => {
  const s = getSocket();
  if (s && callback) {
    s.on('booking-created', callback);
  }
};

export const offBookingCreated = (callback) => {
  const s = getSocket();
  if (s && callback) {
    s.off('booking-created', callback);
  }
};

// Booking Cancelled
export const onBookingCancelled = (callback) => {
  const s = getSocket();
  if (s && callback) {
    s.on('booking-cancelled', callback);
  }
};

export const offBookingCancelled = (callback) => {
  const s = getSocket();
  if (s && callback) {
    s.off('booking-cancelled', callback);
  }
};

// Master Timetable Updated
export const onTimetableUpdated = (callback) => {
  const s = getSocket();
  if (s && callback) {
    s.on('timetable-updated', callback);
  }
};

export const offTimetableUpdated = (callback) => {
  const s = getSocket();
  if (s && callback) {
    s.off('timetable-updated', callback);
  }
};