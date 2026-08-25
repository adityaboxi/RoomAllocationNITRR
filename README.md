
# 🏫 Room Allocation System - NIT Raipur

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-blue)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-green)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC)](https://tailwindcss.com/)

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
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [Team](#team)
- [License](#license)

---

## 🎯 Overview

The **Room Allocation System** is designed to solve the room shortage problem at NIT Raipur. It enables:

- **Professors** to book available rooms for extra classes
- **HODs** to manage and update timetables
- **Automatic conflict detection** when timetables are updated
- **Email notifications** for booking confirmations and cancellations
- **OTP verification** for secure signup
- **Real-time room availability** checking

---

## ✨ Features

### For Professors
- ✅ View available rooms in real-time
- ✅ Book rooms for extra classes with comments
- ✅ Receive OTP verification for signup
- ✅ Receive email confirmations for bookings
- ✅ View all bookings with status
- ✅ Get notified if bookings are cancelled due to timetable conflicts

### For HODs
- ✅ Create and update timetables
- ✅ Auto-detect conflicts with existing bookings
- ✅ Auto-cancel overlapping bookings
- ✅ Send notifications to affected professors
- ✅ View all bookings and conflicts
- ✅ Add and manage rooms
- ✅ Approve HOD account requests

### System Features
- ✅ Real-time room availability checking
- ✅ Automatic conflict detection
- ✅ Email notifications (booking confirmation & cancellation)
- ✅ Role-based access control (HOD & Professor)
- ✅ JWT authentication
- ✅ MongoDB database with optimized indexes
- ✅ Rate limiting (4 requests/second)
- ✅ Scalable for 500+ users

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
- **Express Rate Limit** - Rate limiting

### Frontend
- **React** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **React Router DOM** - Routing
- **Heroicons** - Icons

---

## 📁 Project Structure
