import React, { useState, useEffect } from 'react';
import RoomManager from './hod/RoomManager';
import TimetableManager from './hod/TimetableManager';
import HolidayManager from './hod/HolidayManager';
import BookingView from './BookingView';
import RoomDashboard from './RoomDashboard';
import { getDepartmentStats } from '../services/api';
import {
  ShieldCheck,
  Building2,
  Calendar,
  CalendarPlus,
  LayoutDashboard,
  Clock,
  CheckCircle2,
  Palmtree,
} from 'lucide-react';

export default function HODDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'rooms' | 'timetable' | 'holidays' | 'book'

  useEffect(() => {
    if (user?.department) {
      fetchStats();
    }
  }, [user?.department]);

  const fetchStats = async () => {
    try {
      const data = await getDepartmentStats(user.department);
      setStats(data?.data || null);
    } catch (err) {
      // Handled silently
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-3.5 sm:space-y-6 font-sans">
      {/* Top Header Profile Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">
                {user?.name}
              </h1>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                HOD
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Dept. of {user?.department} — NIT Raipur
            </p>
          </div>
        </div>
      </div>

      {/* iOS Segmented Pill Tab Bar (Smooth Thumb-Scrollable on iPhone) */}
      <div className="overflow-x-auto pb-1 -mx-3.5 px-3.5">
        <div className="flex items-center bg-slate-200/80 p-1 rounded-2xl gap-1 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 ${
              activeTab === 'live'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
            <span>Live Status</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 ${
              activeTab === 'rooms'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Rooms</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timetable')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 ${
              activeTab === 'timetable'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Timetable</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('holidays')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 ${
              activeTab === 'holidays'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palmtree className="w-3.5 h-3.5 text-teal-600" />
            <span>Holidays</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('book')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 ${
              activeTab === 'book'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarPlus className="w-3.5 h-3.5 text-amber-600" />
            <span>Booking</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards (Responsive for iPhone screens) */}
      {stats && (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 animate-fadeIn">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-sm text-center sm:text-left">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Rooms</span>
              <Building2 className="w-3.5 h-3.5 text-indigo-500 hidden sm:inline" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-900 font-mono">
              {stats.totalRooms || 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {stats.availableRooms || 0} free now
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-sm text-center sm:text-left">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Bookings</span>
              <Clock className="w-3.5 h-3.5 text-emerald-500 hidden sm:inline" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-900 font-mono">
              {stats.activeBookings || 0}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
              {stats.todayBookings || 0} today
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-sm text-center sm:text-left">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Timetable</span>
              <Calendar className="w-3.5 h-3.5 text-amber-500 hidden sm:inline" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-900 font-mono">
              {stats.totalTimetable || 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Weekly slots</div>
          </div>
        </div>
      )}

      {/* Main Tab Panels */}
      <div className="transition-all duration-200">
        {activeTab === 'live' && <RoomDashboard user={user} />}
        {activeTab === 'rooms' && <RoomManager user={user} onUpdate={fetchStats} />}
        {activeTab === 'timetable' && <TimetableManager user={user} onUpdate={fetchStats} />}
        {activeTab === 'holidays' && <HolidayManager user={user} />}
        {activeTab === 'book' && <BookingView user={user} />}
      </div>
    </div>
  );
}