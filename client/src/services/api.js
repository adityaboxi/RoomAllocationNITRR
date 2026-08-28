import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Request Interceptor
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

// Response Interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      if (error.response?.data?.expired || error.response?.data?.message?.includes('expired')) {
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
      }
    }
    const message = error.response?.data?.message || error.message || 'Server request failed';
    return Promise.reject(new Error(message));
  }
);

// Auth Endpoints
export const login = (email, password) =>
  api.post('/api/auth/login', { email, password });

export const signup = (name, email, password, confirmPassword, department) =>
  api.post('/api/auth/signup', { name, email, password, confirmPassword, department });

export const sendSignupOtp = (data) =>
  api.post('/api/auth/send-signup-otp', data);

export const verifySignupOtp = (email, otp) =>
  api.post('/api/auth/verify-signup-otp', { email, otp });

export const forgotPassword = (email) =>
  api.post('/api/auth/forgot-password', { email });

export const verifyResetOtp = (email, otp) =>
  api.post('/api/auth/verify-reset-otp', { email, otp });

export const resetPassword = (email, resetToken, newPassword, confirmPassword) =>
  api.post('/api/auth/reset-password', { email, resetToken, newPassword, confirmPassword });

export const changePassword = (currentPassword, newPassword, confirmPassword) =>
  api.post('/api/auth/change-password', { currentPassword, newPassword, confirmPassword });

export const getMe = () => api.get('/api/auth/me');

// Dynamic Metadata Endpoints
export const getDepartments = () => api.get('/api/auth/departments');

// Room Endpoints
export const getRooms = (params = {}, options = {}) =>
  api.get('/api/rooms', { params, ...options });

export const getRoom = (id) =>
  api.get(`/api/rooms/${id}`);

export const getAvailableRooms = (date, startTime, endTime, filters = {}, options = {}) =>
  api.get('/api/rooms/available', {
    params: { date, startTime, endTime, ...filters },
    ...options,
  });

export const getRoomsByFloor = () => api.get('/api/rooms/floors');
export const getRoomsByBuilding = () => api.get('/api/rooms/buildings');
export const getRoomsByDepartment = (department) => api.get(`/api/rooms/department/${department}`);
export const createRoom = (data) => api.post('/api/rooms', data);
export const updateRoom = (id, data) => api.put(`/api/rooms/${id}`, data);
export const toggleRoomAvailability = (id) => api.put(`/api/rooms/${id}/toggle`);
export const deleteRoom = (id) => api.delete(`/api/rooms/${id}`);
export const getRoomAvailability = (roomId, day, time, date) =>
  api.get(`/api/rooms/${roomId}/availability`, { params: { day, time, date } });

// Timetable Endpoints
export const getTimetable = (params = {}) => api.get('/api/timetable', { params });
export const getTimetableByDepartment = (department, params = {}) =>
  api.get(`/api/timetable/department/${department}`, { params });
export const getTimetableByFaculty = (facultyName, params = {}) =>
  api.get(`/api/timetable/faculty/${facultyName}`, { params });
export const getTimetableByRoom = (roomId, params = {}) =>
  api.get(`/api/timetable/room/${roomId}`, { params });
export const replaceTimetable = (data) => api.post('/api/timetable', data);
export const updateRoomDayTimetable = (data) => api.post('/api/timetable/room-day', data);
export const updateTimetableEntry = (id, data) => api.put(`/api/timetable/${id}`, data);
export const deleteTimetableEntry = (id) => api.delete(`/api/timetable/${id}`);

// Booking Endpoints
export const getBookings = (params = {}) => api.get('/api/bookings', { params });
export const getMyBookings = () => api.get('/api/bookings/my');
export const getBooking = (id) => api.get(`/api/bookings/${id}`);
export const createBooking = (data) => api.post('/api/bookings', data);
export const cancelBooking = (id) => api.put(`/api/bookings/${id}/cancel`);
export const lockRoom = (roomIdOrData, date, startTime, endTime) => {
  const payload =
    typeof roomIdOrData === 'object'
      ? roomIdOrData
      : { roomId: roomIdOrData, date, startTime, endTime };
  return api.post('/api/bookings/lock', payload);
};
export const unlockRoom = (lockId) => api.post('/api/bookings/unlock', { lockId });
export const getBookingsByRoom = (roomId) => api.get(`/api/bookings/room/${roomId}`);
export const getBookingsByFaculty = (facultyEmail) => api.get(`/api/bookings/faculty/${facultyEmail}`);

// Department Stats
export const getDepartmentStats = (department) => api.get(`/api/stats/department/${department}`);

// Notifications
export const getNotifications = (params = {}) => api.get('/api/notifications', { params });
export const markAsRead = (id) => api.put(`/api/notifications/${id}/read`);
export const markAllAsRead = () => api.put('/api/notifications/read-all');
export const deleteNotification = (id) => api.delete(`/api/notifications/${id}`);
export const deleteAll = () => api.delete('/api/notifications');

// Reviews
export const createReview = (bookingId, rating, comment) =>
  api.post('/api/reviews', { bookingId, rating, comment });
export const getRoomReviews = (roomId) => api.get(`/api/reviews/room/${roomId}`);
export const getPendingReviews = () => api.get('/api/reviews/pending');
export const getMyReviews = () => api.get('/api/reviews/my');

export default api;