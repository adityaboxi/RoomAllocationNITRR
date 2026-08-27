import React from 'react';
import FacultyDashboard from './FacultyDashboard';
import HODDashboard from './HODDashboard';

export default function Dashboard({ user }) {
  if (user.role === 'HOD') {
    return <HODDashboard user={user} />;
  }
  return <FacultyDashboard user={user} />;
}