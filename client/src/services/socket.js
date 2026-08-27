import { io } from 'socket.io-client';

// Use environment variable, fallback to localhost:3000
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socket = null;

export const initSocket = (token) => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      query: { token },
      transports: ['websocket'],
    });
    socket.on('connect', () => console.log('Socket connected'));
    socket.on('connect_error', (err) => console.error('Socket error:', err));
  }
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// --- Event listeners ---
export const onBookingCreated = (callback) => {
  if (socket) {
    socket.on('booking-created', callback);
  }
};

export const offBookingCreated = (callback) => {
  if (socket) {
    socket.off('booking-created', callback);
  }
};

export const onBookingCancelled = (callback) => {
  if (socket) {
    socket.on('booking-cancelled', callback);
  }
};

export const offBookingCancelled = (callback) => {
  if (socket) {
    socket.off('booking-cancelled', callback);
  }
};