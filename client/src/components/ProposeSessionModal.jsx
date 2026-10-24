import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { proposeSession } from '../api/sessions';
import {
  Calendar,
  Clock,
  BookOpen,
  X,
  Sparkles,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export default function ProposeSessionModal({ partner, matchData, onClose }) {
  const toast = useToast();
  const navigate = useNavigate();

  // Topics
  const [proposerSkillId, setProposerSkillId] = useState(
    matchData?.targetTeachesSkills?.[0]?.skill?._id || ''
  );
  const [partnerSkillId, setPartnerSkillId] = useState(
    matchData?.candidateTeachesSkills?.[0]?.skill?._id || ''
  );

  // Time selection: default to tomorrow at 10:00
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  tomorrow.setMinutes(0, 0, 0);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];
  const defaultTimeStr = '10:00';

  const [date, setDate] = useState(defaultDateStr);
  const [time, setTime] = useState(defaultTimeStr);
  const [durationMin, setDurationMin] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  // If user clicks a shared slot pill, compute the next occurrence date
  const handleSelectSharedSlot = (slot) => {
    const today = new Date();
    const currentDay = today.getDay();
    let daysToAdd = (slot.weekday - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7; // next week

    const targetDate = new Date(today.getTime() + daysToAdd * 24 * 3600 * 1000);
    const datePart = targetDate.toISOString().split('T')[0];

    const h = Math.floor(slot.startMin / 60).toString().padStart(2, '0');
    const m = (slot.startMin % 60).toString().padStart(2, '0');
    const slotDuration = slot.endMin - slot.startMin;

    setDate(datePart);
    setTime(`${h}:${m}`);
    setDurationMin(Math.min(180, Math.max(30, slotDuration)));
    toast.info(`Prefilled slot: ${slot.label}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!date || !time) {
      toast.error('Please choose a valid date and start time');
      return;
    }

    const startDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(startDateTime.getTime()) || startDateTime.getTime() <= Date.now()) {
      toast.error('Session start must be in the future');
      return;
    }

    const endDateTime = new Date(startDateTime.getTime() + durationMin * 60 * 1000);

    try {
      setSubmitting(true);
      await proposeSession({
        partnerId: partner._id,
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
        topics: {
          proposerTeaches: proposerSkillId || undefined,
          partnerTeaches: partnerSkillId || undefined,
        },
      });

      toast.success('Session proposed successfully! Waiting for partner response.');
      onClose();
      navigate('/sessions');
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to propose session.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                Propose Session with {partner.name}
              </h3>
              <p className="text-xs text-slate-400">
                Pick a slot within your overlapping availability
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {/* Shared slots recommendation pill bar */}
          {matchData?.sharedSlots?.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-indigo-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Recommended Overlapping Slots (Click to pick):
              </label>
              <div className="flex flex-wrap gap-2">
                {matchData.sharedSlots.slice(0, 4).map((slot, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSharedSlot(slot)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-600 hover:text-white transition-all text-left"
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Topics to trade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                You Teach
              </label>
              <select
                value={proposerSkillId}
                onChange={(e) => setProposerSkillId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none"
              >
                <option value="">None / Flexible</option>
                {matchData?.targetTeachesSkills?.map((s) => (
                  <option key={s.skill?._id || s.skill} value={s.skill?._id || s.skill}>
                    {s.skill?.name || 'Skill'} ({s.level})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                They Teach
              </label>
              <select
                value={partnerSkillId}
                onChange={(e) => setPartnerSkillId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none"
              >
                <option value="">None / Flexible</option>
                {matchData?.candidateTeachesSkills?.map((s) => (
                  <option key={s.skill?._id || s.skill} value={s.skill?._id || s.skill}>
                    {s.skill?.name || 'Skill'} ({s.level})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date, Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Session Date
              </label>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Duration
              </label>
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none"
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes (1 hr)</option>
                <option value={90}>90 minutes (1.5 hr)</option>
                <option value={120}>120 minutes (2 hrs)</option>
              </select>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-400">
            <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p>
              Once proposed, your partner has 48 hours to accept, decline, or suggest a
              counter-time. Both calendars will be conflict-checked automatically.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? 'Checking conflicts...' : 'Send Proposal'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
