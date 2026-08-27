import React, { useState } from 'react';
import { createReview } from '../services/api';
import { Star, X } from 'lucide-react';

export default function ReviewPopup({ booking, onSubmit, onSkip }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createReview(booking.id, rating, comment.trim() || 'No comment provided.');
      onSubmit({ bookingId: booking.id, rating, comment });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onSkip}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
          disabled={loading}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-2">Review Your Class</h2>
        <p className="text-sm text-slate-500 mb-4">
          Help others by sharing your experience for{' '}
          <strong>{booking.roomId?.name || 'this room'}</strong> on {booking.date} at{' '}
          {booking.startTime} - {booking.endTime}.
        </p>

        {error && <div className="bg-rose-50 text-rose-800 p-2 rounded mb-3 text-sm">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="focus:outline-none"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  disabled={loading}
                >
                  <Star
                    className={`w-8 h-8 ${(hoverRating || rating) >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Comment (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
              rows="3"
              placeholder="Share your experience..."
              disabled={loading}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Review'}
            </button>
            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300 disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}