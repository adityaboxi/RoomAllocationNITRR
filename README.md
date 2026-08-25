
# 🏫 Room Allocation System - NIT Raipur

A comprehensive room allocation system for NIT Raipur that allows professors to book rooms for extra classes and HODs to manage timetables efficiently.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

The **Room Allocation System** is designed to solve the room shortage problem at NIT Raipur. It enables:

- **Professors** to book available rooms for extra classes
- **HODs** to manage and update timetables
- **Automatic conflict detection** when timetables are updated
- **Email notifications** for booking confirmations and cancellations

---

## ✨ Features

### For Professors
- ✅ View available rooms in real-time
- ✅ Book rooms for extra classes
- ✅ Receive email confirmations for bookings
- ✅ View all your bookings with status
- ✅ Get notified if bookings are cancelled due to timetable conflicts

### For HODs
- ✅ Create and update timetables
- ✅ Auto-detect conflicts with existing bookings
- ✅ Auto-cancel overlapping bookings
- ✅ Send notifications to affected professors
- ✅ View all bookings and conflicts

### System Features
- ✅ Real-time room availability checking
- ✅ Automatic conflict detection
- ✅ Email notifications (booking confirmation & cancellation)
- ✅ Role-based access control (HOD & Professor)
- ✅ JWT authentication
- ✅ MongoDB database

---

## 🛠️ Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **Bcrypt.js** - Password hashing
- **Nodemailer** - Email sending
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing

### Frontend
- **React** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **React Router DOM** - Routing
- **Heroicons** - Icons

---

## 📁 Project Structure
