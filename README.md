# 🏫 Smart Room Allocation System — NIT Raipur

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x%20%7C%207.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

> **A real-time, concurrency-safe room allocation and master timetable platform designed for academic institutions.**  
> Solves the challenge of overlapping classroom schedules, ad-hoc lecture bookings, and master timetable coordination through sub-second conflict detection, WebSocket broadcasts, and in-memory batch processing.

---

## 📌 Table of Contents

1. [Executive Summary & Problem Statement](#-executive-summary)
2. [High-Level Architecture & Data Flow](#-high-level-architecture)
3. [Folder Structure & Code Organization](#-folder-structure)
4. [Core Business Logic & Algorithms](#-core-business-logic--algorithms)
   - [Conflict & Overlap Math](#1-time-overlap-detection-algorithm)
   - [Two-Layer Real-Time Engine](#2-two-layer-real-time-sync-engine)
   - [In-Memory Streaming Timetable Parser](#3-in-memory-streaming-timetable-parser)
5. [Defensive Engineering & Edge Cases](#-defensive-engineering--edge-cases)
6. [API Architecture & Endpoints](#-api-architecture--endpoints)
7. [Database Schema & Indexing Strategy](#-database-schema--indexing-strategy)
8. [Environment Configuration (`.env`)](#-environment-configuration)
9. [Developer Setup & Quick Start](#-developer-setup--quick-start)
10. [Troubleshooting & FAQ](#-troubleshooting--faq)
11. [License](#-license)

---

## 📖 Executive Summary

In institutional environments like NIT Raipur, classroom allocation faces two competing demands:
1. **Deterministic Schedules:** Recurring weekly master timetables uploaded by Department Heads (HODs).
2. **Dynamic Demands:** Ad-hoc reservations by faculty members for extra lectures, seminars, remedial classes, or lab sessions.

### How this system solves it:
- **Zero-Collision Guarantee:** Faculty cannot book a room that has a recurring timetable class or another active booking during that time window.
- **Automated Cascading Cleanup:** When an HOD uploads a new timetable that conflicts with existing ad-hoc bookings, the conflicting bookings are automatically cancelled, and faculty members receive automated cancellation emails and in-app alerts.
- **Standalone MongoDB Compatible:** Operates with high consistency without requiring multi-document replica set transactions (`startSession`).
- **Zero-Refresh Real-Time UI:** Live room availability switches automatically via WebSockets and time-tick listeners.

---

## 🏗️ High-Level Architecture

```mermaid
flowchart TD
    subgraph ClientLayer ["Frontend (React 18 + Vite + Tailwind)"]
        UI["React SPA"]
        SocketClient["Socket.IO Client"]
        APIClient["Axios HTTP Client"]
    end

    subgraph ServerLayer ["Backend (Node.js + Express)"]
        Router["Express REST Routes"]
        AuthMiddleware["JWT & Role Middleware"]
        Controllers["Controllers (Room, Timetable, Booking, Auth)"]
        SocketServer["Socket.IO Server"]
    end

    subgraph AsyncWorkers ["Background Async Handlers"]
        EmailWorker["Nodemailer (SMTP Worker)"]
    end

    subgraph DataLayer ["Database (MongoDB)"]
        DB[(MongoDB Database)]
    end

    UI --> APIClient
    UI <--> SocketClient

    APIClient -->|HTTP Request + Bearer JWT| Router
    Router --> AuthMiddleware
    AuthMiddleware --> Controllers

    Controllers -->|Compound Indexed Queries| DB
    Controllers -.->|Detached Background Promise| EmailWorker
    Controllers -->|Live State Events| SocketServer
    SocketServer <-->|Bi-directional WS Events| SocketClient