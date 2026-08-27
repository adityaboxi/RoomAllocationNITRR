import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import NotificationCenter from './components/NotificationCenter';
import ReviewPopup from './components/ReviewPopup';
import {
  initSocket,
  disconnectSocket,
  onBookingCancelled,
  offBookingCancelled,
  onTimetableUpdated,
  offTimetableUpdated,
} from './services/socket';
import { getPendingReviews, getNotifications } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [notifications, setNotifications] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [currentPending, setCurrentPending] = useState(null);

  const socketRef = useRef(null);

  // Initial fetch of unread notifications & pending reviews on user login/refresh
  useEffect(() => {
    if (currentUser) {
      fetchUserNotifications();
      fetchPendingReviews();
    }
  }, [currentUser]);

  const fetchUserNotifications = async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data || []);
    } catch (err) {
      console.warn('Initial notifications fetch notice:', err.message);
    }
  };

  const fetchPendingReviews = async () => {
    if (!currentUser) return;
    try {
      const res = await getPendingReviews();
      const pending = res.data || [];
      setPendingReviews(pending);
      if (pending.length > 0) {
        setCurrentPending(pending[0]);
        setShowReviewPopup(true);
      }
    } catch (err) {
      console.warn('Pending reviews lookup notice:', err.message);
    }
  };

  // Browser Desktop Notification Permission
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  // Socket Connection & Real-Time Events
  useEffect(() => {
    if (currentUser) {
      const token = localStorage.getItem('token');
      if (token) {
        if (!socketRef.current) {
          socketRef.current = initSocket(token);
        }

        const handleCancelled = (data) => {
          const newNotif = {
            id: Date.now(),
            message: `Booking cancelled: ${data.roomName || 'Room'} on ${data.date} (${data.startTime} - ${data.endTime}). Reason: ${data.reason || 'Schedule clash'}`,
            type: 'booking-cancelled',
            read: false,
            createdAt: new Date().toISOString(),
          };

          setNotifications((prev) => [newNotif, ...prev]);

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('❌ Booking Cancelled', {
              body: `Room ${data.roomName || 'Room'} on ${data.date} (${data.startTime} - ${data.endTime})`,
            });
          }
        };

        const handleTimetableUpdate = (data) => {
          if (data?.department === currentUser.department) {
            const newNotif = {
              id: Date.now(),
              message: `Master timetable for ${data.department} Sem ${data.semester} Sec ${data.section} was updated.`,
              type: 'timetable-updated',
              read: false,
              createdAt: new Date().toISOString(),
            };
            setNotifications((prev) => [newNotif, ...prev]);
          }
        };

        onBookingCancelled(handleCancelled);
        onTimetableUpdated(handleTimetableUpdate);

        return () => {
          offBookingCancelled(handleCancelled);
          offTimetableUpdated(handleTimetableUpdate);
        };
      }
    } else {
      if (socketRef.current) {
        disconnectSocket();
        socketRef.current = null;
      }
    }
  }, [currentUser]);

  const handleLoginSuccess = (user) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
    setCurrentUser(user);
    requestNotificationPermission();
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    disconnectSocket();
    socketRef.current = null;
    setCurrentUser(null);
    setNotifications([]);
    setPendingReviews([]);
    setShowReviewPopup(false);
    setCurrentPending(null);
  };

  // Review popup handlers
  const handleReviewSubmit = () => {
    const nextList = pendingReviews.filter(
      (p) => (p.id || p._id) !== (currentPending.id || currentPending._id)
    );
    setPendingReviews(nextList);
    if (nextList.length > 0) {
      setCurrentPending(nextList[0]);
      setShowReviewPopup(true);
    } else {
      setShowReviewPopup(false);
      setCurrentPending(null);
    }
  };

  const handleReviewSkip = () => {
    const nextList = pendingReviews.slice(1);
    setPendingReviews(nextList);
    if (nextList.length > 0) {
      setCurrentPending(nextList[0]);
      setShowReviewPopup(true);
    } else {
      setShowReviewPopup(false);
      setCurrentPending(null);
    }
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <Navbar
          currentUser={currentUser}
          onLogout={handleLogout}
          notifications={notifications}
          onClearNotifications={() => setNotifications([])}
        />

        <main className="flex-1">
          {!currentUser ? (
            <AuthPage onLoginSuccess={handleLoginSuccess} />
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard user={currentUser} onLogout={handleLogout} />} />
              <Route
                path="/notifications"
                element={<NotificationCenter user={currentUser} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>

        {/* Completed Class Review Popup */}
        {showReviewPopup && currentPending && (
          <ReviewPopup
            booking={currentPending}
            onSubmit={handleReviewSubmit}
            onSkip={handleReviewSkip}
          />
        )}
      </div>
    </BrowserRouter>
  );
}