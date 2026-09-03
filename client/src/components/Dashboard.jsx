import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import FacultyDashboard from './FacultyDashboard';
import HODDashboard from './HODDashboard';

export default function Dashboard({ user, onLogout }) {
  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400 text-sm font-medium gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span>Loading user dashboard...</span>
      </div>
    );
  }

  if (user.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  if (user.role === 'HOD') {
    return <HODDashboard user={user} onLogout={onLogout} />;
  }

  return <FacultyDashboard user={user} onLogout={onLogout} />;
}