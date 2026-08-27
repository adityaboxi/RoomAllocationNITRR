import React from 'react';
import BookingView from './BookingView';

export default function FacultyDashboard({ user }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Faculty Dashboard</h1>
      <BookingView user={user} />
    </div>
  );
}