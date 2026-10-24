import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSessionById } from '../api/sessions';
import { startConversation } from '../api/conversations';
import { Calendar, Clock, BookOpen, User, X, CheckCircle2, History, MessageSquare } from 'lucide-react';

export default function SessionDetailModal({ sessionId, onClose }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchSessionById(sessionId);
        setSession(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (sessionId) load();
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Session Details & History</h3>
              <p className="text-xs text-slate-400">Complete audit log of state transitions</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
            Loading timeline...
          </div>
        ) : !session ? (
          <div className="py-12 text-center text-xs text-slate-400">Session not found</div>
        ) : (
          <div className="overflow-y-auto space-y-6 pr-1">
            {/* Session Info Header */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Current Status:</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                  {session.status}
                </span>
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Proposer:</span>
                  <span className="font-semibold text-slate-200">{session.proposer?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Partner:</span>
                  <span className="font-semibold text-slate-200">{session.partner?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheduled:</span>
                  <span className="font-mono text-slate-200">
                    {new Date(session.start).toLocaleString()} -{' '}
                    {new Date(session.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <button
                onClick={async () => {
                  try {
                    // Start chat with the other participant
                    const targetId = session.proposer?._id;
                    if (targetId) {
                      const conv = await startConversation(targetId);
                      onClose();
                      navigate(`/messages?conv=${conv._id}`);
                    }
                  } catch (e) {
                    console.error('Failed to open chat:', e);
                  }
                }}
                className="w-full mt-3 py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Message Session Partner
              </button>
            </div>

            {/* History Timeline */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-400" /> State Transition Timeline
              </h4>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {session.history?.map((step, idx) => (
                  <div key={idx} className="relative">
                    {/* Bullet */}
                    <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center" />

                    <div className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {step.status}
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          {new Date(step.at).toLocaleString()}
                        </span>
                      </div>
                      {step.by && (
                        <p className="text-slate-400 mt-1">
                          By: <span className="text-slate-300">{step.by.name || 'System / Auto'}</span>
                        </p>
                      )}
                      {step.note && <p className="text-slate-500 mt-0.5 italic">{step.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
