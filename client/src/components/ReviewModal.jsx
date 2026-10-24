import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { submitReview } from '../api/reviews';
import { Star, X, CheckCircle, ShieldCheck } from 'lucide-react';

export default function ReviewModal({ session, partner, onClose, onReviewSuccess }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      toast.error('Please select a star rating');
      return;
    }

    try {
      setSubmitting(true);
      await submitReview({
        sessionId: session._id,
        rating,
        comment,
      });

      toast.success('Verified review submitted! Reputation recomputed.');
      onReviewSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Review Verified Session</h3>
              <p className="text-xs text-slate-400">Rate your exchange with {partner?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star selector */}
          <div className="flex flex-col items-center py-2">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-7 h-7 ${
                      (hoverRating || rating) >= star
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-700'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-semibold text-amber-300 mt-2">
              {rating === 5 && 'Outstanding Experience (5 / 5)'}
              {rating === 4 && 'Very Good (4 / 5)'}
              {rating === 3 && 'Good Session (3 / 5)'}
              {rating === 2 && 'Fair (2 / 5)'}
              {rating === 1 && 'Poor (1 / 5)'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Feedback & Comments
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you learn? How was their communication and teaching style?"
              maxLength={1000}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white text-xs shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Verified Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
