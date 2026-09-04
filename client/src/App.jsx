import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import NotificationCenter from './components/NotificationCenter';
import ReviewPopup from './components/ReviewPopup';
import AdminDashboard from './components/AdminDashboard';
import {
  initSocket,
  disconnectSocket,
  onBookingCancelled,
  offBookingCancelled,
  onBookingCreated,
  offBookingCreated,
  onTimetableUpdated,
  offTimetableUpdated,
  onRoomDeleted,
  offRoomDeleted,
  onHolidayAdded,
  offHolidayAdded,
  onHolidayDeleted,
  offHolidayDeleted,
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
  const [currentPending, setCurrentPending] = useState(null);
  const [showReviewPopup, setShowReviewPopup] = useState(false);

  const socketRef = useRef(null);
  const isMountedRef = useRef(true);
  const notifAbortControllerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (notifAbortControllerRef.current) {
        notifAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Safe notification fetcher with request cancellation
  const fetchUserNotifications = useCallback(async () => {
    if (!currentUser) return;

    if (notifAbortControllerRef.current) {
      notifAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    notifAbortControllerRef.current = controller;

    try {
      const res = await getNotifications({}, { signal: controller.signal });
      if (isMountedRef.current && res?.data) {
        setNotifications(res.data);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
        console.error('❌ [APP] Failed to fetch notifications:', err.message || err);
      }
    }
  }, [currentUser]);

  // Safe pending reviews fetcher
  const fetchPendingReviews = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await getPendingReviews();
      const pending = res?.data || [];
      if (isMountedRef.current) {
        setPendingReviews(pending);
        setCurrentPending((prev) => {
          if (!prev && pending.length > 0) {
            setShowReviewPopup(true);
            return pending[0];
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('❌ [APP] Failed to fetch pending reviews:', err.message || err);
    }
  }, [currentUser]);

  // Background polling for reviews
  useEffect(() => {
    if (!currentUser) return;

    fetchUserNotifications();
    fetchPendingReviews();

    const reviewInterval = setInterval(() => {
      if (isMountedRef.current) {
        fetchPendingReviews();
      }
    }, 30000);

    return () => clearInterval(reviewInterval);
  }, [currentUser, fetchUserNotifications, fetchPendingReviews]);

  // Socket Connection Lifecycle & Real-Time Listeners
  useEffect(() => {
    if (!currentUser) {
      if (socketRef.current) {
        disconnectSocket();
        socketRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    if (!socketRef.current) {
      socketRef.current = initSocket(token);
    }

    const handleCancelled = (data) => {
      fetchUserNotifications();

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('❌ Booking Cancelled', {
          body: `Room ${data?.roomName || 'Classroom'} on ${data?.date || 'scheduled day'} (${data?.startTime || ''} - ${data?.endTime || ''})`,
        });
      }
    };

    const handleCreated = () => {
      fetchUserNotifications();
    };

    const handleTimetableUpdate = () => {
      fetchUserNotifications();
    };

    const handleRoomDeletedNotification = (data) => {
      fetchUserNotifications();
      if ('Notification' in window && Notification.permission === 'granted' && data?.roomName) {
        new Notification('🏫 Room Removed', {
          body: `Room "${data.roomName}" was removed by Administrator.`,
        });
      }
    };

    const handleHolidayChange = () => {
      fetchUserNotifications();
    };

    onBookingCancelled(handleCancelled);
    onBookingCreated(handleCreated);
    onTimetableUpdated(handleTimetableUpdate);
    onRoomDeleted(handleRoomDeletedNotification);
    onHolidayAdded(handleHolidayChange);
    onHolidayDeleted(handleHolidayChange);

    return () => {
      offBookingCancelled(handleCancelled);
      offBookingCreated(handleCreated);
      offTimetableUpdated(handleTimetableUpdate);
      offRoomDeleted(handleRoomDeletedNotification);
      offHolidayAdded(handleHolidayChange);
      offHolidayDeleted(handleHolidayChange);
    };
  }, [currentUser, fetchUserNotifications]);

  const handleLoginSuccess = (user) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
    setCurrentUser(user);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch((err) => {
        console.warn('⚠️  [APP] Notification permission request error:', err.message || err);
      });
    }
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

  // Safe item advancement by matching target ID
  const advanceReviewQueue = (completedId) => {
    setPendingReviews((prevList) => {
      const nextList = prevList.filter((p) => (p.id || p._id) !== completedId);
      if (nextList.length > 0) {
        setCurrentPending(nextList[0]);
        setShowReviewPopup(true);
      } else {
        setCurrentPending(null);
        setShowReviewPopup(false);
      }
      return nextList;
    });
  };

  const handleReviewSubmit = () => {
    if (currentPending) {
      advanceReviewQueue(currentPending.id || currentPending._id);
    }
  };

  const handleReviewSkip = () => {
    if (currentPending) {
      advanceReviewQueue(currentPending.id || currentPending._id);
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
                path="/admin"
                element={
                  currentUser?.role === 'ADMIN' ? (
                    <AdminDashboard user={currentUser} onLogout={handleLogout} />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
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