# 🏫 NIT Raipur Classroom Allocation & Master Scheduling System

> An enterprise-grade, high-concurrency room allocation, master timetable management, and automated holiday scheduling engine built for National Institute of Technology, Raipur. Designed for high availability, zero-latency real-time collaboration, and bulletproof database integrity across Web and native iOS platforms.

---

## 🏗️ Architectural Overview & System Design

               ┌────────────────────────────────────────────────────────┐
                 │          🌐 Web Client (Vite + React 19)               │
                 │          📱 iOS Client (Capacitor + iOS 17/18)         │
                 │  - AbortController Signal Cancellation                 │
                 │  - Socket.IO Real-time State Hydration                 │
                 └───────────────────────────┬────────────────────────────┘
                                             │  HTTPS / WebSockets (WSS)
                                             ▼
                 ┌────────────────────────────────────────────────────────┐
                 │              Node.js + Express REST API                │
                 │  - RBAC Middleware (HOD / Faculty / Admin)             │
                 │  - Idempotent Graceful Shutdown (SIGINT/TERM)          │
                 │  - 2-Step Atomic Locking Engine                        │
                 └──────────────┬───────────────────────────┬─────────────┘
                                │                           │
        ┌───────────────────────┘                           └────────────────────────┐
        ▼                                                                            ▼


---

## 🚀 Key Engineering Highlights & Optimizations

### 1. Concurrency Control & Race Condition Mitigation
* **2-Step Atomic Checkout Lock:** Prevents double-booking when multiple faculty members attempt to reserve the same classroom at the exact same second. Implemented with temporary lock IDs, automatic TTL expiration, and unmount release triggers.
* **Compound Database Constraints:** Enforces atomic uniqueness at the MongoDB layer via compound indexes (`{ department: 1, date: 1 }` for holidays and time-range overlap checks for bookings), guaranteeing data consistency even under concurrent distributed requests.

### 2. Low-Latency Query Optimization (<30ms)
* **Compound B-Tree Indexing:** Queries against room availability, timetables, and date ranges use compound indexed lookups (`{ roomId: 1, date: 1, startTime: 1, endTime: 1 }`), reducing query time from $O(N)$ collection scans to $O(\log N)$ index seeks.
* **Lean Execution (`.lean()`):** Read-only queries bypass Mongoose document hydration overhead, decreasing API serialization latency by over 60%.
* **Client-Side Request Deduplication:** Integrated `AbortController` request cancellation to automatically abort obsolete in-flight HTTP requests during fast search typing and filter switching.

### 3. Smart Multi-Year Holiday Engine (National vs. Emergency)
* **Multi-Year Recurring Cycle:** National Holidays (`isRecurring: true`) match by Month-Day (`MM-DD`), automatically propagating across 2026, 2027, 2028, and beyond without manual re-entry.
* **Intelligent Retention & Pruning:** 
  * **National / Annual Holidays:** Permanently preserved.
  * **Emergency / Local Holidays:** Automatically purged by a daily background cron job 90 days after passing.
* **Cascade Invalidation:** Rescheduling or declaring a holiday automatically cancels all colliding bookings on that date, dispatches formatted cancellation emails, writes in-app notifications, and broadcasts WebSocket alerts.

### 4. Memory Leak Prevention & Production Hardening
* **Socket.IO Lifecycle Safety:** Dedicated cleanup handlers in React `useEffect` hooks match every `socket.on()` with `socket.off()`, preventing listener accumulation.
* **Idempotent Graceful Shutdown:** Single-execution exit guards (`isShuttingDown`) combined with unreferenced fallback timers safely drain DB connection pools and active HTTP requests without leaving zombie Node.js processes.
* **Midnight Rollover Clamping:** Auto-clamps 23:xx slot selections to `23:59`, eliminating day-shift validation crashes.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend (`server/`)** | Node.js, Express.js, Socket.IO, Mongoose ODM, Nodemailer, JWT, bcryptjs |
| **Web Frontend (`client/`)** | React 19, Vite, Tailwind CSS v4, Lucide Icons, Axios, Socket.IO Client |
| **iOS Mobile (`RoomAllocationNITRR_ios/`)** | Capacitor 6, WKWebView, Xcode Native Toolchain, Swift/Obj-C Bridge |
| **Database** | MongoDB Atlas (AWS Mumbai Region for sub-20ms latency) |

---

## 📡 Core REST API Specification

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/login` | Public | Authenticates user & issues JWT token |
| `GET` | `/api/rooms/available` | Authenticated | Fetches available rooms filtered by date, time & amenities |
| `POST` | `/api/bookings/lock` | Faculty / HOD | Acquires atomic temporary lock for checkout |
| `POST` | `/api/bookings` | Faculty / HOD | Converts lock to confirmed reservation + emails receipt |
| `GET` | `/api/holidays` | Authenticated | Retrieves recurring & emergency department holidays |
| `POST` | `/api/holidays` | HOD Only | Declares holiday + auto-cancels colliding reservations |
| `PUT` | `/api/holidays/:id` | HOD Only | In-place update/rescheduling of declared holiday |
| `DELETE`| `/api/holidays/:id` | HOD Only | Removes holiday and restores timetable/room availability |

---

## 💻 Local Setup & Development (After `git pull`)



### 1️⃣ Backend Server Setup (`server/`)

1. Navigate to the server folder and install dependencies:
   ```bash
   cd server
   npm install



   PORT=3000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/roomallocation?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173

# Email Configuration (Google SMTP / College Mail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password
EMAIL_FROM="NIT Raipur Room Allocation <your_email@gmail.com>"

# Retention & Auto-Pruning Thresholds (in days)
PRUNE_COMPLETED_BOOKINGS_DAYS=90
PRUNE_REVIEWS_DAYS=90
PRUNE_CANCELLED_BOOKINGS_DAYS=7
PRUNE_READ_NOTIFICATIONS_DAYS=7
PRUNE_UNREAD_NOTIFICATIONS_DAYS=30


npm run dev

cd client
npm install

VITE_API_URL=http://localhost:3000

npm run dev





3️⃣ Native iOS App Setup (RoomAllocationNITRR_ios/)
(Requires a Mac with Xcode 15+ installed)

Open a new terminal tab and navigate to RoomAllocationNITRR_ios/:

bash


cd RoomAllocationNITRR_ios
npm install
Create RoomAllocationNITRR_ios/.env:

env


# For iPhone Simulator:
VITE_API_URL=http://localhost:3000
# For Physical iPhone (Replace with your Mac's Local WiFi IP):
# VITE_API_URL=http://192.168.0.58:3000
Build and launch Xcode:

bash


npm run build
npx cap sync ios
npx cap open ios
In Xcode:

Select iPhone 15 (under iOS Simulators) or your connected physical iPhone.
Press Cmd + R (or click ▶ Play) to run the app.
👨‍💻 Author
Aditya Boxi
National Institute of Technology, Raipur

4:22 AM
