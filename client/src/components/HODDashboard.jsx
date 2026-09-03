import React, { useState, useEffect, useRef } from 'react';
import TimetableManager from './hod/TimetableManager';
import HolidayManager from './hod/HolidayManager';
import BookingView from './BookingView';
import { getDepartmentStats } from '../services/api';
import { getSocket } from '../services/socket';
import {
  ShieldCheck,
  Building2,
  Calendar,
  CalendarPlus,
  Clock,
  Palmtree,
} from 'lucide-react';

export default function HODDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('book'); // 'book' | 'timetable' | 'holidays'
  const [refreshing, setRefreshing] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchStats = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await getDepartmentStats();
      if (isMountedRef.current) {
        setStats(res.data);
      }
    } catch (err) {
      // Handled silently
    } finally {
      if (isMountedRef.current && isManual) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      fetchStats();
    }, 15000);

    return () => clearInterval(interval);
  }, [user?.department]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleSync = () => {
      if (isMountedRef.current) {
        fetchStats();
      }
    };

    socket.on('booking-created', handleSync);
    socket.on('booking-cancelled', handleSync);
    socket.on('room-locked', handleSync);
    socket.on('room-unlocked', handleSync);
    socket.on('holiday-added', handleSync);
    socket.on('holiday-deleted', handleSync);
    socket.on('holiday-updated', handleSync);
    socket.on('timetable-updated', handleSync);
    socket.on('room-created', handleSync);
    socket.on('room-updated', handleSync);
    socket.on('room-deleted', handleSync);

    return () => {
      socket.off('booking-created', handleSync);
      socket.off('booking-cancelled', handleSync);
      socket.off('room-locked', handleSync);
      socket.off('room-unlocked', handleSync);
      socket.off('holiday-added', handleSync);
      socket.off('holiday-deleted', handleSync);
      socket.off('holiday-updated', handleSync);
      socket.off('timetable-updated', handleSync);
      socket.off('room-created', handleSync);
      socket.off('room-updated', handleSync);
      socket.off('room-deleted', handleSync);
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 font-sans">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 leading-none">
                HOD Portal — {user?.name}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                HOD
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Department of {user?.department} — NIT Raipur
            </p>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl flex-wrap self-start sm:self-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('book')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'book'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CalendarPlus className="w-3.5 h-3.5 text-amber-600" />
            <span>Rooms & Reservations</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timetable')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'timetable'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Timetable</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('holidays')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'holidays'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Palmtree className="w-3.5 h-3.5 text-teal-600" />
            <span>Holidays</span>
          </button>
        </div>
      </div>

      {/* Clean 3-Metric Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
          {/* Card 1: Total Rooms & Live Availability */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Rooms</span>
              <Building2 className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">{stats.totalRooms || 0}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
              <span className="text-emerald-600 font-semibold">{stats.availableRooms || 0} free</span> • <span className="text-rose-600 font-semibold">{stats.occupiedRooms || 0} occupied</span>
            </div>
          </div>

          {/* Card 2: Upcoming Bookings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Upcoming Bookings</span>
              <Clock className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">{stats.activeBookings || 0}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
              {stats.todayBookings || 0} remaining today
            </div>
          </div>

          {/* Card 3: Semester Timetable Classes */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Timetable Slots</span>
              <Calendar className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">{stats.totalTimetable || 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Weekly semester classes</div>
          </div>
        </div>
      )}

      {/* Main Tab Panels */}
      <div className="transition-all duration-200">
        {activeTab === 'book' && <BookingView user={user} />}
        {activeTab === 'timetable' && <TimetableManager user={user} />}
        {activeTab === 'holidays' && <HolidayManager user={user} />}
      </div>
    </div>
  );
}