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
import { getPendingReviews, getNotifications, getMe } from './services/api';
import { Loader2 } from 'lucide-react';

// Strict Route Guard: Restricts dashboard access strictly to authenticated sessions with verified token
function ProtectedRoute({ children, user, requiredRole }) {
  const token = localStorage.getItem('token');
  if (!user || !token) {
    return <Navigate to="/auth" replace />;
  }
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('currentUser');
      const token = localStorage.getItem('token');
      if (!token) return null;
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authChecking, setAuthChecking] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [currentPending, setCurrentPending] = useState(null);
  const [showReviewPopup, setShowReviewPopup] = useState(false);

  const socketRef = useRef(null);
  const isMountedRef = useRef(true);
  const notifAbortControllerRef = useRef(null);

  // Verify persistent authentication session on application boot
  useEffect(() => {
    let isCancelled = false;
    const verifyAuthSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (!isCancelled) {
          setCurrentUser(null);
          setAuthChecking(false);
        }
        return;
      }

      try {
        const res = await getMe();
        if (res?.user && !isCancelled) {
          setCurrentUser(res.user);
          localStorage.setItem('currentUser', JSON.stringify(res.user));
        } else if (!isCancelled) {
          throw new Error('Invalid user session');
        }
      } catch (err) {
        console.warn('⚠️  [APP] Auth session expired or invalid:', err.message || err);
        if (!isCancelled) {
          localStorage.removeItem('token');
          localStorage.removeItem('currentUser');
          setCurrentUser(null);
        }
      } finally {
        if (!isCancelled) {
          setAuthChecking(false);
        }
      }
    };

    verifyAuthSession();

    const handleUnauthorized = () => {
      handleLogout();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      isCancelled = true;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

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

  const fetchingReviewsRef = useRef(false);

  // Safe pending reviews fetcher
  const fetchPendingReviews = useCallback(async () => {
    if (!currentUser || currentUser.role === 'ADMIN' || fetchingReviewsRef.current) return;
    fetchingReviewsRef.current = true;
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
    } finally {
      fetchingReviewsRef.current = false;
    }
  }, [currentUser]);

  // Background polling for reviews
  useEffect(() => {
    if (!currentUser) return;

    fetchUserNotifications();

    // Only fetch reviews for non-ADMIN users
    if (currentUser.role !== 'ADMIN') {
      fetchPendingReviews();
    }

    const reviewInterval = currentUser.role !== 'ADMIN'
      ? setInterval(() => {
          if (isMountedRef.current) {
            fetchPendingReviews();
          }
        }, 30000)
      : null;

    return () => { if (reviewInterval) clearInterval(reviewInterval); };
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

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-900/20 border border-indigo-500/30 flex items-center justify-center animate-pulse">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
          <div className="text-white font-bold text-lg tracking-tight">NIT Raipur Room Allocation</div>
          <div className="text-slate-400 text-xs">Verifying authorization session...</div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900">
        <Navbar
          currentUser={currentUser}
          onLogout={handleLogout}
          notifications={notifications}
          onClearNotifications={() => setNotifications([])}
        />

        <main className="flex-1">
          <Routes>
            <Route
              path="/auth"
              element={
                currentUser ? (
                  <Navigate to={currentUser.role === 'ADMIN' ? '/admin' : '/'} replace />
                ) : (
                  <AuthPage onLoginSuccess={handleLoginSuccess} />
                )
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute user={currentUser}>
                  <Dashboard user={currentUser} onLogout={handleLogout} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute user={currentUser} requiredRole="ADMIN">
                  <AdminDashboard user={currentUser} onLogout={handleLogout} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute user={currentUser}>
                  <NotificationCenter
                    user={currentUser}
                    notifications={notifications}
                    setNotifications={setNotifications}
                    onRefresh={fetchUserNotifications}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={<Navigate to={currentUser ? '/' : '/auth'} replace />}
            />
          </Routes>
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