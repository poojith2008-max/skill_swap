import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import {
  fetchSessions,
  acceptSession,
  declineSession,
  cancelSession,
  completeSession,
} from '../api/sessions';
import { startConversation } from '../api/conversations';
import CounterModal from '../components/CounterModal';
import ReviewModal from '../components/ReviewModal';
import SessionDetailModal from '../components/SessionDetailModal';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  Star,
  MessageSquare,
  AlertCircle,
  Eye,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function SessionsDashboard() {
  const { user } = useAuth();
  const { refreshPendingSessions } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' | 'outgoing' | 'upcoming' | 'past'
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [counterTargetSession, setCounterTargetSession] = useState(null);
  const [reviewTargetSession, setReviewTargetSession] = useState(null);
  const [detailTargetSessionId, setDetailTargetSessionId] = useState(null);
  const [acceptedSessionModal, setAcceptedSessionModal] = useState(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const allSessions = await fetchSessions();
      setSessions(allSessions || []);
      if (refreshPendingSessions) {
        refreshPendingSessions();
      }
    } catch (err) {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [refreshPendingSessions]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Tab filtering logic
  const currentUserId = user?._id?.toString();

  const incomingSessions = sessions.filter(
    (s) => s.status === 'proposed' && s.partner?._id?.toString() === currentUserId
  );

  const outgoingSessions = sessions.filter(
    (s) => s.status === 'proposed' && s.proposer?._id?.toString() === currentUserId
  );

  const upcomingSessions = sessions.filter((s) => s.status === 'accepted');

  const pastSessions = sessions.filter((s) =>
    ['completed', 'declined', 'cancelled', 'countered', 'expired'].includes(s.status)
  );

  const getActiveList = () => {
    switch (activeTab) {
      case 'incoming':
        return incomingSessions;
      case 'outgoing':
        return outgoingSessions;
      case 'upcoming':
        return upcomingSessions;
      case 'past':
        return pastSessions;
      default:
        return [];
    }
  };

  // Action handlers
  const handleStartChat = async (partnerId) => {
    if (!partnerId) return;
    try {
      const conv = await startConversation(partnerId);
      navigate(`/messages?conv=${conv._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to open chat');
    }
  };

  const handleAccept = async (session) => {
    try {
      const res = await acceptSession(session._id);
      toast.success('Session accepted! It is now scheduled in Upcoming.');
      loadSessions();
      setActiveTab('upcoming');

      const partner = session.proposer;
      setAcceptedSessionModal({
        partnerName: partner?.name || 'Partner',
        partnerId: partner?._id,
        conversationId: res?.conversationId,
      });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to accept session');
    }
  };

  const handleDecline = async (id) => {
    try {
      await declineSession(id);
      toast.info('Session proposal declined.');
      loadSessions();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to decline session');
    }
  };

  const handleCancel = async (id) => {
    try {
      await cancelSession(id);
      toast.info('Session cancelled.');
      loadSessions();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel session');
    }
  };

  const handleComplete = async (id) => {
    try {
      const res = await completeSession(id);
      if (res.status === 'completed') {
        toast.success('Session completed by both participants! You can now write a review.');
      } else {
        toast.info('Your completion is confirmed. Waiting for partner confirmation.');
      }
      loadSessions();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to confirm completion');
    }
  };

  const displayedList = getActiveList();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Calendar className="w-7 h-7 text-indigo-400" />
            Sessions & Negotiations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage incoming proposals, counter-proposals, upcoming bookings, and completed reviews.
          </p>
        </div>

        <Link
          to="/matches"
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-all flex items-center gap-1.5"
        >
          Find New Partners <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4 mb-8">
        {[
          { id: 'incoming', label: 'Incoming Proposals', count: incomingSessions.length },
          { id: 'outgoing', label: 'Outgoing Proposals', count: outgoingSessions.length },
          { id: 'upcoming', label: 'Upcoming Bookings', count: upcomingSessions.length },
          { id: 'past', label: 'Past & Completed', count: pastSessions.length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-indigo-500/30 text-indigo-200'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sessions Content */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
          Loading your sessions...
        </div>
      ) : displayedList.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 px-4 rounded-3xl bg-slate-900/40 border border-slate-800 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-100">
            No {activeTab} sessions right now
          </h3>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-sm mx-auto">
            {activeTab === 'incoming' && 'When other users propose sessions with you, they will appear here.'}
            {activeTab === 'outgoing' && 'You have no active pending proposals sent to other users.'}
            {activeTab === 'upcoming' && 'Accepted sessions ready to take place will be scheduled here.'}
            {activeTab === 'past' && 'Completed sessions ready for verified reviews will be archived here.'}
          </p>
        </div>
      ) : (
        /* Sessions List */
        <div className="space-y-4">
          {displayedList.map((session) => {
            const isProposer = session.proposer?._id?.toString() === currentUserId;
            const otherParty = isProposer ? session.partner : session.proposer;
            const startDate = new Date(session.start);
            const endDate = new Date(session.end);
            const isEnded = new Date().getTime() >= endDate.getTime();
            const isStarted = new Date().getTime() >= startDate.getTime();

            // Status colors
            const statusBadgeColors = {
              proposed: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
              accepted: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
              completed: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
              declined: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
              cancelled: 'bg-slate-800 border-slate-700 text-slate-400',
              countered: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
              expired: 'bg-zinc-800 border-zinc-700 text-zinc-400',
            };

            return (
              <div
                key={session._id}
                className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 backdrop-blur-sm"
              >
                {/* Left: Partner & Details */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        statusBadgeColors[session.status] || 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {session.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      ID: <span className="font-mono text-slate-400">{session._id.slice(-6)}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-sm text-white">
                      {otherParty?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/users/${otherParty?._id}`}
                          className="font-bold text-slate-100 hover:text-indigo-400 text-sm transition-colors"
                        >
                          {otherParty?.name}
                        </Link>
                        <span className="text-xs text-slate-500">
                          ({isProposer ? 'Partner' : 'Proposer'})
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-mono text-slate-200">
                          {startDate.toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          • {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Topics traded */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {session.topics?.proposerTeaches && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                        <strong className="text-slate-400">Proposer teaches:</strong>{' '}
                        {session.topics.proposerTeaches.name}
                      </span>
                    )}
                    {session.topics?.partnerTeaches && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                        <strong className="text-slate-400">Partner teaches:</strong>{' '}
                        {session.topics.partnerTeaches.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 md:self-center">
                  {/* View Details / Timeline */}
                  <button
                    onClick={() => setDetailTargetSessionId(session._id)}
                    className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Audit History Timeline"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {/* Message Partner Button */}
                  <button
                    onClick={() => handleStartChat(otherParty?._id)}
                    className="px-3 py-2 rounded-xl font-semibold bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 text-xs transition-all flex items-center gap-1.5 shadow-sm"
                    title={`Message ${otherParty?.name}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Message
                  </button>

                  {/* INCOMING PROPOSALS ACTIONS */}
                  {activeTab === 'incoming' && (
                    <>
                      <button
                        onClick={() => handleAccept(session)}
                        className="px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white text-xs shadow-md shadow-emerald-600/25 transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => setCounterTargetSession(session)}
                        className="px-3.5 py-2 rounded-xl font-semibold bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs transition-all flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Counter
                      </button>
                      <button
                        onClick={() => handleDecline(session._id)}
                        className="px-3.5 py-2 rounded-xl font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs transition-all flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </button>
                    </>
                  )}

                  {/* OUTGOING PROPOSALS ACTIONS */}
                  {activeTab === 'outgoing' && (
                    <button
                      onClick={() => handleCancel(session._id)}
                      className="px-4 py-2 rounded-xl font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs transition-all flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel Proposal
                    </button>
                  )}

                  {/* UPCOMING BOOKINGS ACTIONS */}
                  {activeTab === 'upcoming' && (
                    <>
                      {isEnded ? (
                        <button
                          onClick={() => handleComplete(session._id)}
                          className="px-4 py-2 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Confirm Complete
                        </button>
                      ) : !isStarted ? (
                        <button
                          onClick={() => handleCancel(session._id)}
                          className="px-3.5 py-2 rounded-xl font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs transition-all flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel Session
                        </button>
                      ) : (
                        <span className="text-xs text-amber-400 font-semibold italic">
                          Session In Progress
                        </span>
                      )}
                    </>
                  )}

                  {/* PAST ACTIONS */}
                  {activeTab === 'past' && session.status === 'completed' && (
                    <button
                      onClick={() =>
                        setReviewTargetSession({ session, partner: otherParty })
                      }
                      className="px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white text-xs shadow-md shadow-emerald-600/25 transition-all flex items-center gap-1.5"
                    >
                      <Star className="w-3.5 h-3.5 fill-white" /> Write Review
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Counter Modal */}
      {counterTargetSession && (
        <CounterModal
          session={counterTargetSession}
          onClose={() => setCounterTargetSession(null)}
          onCounterSuccess={loadSessions}
        />
      )}

      {/* Review Modal */}
      {reviewTargetSession && (
        <ReviewModal
          session={reviewTargetSession.session}
          partner={reviewTargetSession.partner}
          onClose={() => setReviewTargetSession(null)}
          onReviewSuccess={loadSessions}
        />
      )}

      {/* Session Details & Timeline Modal */}
      {detailTargetSessionId && (
        <SessionDetailModal
          sessionId={detailTargetSessionId}
          onClose={() => setDetailTargetSessionId(null)}
        />
      )}

      {/* Post-Accept Instant Message Modal */}
      {acceptedSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-100">Session Confirmed! 🎉</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              You have accepted the skill exchange proposal with{' '}
              <strong className="text-slate-200">{acceptedSessionModal.partnerName}</strong>.
              You can text them right away to coordinate the meeting link and discuss what you'll learn!
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  const pId = acceptedSessionModal.partnerId;
                  const cId = acceptedSessionModal.conversationId;
                  setAcceptedSessionModal(null);
                  if (cId) {
                    navigate(`/messages?conv=${cId}`);
                  } else {
                    handleStartChat(pId);
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" /> Message {acceptedSessionModal.partnerName} Now
              </button>
              <button
                onClick={() => setAcceptedSessionModal(null)}
                className="py-2.5 px-4 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
              >
                Stay on Sessions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
