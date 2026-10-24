import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { counterSession } from '../api/sessions';
import { Clock, Calendar, X, ArrowRight } from 'lucide-react';

export default function CounterModal({ session, onClose, onCounterSuccess }) {
  const toast = useToast();

  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const [date, setDate] = useState(defaultDateStr);
  const [time, setTime] = useState('11:00');
  const [durationMin, setDurationMin] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const startDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(startDateTime.getTime()) || startDateTime.getTime() <= Date.now()) {
      toast.error('Counter time must be in the future');
      return;
    }

    const endDateTime = new Date(startDateTime.getTime() + durationMin * 60 * 1000);

    try {
      setSubmitting(true);
      await counterSession(session._id, {
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
      });
      toast.success('Counter proposal submitted! Original session updated.');
      onCounterSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to submit counter proposal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Counter Propose New Time</h3>
              <p className="text-xs text-slate-400">Suggest an alternate time that works for you</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Date</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Start Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Duration</label>
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
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
              className="px-5 py-2.5 rounded-xl font-semibold bg-amber-600 hover:bg-amber-500 text-white text-xs shadow-lg shadow-amber-600/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Send Counter Proposal'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
