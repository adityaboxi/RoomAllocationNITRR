import React from 'react';
import RoomDashboard from './RoomDashboard';
import BookingView from './BookingView';

export default function FacultyDashboard({ user }) {
  const [view, setView] = React.useState('dashboard'); // 'dashboard' | 'book'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Faculty Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView('dashboard')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg ${view === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
          >
            Live Rooms
          </button>
          <button
            onClick={() => setView('book')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg ${view === 'book' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
          >
            Book a Room
          </button>
        </div>
      </div>

      {view === 'dashboard' ? (
        <RoomDashboard user={user} />
      ) : (
        <BookingView user={user} />
      )}
    </div>
  );
}