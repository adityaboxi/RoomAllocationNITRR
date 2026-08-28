import React, { useState, useEffect } from 'react';
import RoomDashboard from './RoomDashboard';
import BookingView from './BookingView';
import ReviewPopup from './ReviewPopup';
import { getPendingReviews } from '../services/api';
import {
  LayoutDashboard,
  CalendarPlus,
  GraduationCap,
  Sparkles,
  Star,
} from 'lucide-react';

export default function FacultyDashboard({ user }) {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'book'
  const [pendingReviews, setPendingReviews] = useState([]);
  const [activeReviewBooking, setActiveReviewBooking] = useState(null);

  // Check on mount and run a 20-second live background check for completed slots
  useEffect(() => {
    if (user) {
      checkPendingReviews();
      const interval = setInterval(() => {
        checkPendingReviews();
      }, 20000);

      return () => clearInterval(interval);
    }
  }, [user]);

  const checkPendingReviews = async () => {
    try {
      const res = await getPendingReviews();
      const list = res.data || [];
      setPendingReviews(list);
      // Auto-open review popup if pending reviews exist and none is currently open
      if (list.length > 0 && !activeReviewBooking) {
        setActiveReviewBooking(list[0]);
      }
    } catch (err) {
      console.warn('Pending reviews lookup note:', err.message);
    }
  };

  const handleReviewSubmitted = () => {
    setActiveReviewBooking(null);
    checkPendingReviews();
  };

  const handleSkipReview = () => {
    setActiveReviewBooking(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
            <p className="text-xs text-slate-500 mt-1">
              Department of {user?.department} — NIT Raipur
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setView('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              view === 'dashboard'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Live Room Status</span>
          </button>

          <button
            type="button"
            onClick={() => setView('book')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              view === 'book'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CalendarPlus className="w-3.5 h-3.5 text-indigo-600" />
            <span>Reserve Slot</span>
          </button>
        </div>
      </div>

      {/* Pending Reviews Banner Reminder */}
      {pendingReviews.length > 0 && !activeReviewBooking && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span className="text-xs font-bold text-amber-900">
              You have {pendingReviews.length} completed class slot{pendingReviews.length > 1 ? 's' : ''} awaiting your feedback.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveReviewBooking(pendingReviews[0])}
            className="text-xs font-bold text-amber-900 underline hover:text-amber-950"
          >
            Review Now
          </button>
        </div>
      )}

      {/* Active View Component */}
      <div className="transition-all duration-300">
        {view === 'dashboard' ? (
          <RoomDashboard user={user} />
        ) : (
          <BookingView user={user} />
        )}
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