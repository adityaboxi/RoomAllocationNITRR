import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socket = null;
let currentToken = null;

// ---------- INITIALIZE SOCKET CLIENT ----------
export const initSocket = (token) => {
  if (!token) return null;

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
      console.log('🔌 [SOCKET CLIENT] Connected successfully! Socket ID:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.warn('⚠️  [SOCKET CLIENT] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ [SOCKET CLIENT] Connection error:', err.message);
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
export const onBookingCreated = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('booking-created', callback);
};

export const offBookingCreated = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('booking-created', callback);
};

export const onBookingCancelled = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('booking-cancelled', callback);
};

export const offBookingCancelled = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('booking-cancelled', callback);
};

export const onTimetableUpdated = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('timetable-updated', callback);
};

export const offTimetableUpdated = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('timetable-updated', callback);
};

export const onReviewCreated = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('review-created', callback);
};

export const offReviewCreated = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('review-created', callback);
};

export const onRoomLocked = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('room-locked', callback);
};

export const offRoomLocked = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('room-locked', callback);
};

export const onRoomUnlocked = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('room-unlocked', callback);
};

export const offRoomUnlocked = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('room-unlocked', callback);
};

// ---------- ROOM DATA CHANGE EVENTS (Admin → All Users) ----------
export const onRoomCreated = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('room-created', callback);
};

export const offRoomCreated = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('room-created', callback);
};

export const onRoomUpdated = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('room-updated', callback);
};

export const offRoomUpdated = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('room-updated', callback);
};

export const onRoomDeleted = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('room-deleted', callback);
};

export const offRoomDeleted = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('room-deleted', callback);
};

// ---------- HOLIDAY EVENTS ----------
export const onHolidayAdded = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('holiday-added', callback);
};

export const offHolidayAdded = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('holiday-added', callback);
};

export const onHolidayDeleted = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('holiday-deleted', callback);
};

export const offHolidayDeleted = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('holiday-deleted', callback);
};

export const onHolidayUpdated = (callback) => {
  const s = getSocket();
  if (s && callback) s.on('holiday-updated', callback);
};

export const offHolidayUpdated = (callback) => {
  const s = getSocket();
  if (s && callback) s.off('holiday-updated', callback);
};