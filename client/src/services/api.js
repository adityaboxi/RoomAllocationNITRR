import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Fire a custom event instead of hard-redirecting.
      // The AuthContext listens for this to gracefully update React state.
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  signup: (data) => api.post('/auth/signup', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  verifyResetOTP: (email, otp) => api.post('/auth/verify-reset-otp', { email, otp }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getMe: () => api.get('/auth/me'),
};

export const roomAPI = {
  getAll: (params) => api.get('/rooms', { params }),
  getById: (id) => api.get(`/rooms/${id}`),
  getAvailable: (params) => api.get('/rooms/available', { params }),
  create: (data) => api.post('/rooms', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
  toggleAvailability: (id) => api.put(`/rooms/${id}/toggle`),
  checkAvailability: (roomId, day, time) => api.get(`/rooms/${roomId}/availability`, { params: { day, time } }),
};

export const timetableAPI = {
  getAll: (params) => api.get('/timetable', { params }),
  getByDepartment: (department, params) => api.get(`/timetable/department/${department}`, { params }),
  create: (data) => api.post('/timetable', data),
  update: (id, data) => api.put(`/timetable/${id}`, data),
  delete: (id) => api.delete(`/timetable/${id}`),
};

export const bookingAPI = {
  getAll: (params) => api.get('/bookings', { params }),
  getMyBookings: () => api.get('/bookings/my'),
  getById: (id) => api.get(`/bookings/${id}`),
  create: (data) => api.post('/bookings', data),
  cancel: (id) => api.put(`/bookings/${id}/cancel`),
  lock: (data) => api.post('/bookings/lock', data),
  unlock: (lockId) => api.post('/bookings/unlock', { lockId }),
  getAvailableSlots: (roomId, date) => api.get('/bookings/available-slots', { params: { roomId, date } }),
};

export default api;