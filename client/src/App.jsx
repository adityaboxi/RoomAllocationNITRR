import React, { useState, useEffect } from 'react';
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

  // Check pending reviews on user login
  useEffect(() => {
    if (currentUser) {
      fetchPendingReviews();
    }
  }, [currentUser]);

  // Socket listeners
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
    setPendingReviews([]);
    setShowReviewPopup(false);
  };

  // Review popup handlers
  const handleReviewSubmit = (review) => {
    // Remove the reviewed booking from pending list
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
    // Skip the current booking, move to next
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

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <BrowserRouter>
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
          <>
            <Routes>
              <Route path="/" element={<Dashboard user={currentUser} />} />
              <Route path="/notifications" element={<NotificationCenter user={currentUser} />} />
            </Routes>
            {/* Review Popup */}
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