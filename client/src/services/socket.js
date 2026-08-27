import { io } from 'socket.io-client';

let socket = null;

export const initSocket = (token) => {
  if (!socket) {
    socket = io('http://localhost:3000', {
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