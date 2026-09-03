import React, { useState, useEffect, useRef } from 'react';
import BookingView from './BookingView';
import ReviewPopup from './ReviewPopup';
import { getPendingReviews } from '../services/api';
import { getSocket } from '../services/socket';
import {
  GraduationCap,
  Star,
  CheckCircle2,
} from 'lucide-react';

export default function FacultyDashboard({ user }) {
  const [pendingReviews, setPendingReviews] = useState([]);
  const [activeReviewBooking, setActiveReviewBooking] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkPendingReviews = async () => {
    try {
      const res = await getPendingReviews();
      const list = res?.data || [];
      if (isMountedRef.current) {
        setPendingReviews(list);
        if (list.length > 0 && !activeReviewBooking) {
          setActiveReviewBooking(list[0]);
        }
      }
    } catch (err) {
      // Handled silently
    }
  };

  useEffect(() => {
    if (user) {
      checkPendingReviews();
      const interval = setInterval(() => {
        if (isMountedRef.current) {
          checkPendingReviews();
        }
      }, 20000);

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

  const handleReviewSubmitted = () => {
    setActiveReviewBooking(null);
    checkPendingReviews();
  };

  const handleSkipReview = () => {
    setActiveReviewBooking(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 font-sans">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 leading-none">
                Welcome, {user?.name}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                Faculty
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-slate-500">
                Department of {user?.department} — NIT Raipur
              </p>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live Socket Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Reviews Banner */}
      {pendingReviews.length > 0 && !activeReviewBooking && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-fadeIn">
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

      {/* Unified Live Room Status & Booking Section */}
      <div>
        <BookingView user={user} />
      </div>

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