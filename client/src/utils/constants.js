export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_DOMAIN || 'gmail.com';
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Room Allocation System - NIT Raipur';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

export const OTP_CONFIG = {
  length: 6,
  expiryMinutes: 10,
  maxAttempts: 3
};

export const BOOKING_STATUS = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  CONFLICT: 'conflict'
};

export const DEMO_ACCOUNTS = {
  hod: {
    email: 'hod@gmail.com',
    password: 'Hod@12345'
  },
  professor: {
    email: 'prof@gmail.com',
    password: 'Prof@12345'
  }
};
