import axios from 'axios';
import { API_URL } from '../utils/constants';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - Add token to headers
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

// Response interceptor - Handle errors
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

// ============================================
// AUTH API
// ============================================
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  signup: (data) => api.post('/auth/signup', data),
  sendOTP: (email, purpose) => api.post('/auth/send-otp', { email, purpose }),
  verifyOTP: (email, otp, purpose) => api.post('/auth/verify-otp', { email, otp, purpose }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  verifyResetOTP: (email, otp) => api.post('/auth/verify-reset-otp', { email, otp }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getMe: () => api.get('/auth/me'),
  getPendingHODs: () => api.get('/auth/hod-pending'),
  approveHOD: (id, status) => api.put(`/auth/hod-approve/${id}`, { status })
};

// ============================================
// ROOM API
// ============================================
export const roomAPI = {
  getAll: (params) => api.get('/rooms', { params }),
  getAvailable: (params) => api.get('/rooms/available', { params }),
  getById: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post('/rooms/bulk', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  toggleAvailability: (id) => api.put(`/rooms/${id}/toggle`),
  delete: (id) => api.delete(`/rooms/${id}`)
};

// ============================================
// BOOKING API
// ============================================
export const bookingAPI = {
  book: (data) => api.post('/bookings/book', data),
  getMyBookings: () => api.get('/bookings/my-bookings'),
  cancel: (id) => api.put(`/bookings/${id}/cancel`),
  getById: (id) => api.get(`/bookings/${id}`),
  lock: (data) => api.post('/bookings/lock', data),
  unlock: (lockId) => api.post('/bookings/unlock', { lockId }),
  getTimeSlots: (params) => api.get('/bookings/time-slots', { params })
};

// ============================================
// TIMETABLE API
// ============================================
export const timetableAPI = {
  get: (params) => api.get('/timetable', { params }),
  getByDepartment: (department) => api.get(`/timetable/department/${department}`),
  getByRoom: (roomId) => api.get(`/timetable/room/${roomId}`),
  getProfessorTimetable: () => api.get('/timetable/professor'),
  create: (data) => api.post('/timetable', data),
  delete: (id) => api.delete(`/timetable/${id}`)
};

export default api;
