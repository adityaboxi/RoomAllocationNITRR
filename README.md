# 🏫 Room Allocation System - NIT Raipur

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)

> A comprehensive room allocation system for NIT Raipur enabling professors to book rooms for extra classes and HODs to manage timetables efficiently with real-time conflict detection.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Contributing](#contributing)
- [Team](#team)
- [License](#license)

---

## 🎯 Overview

The **Room Allocation System** solves the room shortage problem at NIT Raipur by providing a unified platform for:

- **Professors/Faculty** → Book available rooms for extra classes, view real-time availability, and manage bookings
- **HODs** → Manage department timetables, resolve conflicts, and oversee room allocations
- **Real-time updates** → Instant room availability updates via Socket.IO
- **Smart conflict detection** → Auto-cancel bookings when timetables change with email notifications

The system handles the entire lifecycle from timetable creation to booking management, ensuring optimal room utilization.

---

## ✨ Features

### 👨‍🏫 For Faculty/Professors
- **Real-time room availability** – See which rooms are free instantly
- **Book rooms** – With purpose, date, time, and optional comments
- **Email confirmations** – Receive booking confirmations via email
- **Booking management** – View, cancel, and track booking status
- **Review system** – Leave reviews for rooms after bookings
- **Notifications** – Get notified of cancellations due to conflicts
- **Password reset** – Secure OTP-based password recovery

### 👑 For HODs
- **Timetable management** – Create, update, and replace department timetables
- **Bulk upload** – Upload timetables via CSV/Excel files (supports room names/numbers)
- **Room management** – Add, update, delete, and toggle room availability
- **Conflict resolution** – Auto-detect and cancel conflicting bookings
- **Department stats** – View total rooms, active bookings, and timetable entries
- **Real-time updates** – Socket.IO broadcasts for timetable changes

### ⚙️ System Features
- **Real-time availability** – Socket.IO for instant updates
- **Automatic conflict detection** – Prevents double-booking
- **Email notifications** – Booking confirmations and cancellations
- **Role-based access control** – Faculty vs HOD permissions
- **JWT authentication** – Secure token-based auth
- **OTP verification** – Two-step signup flow
- **Rate limiting** – 4 requests per second (configurable)
- **File upload** – Support for CSV, XLSX, and XLS timetable files
- **Review system** – Rate and review rooms after bookings

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | JavaScript runtime environment |
| Express.js | Web framework for REST API |
| MongoDB | NoSQL database |
| Mongoose | ODM for MongoDB schema & validation |
| JSON Web Tokens | Authentication & session management |
| Bcrypt.js | Password hashing |
| Nodemailer | Email sending (OTP, confirmations) |
| Socket.IO | Real-time bidirectional communication |
| Multer | File upload handling |
| ExcelJS | Excel file parsing |
| csv-parse | CSV file parsing |

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI library with hooks |
| Vite | Fast build tool & dev server |
| Tailwind CSS | Utility-first styling |
| Axios | HTTP client for API calls |
| React Router | Client-side routing |
| Socket.IO Client | Real-time updates |
| Lucide React | Icon library |

### Tools & Utilities
| Technology | Purpose |
|------------|---------|
| Git | Version control |
| dotenv | Environment variables |
| Nodemon | Development auto-reload |
| cors | Cross-origin resource sharing |
| helmet | Security headers (optional) |

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- npm or yarn
- Git

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/adityaboxi/RoomAllocationNITRR.git
cd RoomAllocationNITRR

# 2. Install backend dependencies
cd server
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# 4. Install frontend dependencies (new terminal)
cd ../client
npm install

# 5. Start MongoDB (ensure it's running)
# On Windows: net start MongoDB
# On Linux: sudo systemctl start mongod
# On macOS: brew services start mongodb-community

# 6. Start the application
# Backend (from server directory)
npm run dev
# Frontend (from client directory)
npm run dev