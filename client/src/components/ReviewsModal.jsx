import React from 'react';
import { Star, X } from 'lucide-react';

export default function ReviewsModal({ room, reviews, onClose }) {
  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{room.name}</h2>
            <p className="text-sm text-slate-500">
              Reviews ({reviews.length}) • Avg: {avgRating !== null ? `${avgRating}★` : 'No reviews'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {reviews.length === 0 ? (
            <p className="text-slate-500 text-sm">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex text-amber-400">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} className={`w-4 h-4 ${s <= r.rating ? 'fill-amber-400' : 'text-slate-300'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">{r.facultyName}</span>
                </div>
                <p className="text-sm text-slate-700 mt-1">{r.comment}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}