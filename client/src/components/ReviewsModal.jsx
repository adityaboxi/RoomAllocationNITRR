import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Star, X, MessageSquare, Loader2 } from 'lucide-react';
import { formatDate } from '../utils/helpers';
import { getRoomReviews } from '../services/api';

export default function ReviewModal({ room, onClose }) {
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  
  const observerRef = useRef(null);

  const fetchReviews = useCallback(async (pageNum) => {
    if (!room || !room.id && !room._id) return;
    try {
      setLoading(true);
      const roomId = room.id || room._id;
      const res = await getRoomReviews(roomId, pageNum);
      const data = res?.data || res;
      
      const newReviews = data.reviews || [];
      
      setReviews(prev => pageNum === 1 ? newReviews : [...prev, ...newReviews]);
      setAvgRating(data.avgRating !== undefined ? data.avgRating : null);
      setTotalCount(data.count || 0);
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error('❌ Failed to fetch room reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [room]);

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  const handleObserver = useCallback(
    (entries) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading) {
        setPage((prev) => {
          const nextPage = prev + 1;
          fetchReviews(nextPage);
          return nextPage;
        });
      }
    },
    [hasMore, loading, fetchReviews]
  );

  useEffect(() => {
    const element = document.getElementById('review-scroll-trigger');
    if (!element) return;
    const observer = new IntersectionObserver(handleObserver, { root: null, rootMargin: '20px', threshold: 1.0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver, reviews]);

  if (!room) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn font-sans"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {room.name || 'Room Reviews'}
              </h2>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>{room.roomNumber || ''}</span>
                <span>•</span>
                <span>
                  {avgRating !== null ? (
                    <strong className="text-amber-600 font-semibold">
                      {avgRating} ★ ({totalCount} reviews)
                    </strong>
                  ) : (
                    'No reviews yet'
                  )}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reviews List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3.5 divide-y divide-slate-100 relative">
          {reviews.length === 0 && !loading ? (
            <div className="p-8 text-center text-slate-400">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No reviews yet</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Faculty ratings and comments will appear here.
              </p>
            </div>
          ) : (
            reviews.map((r, idx) => {
              const reviewId = r.id || r._id || idx;
              return (
                <div key={reviewId} className="pt-3.5 first:pt-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= (r.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {r.createdAt ? formatDate(r.createdAt) : ''}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                    {r.comment || 'No comment provided'}
                  </p>

                  <div className="text-[11px] font-semibold text-slate-500">
                    {r.facultyName || r.facultyId?.name || 'Faculty Member'}
                  </div>
                </div>
              );
            })
          )}
          
          {hasMore && (
            <div id="review-scroll-trigger" className="h-10 flex items-center justify-center pt-4">
              {loading && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
            </div>
          )}
          
          {!hasMore && reviews.length > 0 && (
             <div className="text-center text-xs text-slate-400 pt-4 pb-2 border-t border-slate-100">
               End of reviews
             </div>
          )}
        </div>
      </div>
    </div>
  );
}