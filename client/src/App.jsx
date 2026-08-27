import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import { initSocket, disconnectSocket, onBookingCancelled } from './services/socket';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (currentUser) {
      const token = localStorage.getItem('token');
      if (token) {
        initSocket(token);
        onBookingCancelled((data) => {
          setNotifications(prev => [...prev, {
            id: Date.now(),
            message: `Booking cancelled: ${data.roomName} on ${data.date} ${data.startTime}-${data.endTime}. Reason: ${data.reason}`,
            read: false
          }]);
          if (Notification.permission === 'granted') {
            new Notification('Booking Cancelled', {
              body: `Room ${data.roomName} on ${data.date} ${data.startTime} - ${data.endTime}`
            });
          }
        });
      }
    } else {
      disconnectSocket();
    }
    return () => {
      disconnectSocket();
    };
  }, [currentUser]);

  const handleLoginSuccess = (user) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    setCurrentUser(null);
    disconnectSocket();
    setNotifications([]);
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        notifications={notifications}
        onClearNotifications={() => setNotifications([])}
      />
      {!currentUser ? (
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Dashboard user={currentUser} />
      )}
    </div>
  );
}