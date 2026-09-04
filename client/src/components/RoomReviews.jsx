import React, { useState, useEffect } from 'react';
import { getRoomReviews } from '../services/api';
import { Star } from 'lucide-react';

export default function RoomReviews({ roomId }) {
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (roomId) {
      const fetchReviews = async () => {
        setLoading(true);
        try {
          const data = await getRoomReviews(roomId);
          const reviewList = data?.data?.reviews || (Array.isArray(data?.data) ? data.data : []);
          const average =
            data?.data?.avgRating !== undefined
              ? data.data.avgRating
              : reviewList.length > 0
              ? reviewList.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewList.length
              : 0;

          if (isMounted) {
            setReviews(reviewList);
            setAvgRating(Number(average) || 0);
            setCount(data?.data?.count !== undefined ? data.data.count : reviewList.length);
          }
        } catch (err) {
          console.error('Failed to fetch reviews for room in RoomReviews:', err);
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchReviews();
    }

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  if (loading) {
    return <div className="text-[11px] text-slate-400 font-medium">Loading ratings...</div>;
  }

  if (count === 0) {
    return <div className="text-[11px] text-slate-400 font-medium">No ratings yet</div>;
  }

  return (
    <div className="mt-2 space-y-1 font-sans">
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 text-amber-500">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span className="text-xs font-bold text-slate-800">{avgRating.toFixed(1)}</span>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">
          ({count} review{count > 1 ? 's' : ''})
        </span>
      </div>

      <div className="max-h-20 overflow-y-auto space-y-1 pr-1">
        {reviews.slice(0, 3).map((r, idx) => {
          const reviewId = r.id || r._id || idx;
          return (
            <div
              key={reviewId}
              className="text-[11px] text-slate-600 border-b border-slate-100 pb-1 flex items-start gap-1 leading-tight"
            >
              <span className="font-bold text-amber-600 flex items-center flex-shrink-0">
                {r.rating}★
              </span>
              <span className="truncate">{r.comment || 'Class concluded'}</span>
            </div>
          );
        })}

        {reviews.length > 3 && (
          <div className="text-[10px] text-slate-400 font-semibold">
            +{reviews.length - 3} more reviews
          </div>
        )}
      </div>
    </div>
  );
}