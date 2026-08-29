import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const [notifications, setNotifications] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [currentPending, setCurrentPending] = useState(null);
  const [showReviewPopup, setShowReviewPopup] = useState(false);

  const socketRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch initial notifications and pending reviews + Poll every 30 seconds
  useEffect(() => {
    if (currentUser) {
      fetchUserNotifications();
      fetchPendingReviews();

      const reviewInterval = setInterval(() => {
        if (isMountedRef.current) {
          fetchPendingReviews();
        }
      }, 30000);

      return () => clearInterval(reviewInterval);
    }
  }, [currentUser]);

  const fetchUserNotifications = async () => {
    try {
      const res = await getNotifications();
      if (isMountedRef.current) {
        setNotifications(res?.data || []);
      }
    } catch (err) {
      // Handled silently
    }
  };

  const fetchPendingReviews = async () => {
    if (!currentUser) return;
    try {
      const res = await getPendingReviews();
      const pending = res?.data || [];
      if (isMountedRef.current) {
        setPendingReviews(pending);
        if (pending.length > 0 && !showReviewPopup) {
          setCurrentPending(pending[0]);
          setShowReviewPopup(true);
        }
      }
    } catch (err) {
      // Handled silently
    }
  };

  // Safe Browser Notification Request
  const requestNotificationPermission = () => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && typeof Notification.requestPermission === 'function') {
        Notification.requestPermission().catch(() => {});
      }
    } catch (e) {}
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
          fetchUserNotifications();
        };

        const handleTimetableUpdate = () => {
          fetchUserNotifications();
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
    <HashRouter>
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
                element={
                  <NotificationCenter
                    user={currentUser}
                    notifications={notifications}
                    setNotifications={setNotifications}
                    onRefresh={fetchUserNotifications}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>

        {/* Global Completed Class Review Popup */}
        {showReviewPopup && currentPending && (
          <ReviewPopup
            booking={currentPending}
            onSubmit={handleReviewSubmit}
            onSkip={handleReviewSkip}
          />
        )}
      </div>
    </HashRouter>
  );
}