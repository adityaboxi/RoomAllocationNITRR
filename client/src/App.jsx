import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import AuthPage from './components/AuthPage.jsx';
import { initialRooms, initialTimetable, initialBookings } from './data/mockData';
import { Clock, Calendar, CheckCircle2, AlertCircle, Plus } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const [rooms] = useState(initialRooms);
  const [timetable] = useState(initialTimetable);
  const [bookings, setBookings] = useState(initialBookings);

  // Active Simulated Time (e.g. 10:30 AM Wednesday)
  const [activeTime, setActiveTime] = useState('10:30');
  const [activeDay] = useState('Wednesday');

  const handleLoginSuccess = (user) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  // Helper to check live availability
  const checkRoomStatus = (roomId) => {
    // 1. Regular Timetable Clash
    const ttClash = timetable.find(
      (t) => t.roomId === roomId && t.day === activeDay && t.startTime <= activeTime && activeTime < t.endTime
    );
    if (ttClash) {
      return { status: 'occupied', label: `Class: ${ttClash.subject}`, sub: `${ttClash.classGroup} (${ttClash.faculty})`, until: ttClash.endTime };
    }

    // 2. Ad-hoc Booking Clash
    const bookingClash = bookings.find(
      (b) => b.roomId === roomId && b.startTime <= activeTime && activeTime < b.endTime
    );
    if (bookingClash) {
      return { status: 'occupied', label: `Reserved: ${bookingClash.purpose}`, sub: bookingClash.facultyName, until: bookingClash.endTime };
    }

    return { status: 'available', label: 'Available Right Now', sub: 'Ready for booking' };
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Navbar currentUser={currentUser} onLogout={handleLogout} />

      {!currentUser ? (
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* Welcome & Simulation Control Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Welcome, {currentUser.name}
              </h1>
              <p className="text-sm text-slate-600 mt-0.5">
                {currentUser.role === 'HOD' 
                  ? 'Department Master Schedule & Allocation Dashboard'
                  : 'Check live room availability and claim an open slot instantly.'}
              </p>
            </div>

            {/* Simulated Live Clock Controls */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
              <Clock className="w-5 h-5 text-indigo-600" />
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase">Simulated Time</div>
                <div className="text-sm font-bold text-slate-800">{activeDay} at {activeTime}</div>
              </div>
              <input
                type="time"
                value={activeTime}
                onChange={(e) => setActiveTime(e.target.value)}
                className="ml-2 border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white font-medium outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          {/* Real-time Room Grid */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Department Rooms Live Status</h2>
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
              Auto-updating
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {rooms.map((room) => {
              const info = checkRoomStatus(room.id);
              const isAvailable = info.status === 'available';

              return (
                <div
                  key={room.id}
                  className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col justify-between transition-all ${
                    isAvailable ? 'border-emerald-300 ring-1 ring-emerald-400/20' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-base text-slate-900">{room.name}</h3>
                        <p className="text-xs text-slate-500">{room.floor} • Cap: {room.capacity}</p>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                          isAvailable
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {isAvailable ? 'Available' : 'Occupied'}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 my-3">
                      <div className="text-xs font-semibold text-slate-800">{info.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{info.sub}</div>
                      {info.until && (
                        <div className="text-[11px] text-slate-400 mt-1">Busy until: {info.until}</div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {currentUser.role === 'FACULTY' ? (
                    <button
                      disabled={!isAvailable}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                        isAvailable
                          ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      }`}
                    >
                      {isAvailable ? '⚡ Quick Book Now' : 'Room Busy'}
                    </button>
                  ) : (
                    <button className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors">
                      Edit Room Timetable
                    </button>
                  )}
                </div>
              );
            })}
          </div>

        </main>
      )}
    </div>
  );
}