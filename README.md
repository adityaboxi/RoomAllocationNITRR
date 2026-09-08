# 🏛️ NIT Raipur Room Allocation & Management System

> An enterprise-grade, real-time academic room allocation, timetable scheduling, and facility management platform engineered specifically for the National Institute of Technology Raipur (NITRR).

---

## 📑 Table of Contents
1. [System Architecture Overview](#-system-architecture-overview)
2. [Architecture Diagrams](#-architecture-diagrams)
3. [Core Architectural Pillars](#-core-architectural-pillars)
4. [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
5. [Triple-Layer Booking Conflict Engine](#-triple-layer-booking-conflict-engine)
6. [Dynamic Branch & Institutional Domain Routing](#-dynamic-branch--institutional-domain-routing)
7. [Automated Maintenance & Background Pruning](#-automated-maintenance--background-pruning)
8. [Project Structure](#-project-structure)
9. [REST API Specification](#-rest-api-specification)
10. [Local Development Setup](#-local-development-setup)
11. [Production Deployment Guide](#-production-deployment-guide)

---

## 🏛️ System Architecture Overview

The system is designed as a distributed, decoupled client-server architecture with real-time bidirectional synchronization:

```
                          ┌─────────────────────────────┐
                          │   Client Layer (Vite/React) │
                          │   - Web App (React 19 + TW4)│
                          │   - iOS App (Capacitor JS)  │
                          └──────────────┬──────────────┘
                                         │
                         HTTP REST API   │   WebSocket Events
                         (Axios + JWT)   │   (Socket.IO v4)
                                         ▼
                          ┌─────────────────────────────┐
                          │    Express Application Core │
                          │  - Auth & RBAC Middleware   │
                          │  - Timetable CSV Ingestion  │
                          │  - Conflict Resolution      │
                          │  - Background Pruning Cron  │
                          └───────┬──────────────┬──────┘
                                  │              │
                   Nodemailer     │              │ Mongoose ORM
                   (Gmail SMTP)   │              │ (Connection Pool: 10-50)
                                  ▼              ▼
                    ┌──────────────────┐   ┌─────────────────────────────┐
                    │ Institutional    │   │ MongoDB Database            │
                    │ Email Service    │   │ - Atomic Partial Indexes    │
                    │ (OTP & Alerts)   │   │ - Compound Unique Slots     │
                    └──────────────────┘   └─────────────────────────────┘
```

- **Frontend Clients:**
  - **Web Application:** Built on React 19, Vite 8, Tailwind CSS v4, Lucide Icons, and React Router v7.
  - **iOS Application:** Packaged using Capacitor iOS Native Runtime, sharing the unified responsive design and API services.
- **Backend Core:**
  - **Express.js API Engine:** Node.js server handling REST endpoints, input sanitization, dynamic department validation, and error management.
  - **Real-Time Gateway:** Socket.io server with keep-alive heartbeats pushing live room state changes to all connected clients.
- **Persistence & Security Layer:**
  - **MongoDB Database:** Managed via Mongoose 7 with connection pooling (`10` to `50` connections) and timeouts.
  - **Authentication & Encryption:** JWT (HMAC-SHA256) stateless tokens paired with BCrypt password hashing (10 salt rounds).

---

## 📊 Architecture Diagrams

### 1. Request Lifecycle & Authentication Flow
```
User (Browser/iOS)
   │
   ├─► 1. Sign Up / Login with @*.nitrr.ac.in
   │      │
   │      ▼
   │   [Domain Validator] ──► Rejects Non-Institutional / Mismatched Subdomains
   │      │
   │      ▼
   │   [OTP Service] ───────► Generates 6-Digit OTP via Nodemailer SMTP (5-min TTL)
   │      │
   │      ▼
   │   [JWT Issuer] ────────► Issues 7-Day Bearer Token + Role Claims (admin, hod, faculty)
   │
   └─► 2. Authenticated API Requests with `Authorization: Bearer <Token>`
          │
          ▼
       [RBAC Guard Middleware] ──► [Controller Action] ──► [MongoDB Engine]
```

### 2. Room Booking & Conflict Engine Flow
```
User requests: Room R on Date D from Start T1 to End T2
   │
   ├──► [Check 1: Institutional Holiday?] ──► Reject if date is marked in Holiday collection
   │
   ├──► [Check 2: Room Status Active?] ────► Reject if room is under maintenance / inactive
   │
   ├──► [Check 3: Static Timetable Matrix] ─► Reject if regular department class scheduled
   │
   ├──► [Check 4: Dynamic Overlap Check] ──► Reject if existing (Start < T2 && End > T1)
   │
   └──► [Check 5: Atomic DB Write] ────────► MongoDB Compound Index guarantees single reservation
          │
          ├─► Success: Save Booking
          ├─► Broadcast: Socket.io `room_status_changed`
          └─► Notify: Send email confirmation to user
```

---

## 🛡️ Core Architectural Pillars

### 1. Decoupled Role Spaces
- **Super Administrator:** Institute-wide governance, global room registry, academic holiday declaration, user privileges, department configurations.
- **Head of Department (HOD):** Department-specific autonomy, faculty roster visibility, semester weekly timetable spreadsheet ingestion (CSV).
- **Faculty Member:** Ad-hoc room reservations (up to 14 days in advance), booking cancellations, room facility ratings & reviews.

### 2. Live Synchronization via Socket.IO
- When any booking is created, approved, or cancelled, or when room maintenance toggles, a Socket.io event (`room_status_changed`) broadcasts immediately.
- Connected clients update their local state in real-time without requiring manual page refreshes or polling.

---

## 👥 Role-Based Access Control (RBAC)

| Role | Access Scope | Key Capabilities |
|---|---|---|
| **Admin** | System-wide (`All Departments`) | Manage all rooms, add/remove faculty/HOD, upload holidays, manage institute-level rooms, bootstrap via `.env` or custom DB password. |
| **HOD** | Department-specific (`1 per Dept`) | Upload/clear departmental CSV weekly timetables, monitor departmental room schedules, view branch faculty bookings. |
| **Faculty** | Department-affiliated | Book available rooms, cancel own bookings, submit post-class room reviews, view institute timetables. |

> **Single-HOD Database Invariant:** Enforced via MongoDB partial unique index on `{ department: 1, role: 'hod' }`. Only one active HOD can exist per academic branch.

---

## 🔒 Triple-Layer Booking Conflict Engine

To eliminate race conditions, double bookings, and schedule overlaps under high concurrency:

1. **Layer 1: Static Weekly Timetable Matrix**
   - HODs upload weekly schedules (Monday–Saturday, 8:10 AM – 5:10 PM).
   - Empty slots are parsed as freely bookable intervals.
   - Any conflicting regular class immediately blocks ad-hoc reservation.

2. **Layer 2: Real-Time Dynamic In-Flight Range Checking**
   - Queries existing active bookings for the specified room and date.
   - Detects collision using range overlap logic:
     $$\text{Conflict} \iff (\text{ExistingStart} < \text{RequestedEnd}) \land (\text{ExistingEnd} > \text{RequestedStart})$$

3. **Layer 3: Atomic Database Constraint**
   - MongoDB compound index ensures atomicity at the storage engine level:
     ```javascript
     BookingSchema.index(
       { roomId: 1, date: 1, startTime: 1, status: 1 },
       { unique: true, partialFilterExpression: { status: { $in: ['confirmed', 'pending'] } } }
     );
     ```

---

## 🌐 Dynamic Branch & Institutional Domain Routing

### Domain Security Rule
- All accounts must use institutional email addresses ending in `.nitrr.ac.in`.
- Free public email providers (`@gmail.com`, `@yahoo.com`) are rejected during signup.

### Department Subdomain Matching
The system validates faculty and HOD branch affiliation during registration:
- **Computer Science & Engineering:** `@cse.nitrr.ac.in` or `@cs.nitrr.ac.in`
- **Information Technology:** `@it.nitrr.ac.in`
- **Electronics & Communication:** `@ece.nitrr.ac.in`
- **Electrical Engineering:** `@ee.nitrr.ac.in`
- **Mechanical Engineering:** `@me.nitrr.ac.in`
- **Civil Engineering:** `@ce.nitrr.ac.in`
- **Chemical Engineering:** `@che.nitrr.ac.in`
- **Biotechnology:** `@bt.nitrr.ac.in`
- **Metallurgical & Materials:** `@mme.nitrr.ac.in`
- **Mining Engineering:** `@mn.nitrr.ac.in`

### Common / Institute Level Rooms
Central auditoriums, conference halls, and CCC facilities are registered under `Common / Institute Level`. These rooms are:
- Strictly reserved for ad-hoc institutional bookings.
- Guarded against recurring timetable overrides.

---

## 🧹 Automated Maintenance & Background Pruning

A built-in background cron service (`server/src/utils/cronJobs.js`) executes every 24 hours to ensure high database performance:
- **Completed Bookings:** Pruned after 90 days (`PRUNE_COMPLETED_BOOKINGS_DAYS`).
- **Cancelled Bookings:** Pruned after 90 days (`PRUNE_CANCELLED_BOOKINGS_DAYS`).
- **Room Reviews:** Pruned after 90 days (`PRUNE_REVIEWS_DAYS`).
- **Historical Notifications:** Read & unread alerts pruned after 90 days.
- **Expired OTPs:** Hard-deleted after 24 hours.

---

## 📁 Project Structure

```text
RoomAllocationNITRR/
├── README.md                      # Complete system documentation
├── .gitignore                     # Git tracking exclusions
│
├── server/                        # Backend REST & WebSocket Engine
│   ├── .env                       # Local environment configurations
│   ├── package.json               # Express, Mongoose, Socket.io, Multer
│   └── src/
│       ├── app.js                 # Express application, CORS & route mounting
│       ├── index.js               # HTTP + Socket.IO server bootstrap & cron
│       ├── config/
│       │   └── db.js              # Mongoose connection pool configuration
│       ├── controllers/
│       │   ├── authController.js  # OTP auth, RBAC, domain validation
│       │   ├── bookingController.js # Conflict-free booking engine
│       │   ├── roomController.js  # Room inventory & operational states
│       │   ├── timetableController.js # CSV timetable ingestion & slots
│       │   ├── holidayController.js # Institute calendar management
│       │   ├── reviewController.js # Room facility ratings & feedback
│       │   └── notificationController.js # User notifications
│       ├── middleware/
│       │   └── auth.js            # JWT verification & RBAC authorization
│       ├── models/
│       │   ├── User.js            # User accounts & single-HOD constraint
│       │   ├── AdminUser.js       # Admin dual-password credentials
│       │   ├── Room.js            # Physical room inventory
│       │   ├── Booking.js         # Booking records with compound index
│       │   ├── Timetable.js       # Weekly departmental schedules
│       │   ├── Holiday.js         # Institute non-instructional days
│       │   ├── OTP.js             # Ephemeral verification tokens
│       │   ├── Review.js          # Room ratings & feedback
│       │   └── Notification.js    # System alert messages
│       └── utils/
│           ├── email.js           # Nodemailer transport & templates
│           └── cronJobs.js        # Automated 24-hr DB pruning
│
├── client/                        # Modern Web Application
│   ├── .env                       # Local frontend environment
│   ├── package.json               # React 19, Vite, Tailwind CSS v4
│   ├── index.html                 # HTML5 entrypoint
│   ├── vite.config.js             # Vite bundler configuration
│   └── src/
│       ├── main.jsx               # React DOM bootstrap
│       ├── App.jsx                # Layout, routes & notification provider
│       ├── components/
│       │   ├── AuthPage.jsx       # Login, Signup, OTP & Department picker
│       │   ├── BookingView.jsx    # Real-time room grid & booking modal
│       │   ├── AdminDashboard.jsx # Superuser administration console
│       │   ├── HODDashboard.jsx   # Department timetable & faculty dashboard
│       │   ├── FacultyDashboard.jsx # Faculty schedule & active bookings
│       │   ├── RoomDashboard.jsx  # Public room availability board
│       │   └── NotificationCenter.jsx # Real-time notification panel
│       └── services/
│           ├── api.js             # Axios instance with auth interceptors
│           └── socket.js          # Socket.io client connection pool
│
└── ios_app/                       # Native iOS Companion
    ├── capacitor.config.json      # iOS build & app identifier metadata
    ├── package.json               # Capacitor runtime dependencies
    └── ios/                       # Xcode native project workspace
```

---

## 📡 REST API Specification

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/signup` | Public | Register new Faculty/HOD with `.nitrr.ac.in` email |
| `POST` | `/send-signup-otp` | Public | Send 6-digit OTP to institutional inbox |
| `POST` | `/verify-signup-otp` | Public | Validate OTP and activate user account |
| `POST` | `/login` | Public | Login with credentials (supports Admin dual-password) |
| `POST` | `/change-password` | Authenticated | Update user/admin password |
| `GET` | `/departments` | Public | Retrieve active academic branches |

### Room Management (`/api/rooms`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Authenticated | List all rooms with filter options (dept, capacity, status) |
| `POST` | `/` | Admin | Create a new room record |
| `PUT` | `/:id` | Admin | Update room details or maintenance status |
| `DELETE` | `/:id` | Admin | Remove room from registry |

### Bookings (`/api/bookings`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Authenticated | Fetch active bookings for a specific date and department |
| `POST` | `/` | Faculty/Admin | Create an ad-hoc room reservation |
| `PUT` | `/:id/cancel` | Booking Owner/Admin | Cancel an active booking |
| `GET` | `/user` | Authenticated | View current user's booking history |

### Timetables (`/api/timetables`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/upload` | HOD/Admin | Ingest weekly timetable via CSV upload |
| `GET` | `/:department` | Authenticated | Fetch department weekly schedule matrix |
| `DELETE` | `/:department` | HOD/Admin | Clear departmental schedule |

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: v6.0 or higher (running locally or via MongoDB Atlas)
- **NPM**: v9.0 or higher

### 2. Clone the Repository
```bash
git clone https://github.com/adityaboxi/RoomAllocationNITRR.git
cd RoomAllocationNITRR
```

### 3. Server Setup
```bash
cd server
npm install
```
Configure `server/.env`:
```env
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/roomallocation
JWT_SECRET=nitrr_secure_jwt_key_2026!
ENABLE_EMAIL_LOGGING_ONLY=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
ADMIN_EMAIL=admin@nitrr.ac.in
ADMIN_PASSWORD=adminsecret123
```
Start backend:
```bash
npm run dev
```

### 4. Client Setup
In a new terminal window:
```bash
cd client
npm install
```
Configure `client/.env`:
```env
VITE_PORT=5173
VITE_API_URL=http://localhost:3000
```
Start frontend:
```bash
npm run dev
```
Open **http://localhost:5173** in your browser.

---

## 🚀 Production Deployment Guide

### Backend Deployment (Render / Railway)
1. Set **Build Command**: `npm install`
2. Set **Start Command**: `npm start`
3. Add Environment Variables in the cloud dashboard:
   - `NODE_ENV=production`
   - `PORT=10000`
   - `MONGODB_URI=<your-mongodb-atlas-uri>`
   - `CLIENT_URL=https://your-frontend.vercel.app`
   - `CORS_ORIGIN=https://your-frontend.vercel.app`
   - `JWT_SECRET=<strong-random-key>`
   - Institutional SMTP credentials (`SMTP_USER`, `SMTP_PASS`)

### Frontend Deployment (Vercel / Netlify)
1. Set **Root Directory**: `client`
2. Set **Build Command**: `npm run build`
3. Set **Output Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_URL=https://your-backend.onrender.com`

---

## 📜 License & Accreditation
Developed for the **National Institute of Technology Raipur (NITRR)**.  
Engineered for reliable, concurrent, and real-time academic resource allocation.
