import React from 'react';
import FacultyDashboard from './FacultyDashboard';
import HODDashboard from './HODDashboard';

export default function Dashboard({ user, onLogout }) {
  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400 text-sm font-medium">
        Loading user profile...
      </div>
    );
  }

  if (user.role === 'HOD') {
    return <HODDashboard user={user} onLogout={onLogout} />;
  }

  return <FacultyDashboard user={user} onLogout={onLogout} />;
}