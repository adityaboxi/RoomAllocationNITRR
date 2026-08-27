import React, { useState, useEffect } from 'react';
import { getRoomReviews } from '../services/api';

export default function RoomReviews({ roomId }) {
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roomId) {
      fetchReviews();
    }
  }, [roomId]);

  const fetchReviews = async () => {
    try {
      const data = await getRoomReviews(roomId);
      setReviews(data.data.reviews || []);
      setAvgRating(data.data.avgRating || 0);
      setCount(data.data.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-xs text-slate-400">Loading reviews...</div>;
  if (count === 0) return <div className="text-xs text-slate-400">No reviews yet</div>;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-amber-500">★ {avgRating.toFixed(1)}</span>
        <span className="text-xs text-slate-500">({count} review{count > 1 ? 's' : ''})</span>
      </div>
      <div className="mt-1 max-h-20 overflow-y-auto space-y-1">
        {reviews.slice(0, 3).map((r) => (
          <div key={r.id} className="text-xs text-slate-600 border-b border-slate-100 pb-1">
            <span className="font-semibold">★ {r.rating}</span> {r.comment && <span>— {r.comment}</span>}
          </div>
        ))}
        {reviews.length > 3 && <div className="text-xs text-slate-400">+{reviews.length - 3} more</div>}
      </div>
    </div>
  );
}