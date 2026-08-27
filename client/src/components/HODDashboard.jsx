import React, { useState, useEffect } from 'react';
import RoomManager from './hod/RoomManager';
import TimetableManager from './hod/TimetableManager';
import BookingView from './BookingView';
import RoomDashboard from './RoomDashboard';
import { getDepartmentStats } from '../services/api';

export default function HODDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'rooms' | 'timetable' | 'book'

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await getDepartmentStats(user.department);
      setStats(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">HOD Dashboard – {user.department.toUpperCase()}</h1>
        {stats && (
          <div className="flex gap-4 text-sm">
            <span>Rooms: {stats.totalRooms}</span>
            <span>Active Bookings: {stats.activeBookings}</span>
            <span>Timetable Entries: {stats.totalTimetable}</span>
          </div>
        )}
      </div>

      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-4 flex-wrap">
          <button
            onClick={() => setActiveTab('live')}
            className={`py-2 px-4 text-sm font-semibold ${activeTab === 'live' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Live Rooms
          </button>
          <button
            onClick={() => setActiveTab('rooms')}
            className={`py-2 px-4 text-sm font-semibold ${activeTab === 'rooms' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Manage Rooms
          </button>
          <button
            onClick={() => setActiveTab('timetable')}
            className={`py-2 px-4 text-sm font-semibold ${activeTab === 'timetable' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Manage Timetable
          </button>
          <button
            onClick={() => setActiveTab('book')}
            className={`py-2 px-4 text-sm font-semibold ${activeTab === 'book' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Book Room
          </button>
        </nav>
      </div>

      {activeTab === 'live' && <RoomDashboard user={user} />}
      {activeTab === 'rooms' && <RoomManager user={user} />}
      {activeTab === 'timetable' && <TimetableManager user={user} />}
      {activeTab === 'book' && <BookingView user={user} />}
    </div>
  );
}