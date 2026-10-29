import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ReviewPopup from './components/ReviewPopup';
import {
  initSocket, disconnectSocket, onBookingCancelled, offBookingCancelled, onBookingCreated, offBookingCreated,
  onTimetableUpdated, offTimetableUpdated, onRoomDeleted, offRoomDeleted, onHolidayAdded, offHolidayAdded,
  onHolidayDeleted, offHolidayDeleted,
} from './services/socket';
import { getPendingReviews, getNotifications, getMe, skipReview } from './services/api';
import NetworkBanner from './components/NetworkBanner';
import { Loader2, RefreshCcw, AlertTriangle } from 'lucide-react';

// ============================================================================
// 🚀 YOUTUBE-STYLE OPTIMIZATIONS: Lazy Loading & Code Splitting
// By dynamically importing pages, the initial Javascript bundle becomes tiny.
// Pages only load precisely when the user navigates to them, ensuring zero lag.
// ============================================================================
const AuthPage = React.lazy(() => import('./components/AuthPage'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const NotificationCenter = React.lazy(() => import('./components/NotificationCenter'));
const KioskDisplay = React.lazy(() => import('./components/KioskDisplay'));

// Safely lazy load System Diagnostics only if present (git-ignored test script)
const diagModules = import.meta.glob('./components/SystemDiagnostics.jsx');
const SystemDiagnostics = diagModules['./components/SystemDiagnostics.jsx']
  ? React.lazy(diagModules['./components/SystemDiagnostics.jsx'])
  : null;

// 🔴 YouTube-style Top Progress Bar for Route Transitions
function TopProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((old) => {
        if (old >= 90) return 90;
        return old + Math.random() * 15;
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full h-1 z-50 overflow-hidden bg-transparent pointer-events-none">
      <div 
        className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6] transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ============================================================================
// 🛡️ SELF-HEALING ERROR BOUNDARY (Like YouTube's Crash Recovery)
// If any React component crashes due to bad code or data, this catches it,
// prevents the "White Screen of Death", and safely auto-reloads the app.
// ============================================================================
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("💥 [CRITICAL] React Component Crashed:", error, errorInfo);
    // Auto-recover after 3 seconds
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">System Recovering...</h2>
            <p className="text-slate-400 text-sm">
              We encountered an unexpected glitch. Don't worry, we are auto-restarting the application to restore functionality.
            </p>
            <div className="flex justify-center pt-4">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Strict Route Guard
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

function MainApp() {
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
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [currentPending, setCurrentPending] = useState(null);

  const socketRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Centralized Auth Verification (Optimized to run once strictly)
  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (isMountedRef.current) setAuthChecking(false);
        return;
      }
      try {
        const res = await getMe();
        const verifiedUser = res?.user || res?.data?.user || res?.data;
        if (isMountedRef.current && verifiedUser) {
          setCurrentUser(verifiedUser);
          localStorage.setItem('currentUser', JSON.stringify(verifiedUser));
        }
      } catch (err) {
        const isAuthRejection =
          err?.response?.status === 401 ||
          err?.message?.toLowerCase().includes('expired') ||
          err?.message?.toLowerCase().includes('unauthorized') ||
          err?.message?.toLowerCase().includes('not authorized');

        if (isMountedRef.current && isAuthRejection) {
          localStorage.removeItem('token');
          localStorage.removeItem('currentUser');
          setCurrentUser(null);
        }
      } finally {
        if (isMountedRef.current) setAuthChecking(false);
      }
    };
    verifySession();
  }, []);

  const fetchUserNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await getNotifications();
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
  const hasDismissedPopupThisSession = useRef(false);

  const getSkippedReviewIds = (userId) => {
    if (!userId) return [];
    try {
      return JSON.parse(localStorage.getItem(`nitrr_skipped_reviews_${userId}`) || '[]');
    } catch {
      return [];
    }
  };

  const markReviewAsSkippedLocal = (userId, bookingId) => {
    if (!userId || !bookingId) return;
    try {
      const list = getSkippedReviewIds(userId);
      if (!list.includes(bookingId)) {
        list.push(bookingId);
        localStorage.setItem(`nitrr_skipped_reviews_${userId}`, JSON.stringify(list));
      }
    } catch (err) {
      console.warn('Failed saving skipped review to localStorage:', err);
    }
  };

  const fetchPendingReviews = useCallback(async (isInitial = false) => {
    if (!currentUser || currentUser.role === 'ADMIN' || fetchingReviewsRef.current) return;
    fetchingReviewsRef.current = true;
    try {
      const res = await getPendingReviews();
      const rawList = res?.data || [];
      const userId = currentUser.id || currentUser._id;
      const skippedIds = getSkippedReviewIds(userId);
      const pending = rawList.filter((b) => !skippedIds.includes(b.id || b._id));

      if (isMountedRef.current) {
        setPendingReviews(pending);
        // Only politely auto-prompt on the first check of a session if not already dismissed
        if (isInitial && !hasDismissedPopupThisSession.current && pending.length > 0) {
          hasDismissedPopupThisSession.current = true;
          setCurrentPending(pending[0]);
          setShowReviewPopup(true);
        }
      }
    } catch (err) {
      console.error('❌ [APP] Failed to fetch pending reviews:', err.message || err);
    } finally {
      fetchingReviewsRef.current = false;
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    fetchUserNotifications();
    if (currentUser.role !== 'ADMIN') {
      fetchPendingReviews(true);
    }
    const reviewInterval = currentUser.role !== 'ADMIN'
      ? setInterval(() => {
          if (isMountedRef.current) fetchPendingReviews(false);
        }, 30000)
      : null;
    return () => { if (reviewInterval) clearInterval(reviewInterval); };
  }, [currentUser, fetchUserNotifications, fetchPendingReviews]);

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
          body: `Room ${data?.roomName || 'Classroom'} on ${data?.date || 'scheduled day'}`,
        });
      }
    };

    const handleCreated = () => fetchUserNotifications();
    const handleTimetableUpdate = () => fetchUserNotifications();
    const handleRoomDeletedNotification = (data) => {
      fetchUserNotifications();
      if ('Notification' in window && Notification.permission === 'granted' && data?.roomName) {
        new Notification('🏫 Room Removed', { body: `Room "${data.roomName}" was removed by Administrator.` });
      }
    };
    const handleHolidayChange = () => fetchUserNotifications();

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
      Notification.requestPermission().catch(() => {});
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

  const handleReviewSkip = async (bookingId) => {
    const targetId = bookingId || (currentPending ? (currentPending.id || currentPending._id) : null);
    const userId = currentUser?.id || currentUser?._id;
    if (targetId && userId) {
      markReviewAsSkippedLocal(userId, targetId);
      try {
        await skipReview(targetId);
      } catch (e) {
        console.warn('Could not record review skip on backend:', e?.message || e);
      }
    }
    // Permanently close modal for this session - do not disturb user again
    hasDismissedPopupThisSession.current = true;
    setShowReviewPopup(false);
    setCurrentPending(null);
    if (targetId) {
      setPendingReviews((prev) => prev.filter((p) => (p.id || p._id) !== targetId));
    }
  };

  const handleReviewSubmit = async (bData) => {
    const targetId = (typeof bData === 'string' ? bData : bData?.bookingId) || (currentPending ? (currentPending.id || currentPending._id) : null);
    const userId = currentUser?.id || currentUser?._id;
    if (targetId && userId) {
      markReviewAsSkippedLocal(userId, targetId);
    }
    // Successfully submitted - close modal immediately and do not disturb with another popup
    hasDismissedPopupThisSession.current = true;
    setShowReviewPopup(false);
    setCurrentPending(null);
    if (targetId) {
      setPendingReviews((prev) => prev.filter((p) => (p.id || p._id) !== targetId));
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center animate-pulse">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
          <div className="text-white font-bold text-lg tracking-tight">System Initializing...</div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-mac-bg flex flex-col font-sans text-mac-text">
        <NetworkBanner />
        <Navbar currentUser={currentUser} onLogout={handleLogout} notifications={notifications} onClearNotifications={() => setNotifications([])} />
        
        <main className="flex-1 animate-in fade-in duration-500 slide-in-from-bottom-2">
          {/* Suspense handles the YouTube-like top loading bar during route switching */}
          <Suspense fallback={<TopProgressBar />}>
            <Routes>
              <Route path="/auth" element={currentUser ? <Navigate to={currentUser.role === 'ADMIN' ? '/admin' : '/'} replace /> : <AuthPage onLoginSuccess={handleLoginSuccess} />} />
              <Route path="/" element={<ProtectedRoute user={currentUser}><Dashboard user={currentUser} onLogout={handleLogout} /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute user={currentUser} requiredRole="ADMIN"><AdminDashboard user={currentUser} onLogout={handleLogout} /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute user={currentUser}><NotificationCenter user={currentUser} notifications={notifications} setNotifications={setNotifications} onRefresh={fetchUserNotifications} /></ProtectedRoute>} />
              <Route path="/display" element={<KioskDisplay />} />
              <Route path="/kiosk" element={<KioskDisplay />} />
              {SystemDiagnostics && (
                <Route path="/system-test" element={<div className="max-w-7xl mx-auto px-4 py-8"><SystemDiagnostics /></div>} />
              )}
              <Route path="*" element={<Navigate to={currentUser ? '/' : '/auth'} replace />} />
            </Routes>
          </Suspense>
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

// Wrap the entire app in the self-healing boundary
export default function App() {
  return (
    <GlobalErrorBoundary>
      <MainApp />
    </GlobalErrorBoundary>
  );
}
