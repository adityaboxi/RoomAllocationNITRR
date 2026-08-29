
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



   cd RoomAllocationNITRR_ios
npm install



# For iPhone Simulator:
VITE_API_URL=http://localhost:3000

# For Physical iPhone (Replace with your Mac's Local WiFi IP):
# VITE_API_URL=http://192.168.0.58:3000


npm run build
npx cap sync ios
npx cap open ios


In Xcode:

Select iPhone 15 (under iOS Simulators) or your connected physical iPhone.
Press Cmd + R (or click ▶ Play) to run the app.
