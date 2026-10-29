import React, { useState, useEffect } from 'react';
import {
  Clock,
  Building2,
  Users,
  Maximize2,
  Minimize2,
  RefreshCw,
  Layers,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { getAllRoomsStatus, getDepartments } from '../services/api';
import { getSocket } from '../services/socket';

export default function KioskDisplay() {
  const [time, setTime] = useState(new Date());
  const [rooms, setRooms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Digital Clock ticking every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStatus = async () => {
    try {
      const [statusRes, deptRes] = await Promise.all([
        getAllRoomsStatus(),
        getDepartments().catch(() => ({ data: [] })),
      ]);

      if (statusRes?.data) {
        setRooms(Array.isArray(statusRes.data) ? statusRes.data : statusRes.data.data || []);
      }
      if (deptRes?.data) {
        setDepartments(Array.isArray(deptRes.data) ? deptRes.data : deptRes.data.data || []);
      }
    } catch (err) {
      console.error('Kiosk status load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds as background poll
    const pollInterval = setInterval(fetchStatus, 30000);

    // Socket.IO real-time instant triggers
    const socket = getSocket();
    if (socket) {
      socket.on('booking-created', fetchStatus);
      socket.on('booking-cancelled', fetchStatus);
      socket.on('timetable-updated', fetchStatus);
      socket.on('room-issue-reported', fetchStatus);
      socket.on('room-issue-resolved', fetchStatus);
    }

    return () => {
      clearInterval(pollInterval);
      if (socket) {
        socket.off('booking-created', fetchStatus);
        socket.off('booking-cancelled', fetchStatus);
        socket.off('timetable-updated', fetchStatus);
        socket.off('room-issue-reported', fetchStatus);
        socket.off('room-issue-resolved', fetchStatus);
      }
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    if (selectedDept === 'ALL') return true;
    return r.department === selectedDept;
  });

  const occupiedCount = filteredRooms.filter((r) => r.occupancy?.status === 'OCCUPIED' || r.occupancy?.type).length;
  const vacantCount = filteredRooms.length - occupiedCount;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col p-4 lg:p-8 select-none">
      
      {/* ── Top Kiosk Header ───────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20">
            NIT
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-black tracking-tight flex items-center gap-2">
              NIT Raipur Digital Notice Board
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Live
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              National Institute of Technology Raipur — Academic Facility & Classroom Occupancy Display
            </p>
          </div>
        </div>

        {/* Digital Clock & Controls */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 border border-slate-800 px-5 py-2.5 rounded-2xl flex items-center gap-3 shadow-inner">
            <Clock className="w-5 h-5 text-blue-400" />
            <div className="text-right font-mono">
              <div className="text-xl font-bold tracking-wider text-blue-300">
                {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">
                {time.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition shadow"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ── Subheader Controls & Metrics ──────────────────────── */}
      <div className="py-4 flex flex-wrap items-center justify-between gap-4">
        {/* Department Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedDept('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
              selectedDept === 'ALL'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All Departments ({rooms.length})
          </button>
          {departments.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDept(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                selectedDept === d
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {d.replace('Engineering', 'Eng.').replace('Computer Science & Eng.', 'CSE')}
            </button>
          ))}
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{vacantCount} Vacant Rooms</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span>{occupiedCount} In Session</span>
          </div>
        </div>
      </div>

      {/* ── Main Departure-Style Status Board ─────────────────── */}
      <main className="flex-1 overflow-y-auto pt-2">
        {loading ? (
          <div className="py-24 text-center space-y-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="text-sm font-medium font-mono">Synchronizing live academic occupancy schedule...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="py-24 text-center text-slate-500">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-sm">No classrooms registered under this department.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRooms.map((room) => {
              const occ = room.occupancy || {};
              const isOccupied = occ.status === 'OCCUPIED' || Boolean(occ.type);
              const hasOpenIssue = Array.isArray(room.issues) && room.issues.some((i) => i.status === 'OPEN');

              return (
                <div
                  key={room._id || room.id}
                  className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                    isOccupied
                      ? 'bg-gradient-to-b from-red-950/20 to-slate-900/80 border-red-500/30 shadow-lg shadow-red-950/20'
                      : 'bg-gradient-to-b from-emerald-950/20 to-slate-900/80 border-emerald-500/30 shadow-lg shadow-emerald-950/20'
                  }`}
                >
                  <div>
                    {/* Top row: Name & Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-2xl font-black text-white tracking-tight">{room.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          <span>{room.building}, {room.floor}</span>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase border flex items-center gap-1.5 ${
                          isOccupied
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
                        {isOccupied ? 'In Session' : 'Vacant'}
                      </span>
                    </div>

                    {/* Middle details: Session info or Vacant info */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                      {isOccupied ? (
                        <>
                          <div className="text-slate-200 font-semibold line-clamp-1">
                            {occ.subject || occ.purpose || 'Academic Session'}
                          </div>
                          <div className="text-slate-400 text-[11px] flex items-center justify-between">
                            <span>Faculty: <strong className="text-slate-300">{occ.faculty || occ.facultyName || 'Staff'}</strong></span>
                            {occ.endTime && (
                              <span className="font-mono text-red-400 font-bold">Ends {occ.endTime}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                            {occ.type === 'BOOKING' ? '📅 Special Reservation' : '📚 Scheduled Timetable Class'}
                          </div>
                        </>
                      ) : (
                        <div className="text-emerald-400 font-medium text-xs flex items-center gap-1.5">
                          <span>Available for Immediate Booking / Study</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Footer: Amenities & Issue Warning */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Users className="w-3 h-3" /> {room.capacity}
                      </span>
                      {room.hasProjector && <span title="Projector available">📽️</span>}
                      {room.hasAC && <span title="Air conditioning">❄️</span>}
                    </div>

                    {hasOpenIssue && (
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                        ⚠️ Hardware Issue
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Kiosk Footer ───────────────────────────────────────── */}
      <footer className="pt-4 mt-2 border-t border-slate-900 text-center text-xs text-slate-600 font-mono">
        NIT Raipur Real-Time Facility Synchronization Engine • WebSocket Connected
      </footer>
    </div>
  );
}
