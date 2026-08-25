import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  signup: (data) => api.post('/auth/signup', data),
  sendOTP: (email, purpose) => api.post('/auth/send-otp', { email, purpose }),
  verifyOTP: (email, otp, purpose) => api.post('/auth/verify-otp', { email, otp, purpose }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  verifyResetOTP: (email, otp) => api.post('/auth/verify-reset-otp', { email, otp }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getPendingHODs: () => api.get('/auth/hod-pending'),
  approveHOD: (id, status) => api.put(`/auth/hod-approve/${id}`, { status })
};

export const roomAPI = {
  getAll: (params) => api.get('/rooms', { params }),
  getAvailable: (params) => api.get('/rooms/available', { params }),
  create: (data) => api.post('/rooms/bulk', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  toggleAvailability: (id) => api.put(`/rooms/${id}/toggle`),
  delete: (id) => api.delete(`/rooms/${id}`)
};

export const bookingAPI = {
  book: (data) => api.post('/bookings/book', data),
  getMyBookings: () => api.get('/bookings/my-bookings'),
  cancel: (id) => api.put(`/bookings/${id}/cancel`),
  lock: (data) => api.post('/bookings/lock', data),
  unlock: (lockId) => api.post('/bookings/unlock', { lockId })
};

export default api;
