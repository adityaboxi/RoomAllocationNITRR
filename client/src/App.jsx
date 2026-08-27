import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import NotificationCenter from './components/NotificationCenter';
import ReviewPopup from './components/ReviewPopup';
import { initSocket, disconnectSocket, onBookingCancelled } from './services/socket';
import { getPendingReviews } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [notifications, setNotifications] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [currentPending, setCurrentPending] = useState(null);

  // Use a ref to track socket connection status
  const socketRef = useRef(null);

  // Fetch pending reviews after login
  const fetchPendingReviews = async () => {
    if (!currentUser) return;
    try {
      const data = await getPendingReviews();
      const pending = data.data || [];
      setPendingReviews(pending);
      if (pending.length > 0) {
        setCurrentPending(pending[0]);
        setShowReviewPopup(true);
      }
    } catch (err) {
      console.error('Failed to fetch pending reviews:', err);
    }
  };

  // Request notification permission only after a user gesture
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        console.log('Notification permission:', perm);
      });
    }
  };

  // Socket listeners
  useEffect(() => {
    if (currentUser) {
      const token = localStorage.getItem('token');
      if (token) {
        // Initialize socket if not already connected
        if (!socketRef.current) {
          socketRef.current = initSocket(token);
        }

        // Set up event listeners
        const unsubscribe = onBookingCancelled((data) => {
          setNotifications(prev => [...prev, {
            id: Date.now(),
            message: `Booking cancelled: ${data.roomName} on ${data.date} ${data.startTime}-${data.endTime}. Reason: ${data.reason}`,
            read: false
          }]);
          // Show browser notification only if permission granted
          if (Notification.permission === 'granted') {
            new Notification('Booking Cancelled', {
              body: `Room ${data.roomName} on ${data.date} ${data.startTime} - ${data.endTime}`
            });
          }
        });

        return () => {
          // Cleanup listener but do NOT disconnect the socket
          if (unsubscribe) unsubscribe();
        };
      }
    } else {
      // On logout, disconnect socket
      if (socketRef.current) {
        disconnectSocket();
        socketRef.current = null;
      }
    }
  }, [currentUser]);

  const handleLoginSuccess = (user) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
    setCurrentUser(user);
    // Request notification permission after login (user gesture from login button)
    requestNotificationPermission();
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    setCurrentUser(null);
    if (socketRef.current) {
      disconnectSocket();
      socketRef.current = null;
    }
    setNotifications([]);
    setPendingReviews([]);
    setShowReviewPopup(false);
  };

  // Review popup handlers
  const handleReviewSubmit = (review) => {
    const updated = pendingReviews.filter(p => p.id !== currentPending.id);
    setPendingReviews(updated);
    if (updated.length > 0) {
      setCurrentPending(updated[0]);
      setShowReviewPopup(true);
    } else {
      setShowReviewPopup(false);
      setCurrentPending(null);
    }
  };

  const handleReviewSkip = () => {
    const updated = pendingReviews.slice(1);
    setPendingReviews(updated);
    if (updated.length > 0) {
      setCurrentPending(updated[0]);
      setShowReviewPopup(true);
    } else {
      setShowReviewPopup(false);
      setCurrentPending(null);
    }
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <Navbar
          currentUser={currentUser}
          onLogout={handleLogout}
          notifications={notifications}
          onClearNotifications={() => setNotifications([])}
          onEnableNotifications={requestNotificationPermission} // pass this to Navbar if you want a button
        />
        {!currentUser ? (
          <AuthPage onLoginSuccess={handleLoginSuccess} />
        ) : (
          <>
            <Routes>
              <Route path="/" element={<Dashboard user={currentUser} />} />
              <Route path="/notifications" element={<NotificationCenter user={currentUser} />} />
            </Routes>
            {showReviewPopup && currentPending && (
              <ReviewPopup
                booking={currentPending}
                onSubmit={handleReviewSubmit}
                onSkip={handleReviewSkip}
              />
            )}
          </>
        )}
      </div>
    </BrowserRouter>
  );
}