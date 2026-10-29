import React, { useState, useEffect, useRef } from 'react';
import BookingView from './BookingView';
import ReviewPopup from './ReviewPopup';
import InstantRoomFinderModal from './InstantRoomFinderModal';
import { getPendingReviews, skipReview } from '../services/api';
import { getSocket } from '../services/socket';
import {
  GraduationCap,
  Star,
  CheckCircle2,
  Zap,
  Tv,
} from 'lucide-react';

export default function FacultyDashboard({ user }) {
  const [pendingReviews, setPendingReviews] = useState([]);
  const [activeReviewBooking, setActiveReviewBooking] = useState(null);
  const [showInstantFinder, setShowInstantFinder] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getSkippedIds = () => {
    try {
      return JSON.parse(localStorage.getItem(`nitrr_skipped_reviews_${user?.id || user?._id}`) || '[]');
    } catch {
      return [];
    }
  };

  const markSkippedLocal = (bookingId) => {
    if (!bookingId || !user) return;
    try {
      const skipped = getSkippedIds();
      if (!skipped.includes(bookingId)) {
        skipped.push(bookingId);
        localStorage.setItem(`nitrr_skipped_reviews_${user?.id || user?._id}`, JSON.stringify(skipped));
      }
    } catch {}
  };

  const checkPendingReviews = async () => {
    try {
      const res = await getPendingReviews();
      const list = res?.data || [];
      const skipped = getSkippedIds();
      const filtered = list.filter((b) => !skipped.includes(b.id || b._id));
      if (isMountedRef.current) {
        setPendingReviews(filtered);
        // CRITICAL: NEVER auto-popup uninvitedly on interval loop!
        // Only show the polite banner so user can click "Review Now" if they wish.
      }
    } catch (err) {
      console.error('Failed to fetch pending reviews in FacultyDashboard:', err);
    }
  };

  useEffect(() => {
    if (user) {
      checkPendingReviews();
      const interval = setInterval(() => {
        if (isMountedRef.current) {
          checkPendingReviews();
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [user]);

  // Real-Time Socket Listeners for Professor
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRealtimeSync = () => {
      if (isMountedRef.current) {
        checkPendingReviews();
      }
    };

    socket.on('booking-created', handleRealtimeSync);
    socket.on('booking-cancelled', handleRealtimeSync);
    socket.on('holiday-added', handleRealtimeSync);
    socket.on('holiday-deleted', handleRealtimeSync);
    socket.on('timetable-updated', handleRealtimeSync);

    return () => {
      socket.off('booking-created', handleRealtimeSync);
      socket.off('booking-cancelled', handleRealtimeSync);
      socket.off('holiday-added', handleRealtimeSync);
      socket.off('holiday-deleted', handleRealtimeSync);
      socket.off('timetable-updated', handleRealtimeSync);
    };
  }, []);

  const handleReviewSubmitted = (result) => {
    const bId = (typeof result === 'string' ? result : result?.bookingId) || (activeReviewBooking ? (activeReviewBooking.id || activeReviewBooking._id) : null);
    if (bId) markSkippedLocal(bId);
    setActiveReviewBooking(null);
    checkPendingReviews();
  };

  const handleSkipReview = async (bookingId) => {
    const bId = (typeof bookingId === 'string' ? bookingId : bookingId?.bookingId) || (activeReviewBooking ? (activeReviewBooking.id || activeReviewBooking._id) : null);
    if (bId) {
      markSkippedLocal(bId);
      try {
        await skipReview(bId);
      } catch (e) {
        console.warn('Skip review failed on backend:', e);
      }
    }
    setActiveReviewBooking(null);
    checkPendingReviews();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 font-sans">

      {/* Pending Reviews Banner */}
      {pendingReviews.length > 0 && !activeReviewBooking && (
        <div className="bg-white border border-mac-border rounded-lg px-5 py-3 flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span className="text-xs font-bold text-amber-900">
              You have {pendingReviews.length} completed class slot{pendingReviews.length > 1 ? 's' : ''} awaiting your review.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveReviewBooking(pendingReviews[0])}
            className="text-xs font-bold text-amber-900 underline hover:text-amber-950 transition-colors"
          >
            Review Now
          </button>
        </div>
      )}

      {/* Quick Action Bar for Instant Room Finder & Kiosk */}
      <div className="bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-transparent border border-blue-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
            Need an extra classroom or lab right now?
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            1-click instant booking scans today's active timetable and locks an empty room immediately.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="/display"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition shadow-sm flex items-center gap-1.5"
          >
            <Tv className="w-3.5 h-3.5 text-blue-600" /> Corridor Display
          </a>

          <button
            type="button"
            onClick={() => setShowInstantFinder(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 fill-white" /> Find Free Room Now
          </button>
        </div>
      </div>

      {/* Unified Live Room Status & Booking Section */}
      <div>
        <BookingView user={user} />
      </div>

      {/* Instant Free Room Finder Modal */}
      <InstantRoomFinderModal
        isOpen={showInstantFinder}
        onClose={() => setShowInstantFinder(false)}
        user={user}
        onBookingSuccess={() => {
          setShowInstantFinder(false);
          window.location.reload();
        }}
      />

      {/* Review Submission Modal Popup */}
      {activeReviewBooking && (
        <ReviewPopup
          booking={activeReviewBooking}
          onSubmit={handleReviewSubmitted}
          onSkip={handleSkipReview}
        />
      )}
    </div>
  );
}