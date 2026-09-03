import React, { useState } from 'react';
import { createReview } from '../services/api';
import { Star, X, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';

const extractErrorMessage = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err.response?.data?.message || err.message || fallback;
};

export default function ReviewPopup({ booking, onSubmit, onSkip }) {
  if (!booking) return null;

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bookingId = booking.id || booking._id;
  const roomName = booking.roomId?.name || 'Classroom';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (rating === 0) {
      setError('Please select a star rating between 1 and 5.');
      return;
    }

    setLoading(true);
    setError('');
    console.log(`⭐ [REVIEW] Submitting review for booking: ${bookingId} | Rating: ${rating}`);

    try {
      await createReview(
        bookingId,
        rating,
        (comment || '').trim() || 'No comment provided'
      );
      console.log(`✅ [REVIEW] Review submitted successfully for booking: ${bookingId}`);
      if (onSubmit) {
        onSubmit({ bookingId, rating, comment });
      }
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to submit review. Please try again.');
      console.error('❌ [REVIEW] Submit failed:', errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn font-sans"
      onClick={onSkip}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 relative border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onSkip}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center transition-colors"
          disabled={loading}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">Rate Your Class Session</h2>
            <p className="text-xs text-slate-400">Feedback helps maintain room infrastructure</p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
          How was your experience in <strong>{roomName}</strong> on <strong>{booking.date}</strong> ({booking.startTime} - {booking.endTime})?
        </p>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl mb-4 text-xs font-medium whitespace-pre-line">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Rating (1 to 5 Stars) *
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  disabled={loading}
                >
                  <Star
                    className={`w-7 h-7 ${
                      (hoverRating || rating) >= star
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200 hover:text-slate-300'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-bold text-slate-500 ml-2">
                {rating > 0 ? `${rating} of 5` : ''}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Feedback / Amenities Notes (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-600 focus:bg-white bg-slate-50/50 outline-none transition-all"
              rows="3"
              placeholder="e.g. Projector worked well, AC temperature was comfortable..."
              disabled={loading}
            />
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="submit"
              disabled={loading || rating === 0}
              className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Submit Rating</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}