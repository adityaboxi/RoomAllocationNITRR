# 🏫 Room Allocation System - NIT Raipur

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A comprehensive room allocation system for NIT Raipur enabling professors to book rooms for extra classes and HODs to manage timetables efficiently.

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

The **Room Allocation System** solves the room shortage problem at NIT Raipur by providing:

- **Professors** → Book available rooms for extra classes
- **HODs** → Manage timetables and resolve conflicts
- **Real-time availability** → Check room status instantly
- **Smart conflict detection** → Auto-cancel bookings when timetables change

---

## ✨ Features

### 👨‍🏫 For Professors
- View available rooms in real-time
- Book rooms with comments
- Receive email confirmations
- Track booking status (active/cancelled/completed)
- Get notified of cancellations due to conflicts

### 👑 For HODs
- Create and update department timetables
- Auto-detect conflicts with existing bookings
- Auto-cancel overlapping bookings
- Manage rooms (add, update, delete)
- View all bookings and conflicts

### ⚙️ System Features
- Real-time room availability
- Automatic conflict detection
- Email notifications (booking & cancellation)
- Role-based access control (HOD/Professor)
- JWT authentication
- OTP verification for signup
- Rate limiting (4 requests/second)

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | JavaScript runtime |
| Express.js | Web framework |
| MongoDB | Database |
| Mongoose | ODM for MongoDB |
| JWT | Authentication |
| Bcrypt.js | Password hashing |
| Nodemailer | Email sending |

### Frontend
| Technology | Purpose |
|------------|---------|
| React | UI library |
| Vite | Build tool |
| Tailwind CSS | Styling |
| Axios | HTTP client |
| React Router | Routing |

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/adityaboxi/RoomAllocationNITRR.git
cd RoomAllocationNITRR

# Install backend dependencies
cd server
npm install

# Set up environment variables
cp .env.example .env

# Start backend server
npm run dev

# Install frontend dependencies (new terminal)
cd ../client
npm install

# Start 
npm run dev


