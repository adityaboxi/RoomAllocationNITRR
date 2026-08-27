import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor – add token
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

// Response interceptor – extract data
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

// ---------- AUTH ----------
export const login = (email, password) => api.post('/api/auth/login', { email, password });
export const signup = (name, email, password, confirmPassword, department) =>
  api.post('/api/auth/signup', { name, email, password, confirmPassword, department });
export const forgotPassword = (email) => api.post('/api/auth/forgot-password', { email });
export const verifyResetOtp = (email, otp) => api.post('/api/auth/verify-reset-otp', { email, otp });
export const resetPassword = (email, resetToken, newPassword, confirmPassword) =>
  api.post('/api/auth/reset-password', { email, resetToken, newPassword, confirmPassword });
export const changePassword = (currentPassword, newPassword, confirmPassword) =>
  api.post('/api/auth/change-password', { currentPassword, newPassword, confirmPassword });

// ---------- ROOMS ----------
export const getRooms = (params = {}) => api.get('/api/rooms', { params });
export const getRoom = (id) => api.get(`/api/rooms/${id}`);
export const getAvailableRooms = (date, startTime, endTime, filters = {}) =>
  api.get('/api/rooms/available', { params: { date, startTime, endTime, ...filters } });
export const createRoom = (data) => api.post('/api/rooms', data);
export const updateRoom = (id, data) => api.put(`/api/rooms/${id}`, data);
export const toggleRoomAvailability = (id) => api.put(`/api/rooms/${id}/toggle`);
export const deleteRoom = (id) => api.delete(`/api/rooms/${id}`);
export const getRoomAvailability = (roomId, day, time) =>
  api.get(`/api/rooms/${roomId}/availability?day=${day}&time=${time}`);
export const getRoomsByDepartment = (department) => api.get(`/api/rooms/department/${department}`);

// ---------- TIMETABLE ----------
export const getTimetable = (params = {}) => api.get('/api/timetable', { params });
export const getTimetableByDepartment = (department, params = {}) =>
  api.get(`/api/timetable/department/${department}`, { params });
export const getTimetableByFaculty = (facultyName, params = {}) =>
  api.get(`/api/timetable/faculty/${facultyName}`, { params });
export const getTimetableByRoom = (roomId) => api.get(`/api/timetable/room/${roomId}`);
export const replaceTimetable = (data) => api.post('/api/timetable', data);
export const updateTimetableEntry = (id, data) => api.put(`/api/timetable/${id}`, data);
export const deleteTimetableEntry = (id) => api.delete(`/api/timetable/${id}`);

// ---------- BOOKINGS ----------
export const getBookings = (params = {}) => api.get('/api/bookings', { params });
export const getMyBookings = () => api.get('/api/bookings/my');
export const getBooking = (id) => api.get(`/api/bookings/${id}`);
export const createBooking = (data) => api.post('/api/bookings', data);
export const cancelBooking = (id) => api.put(`/api/bookings/${id}/cancel`);
export const lockRoom = (data) => api.post('/api/bookings/lock', data);
export const unlockRoom = (lockId) => api.post('/api/bookings/unlock', { lockId });
export const getBookingsByRoom = (roomId) => api.get(`/api/bookings/room/${roomId}`);
export const getBookingsByFaculty = (facultyEmail) => api.get(`/api/bookings/faculty/${facultyEmail}`);

// ---------- STATS ----------
export const getDepartmentStats = (department) => api.get(`/api/stats/department/${department}`);

// ---------- NOTIFICATIONS ----------
export const getNotifications = () => api.get('/api/notifications');
export const markAsRead = (id) => api.put(`/api/notifications/${id}/read`);
export const markAllAsRead = () => api.put('/api/notifications/read-all');
export const deleteNotification = (id) => api.delete(`/api/notifications/${id}`);
export const deleteAll = () => api.delete('/api/notifications');