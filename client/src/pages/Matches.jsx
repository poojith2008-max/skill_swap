import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchMatches } from '../api/matches';
import { startConversation } from '../api/conversations';
import { useToast } from '../context/ToastContext';
import ProposeSessionModal from '../components/ProposeSessionModal';
import {
  Sparkles,
  Zap,
  Calendar,
  MessageSquare,
  Clock,
  Star,
  Globe,
  BookOpen,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartnerMatch, setSelectedPartnerMatch] = useState(null);
  const [filterMutualOnly, setFilterMutualOnly] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchMatches();
        setMatches(data || []);
      } catch (err) {
        toast.error('Failed to load partner matches');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleStartChat = async (partnerId) => {
    try {
      const conv = await startConversation(partnerId);
      navigate(`/messages?conv=${conv._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to start chat');
    }
  };

  const filteredMatches = filterMutualOnly
    ? matches.filter((m) => m.isMutual)
    : matches;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-indigo-400" />
            Ranked Skill Matches
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Partners scored by mutual needs, level fit, timezone availability overlap, and reputation.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMutualOnly(!filterMutualOnly)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              filterMutualOnly
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Mutual Matches Only
          </button>
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 animate-pulse space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-800 rounded w-1/2" />
                  <div className="h-3 bg-slate-800 rounded w-1/3" />
                </div>
              </div>
              <div className="h-14 bg-slate-800/60 rounded-xl" />
              <div className="h-8 bg-slate-800/40 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredMatches.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 px-4 rounded-3xl bg-slate-900/40 border border-slate-800 max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-100">No matching partners found</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
            Expand your learning horizons by listing more skills you offer or want in your profile.
          </p>
          <div className="mt-6">
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white text-xs shadow-lg shadow-indigo-600/30 transition-all"
            >
              Update Skills in Profile <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        /* Matches Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMatches.map((match) => {
            const partner = match.user;
            const bayesianRep = partner.reputation?.bayesian
              ? Number(partner.reputation.bayesian).toFixed(1)
              : '3.5';

            return (
              <div
                key={partner._id}
                className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-6 flex flex-col justify-between hover:border-indigo-500/40 transition-all group backdrop-blur-sm relative overflow-hidden shadow-lg"
              >
                {/* Top header */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-base text-white shadow-md">
                        {partner.name.charAt(0)}
                      </div>
                      <div>
                        <Link
                          to={`/users/${partner._id}`}
                          className="font-bold text-base text-slate-100 hover:text-indigo-400 transition-colors block"
                        >
                          {partner.name}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1 text-amber-400 font-semibold">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            {bayesianRep}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Globe className="w-3 h-3 text-slate-500" />
                            {partner.timezone?.split('/')[1] || partner.timezone}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Match Score Badge */}
                    <div className="flex flex-col items-end">
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                        {Math.round(match.score)} pts
                      </span>
                    </div>
                  </div>

                  {/* Mutual Match Banner */}
                  {match.isMutual ? (
                    <div className="mb-4 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950/70 to-teal-950/70 border border-emerald-500/30 flex items-center gap-2 text-xs font-semibold text-emerald-300 shadow-sm">
                      <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 shrink-0" />
                      <span>Mutual Skill Match!</span>
                    </div>
                  ) : (
                    <div className="mb-4 px-3 py-1.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center gap-2 text-xs text-slate-400">
                      <span>One-way match</span>
                    </div>
                  )}

                  {/* Explanation text */}
                  <p className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 leading-relaxed mb-4">
                    {match.explanation}
                  </p>

                  {/* Skills breakdown */}
                  <div className="space-y-2 mb-4 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium block mb-1">They can teach you:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {match.candidateTeachesSkills?.length > 0 ? (
                          match.candidateTeachesSkills.map((s, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-500/20 text-indigo-300 font-medium text-[11px]"
                            >
                              {s.skill?.name || 'Skill'} ({s.level})
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">No direct matches</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 font-medium block mb-1">You can teach them:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {match.targetTeachesSkills?.length > 0 ? (
                          match.targetTeachesSkills.map((s, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-violet-950/60 border border-violet-500/20 text-violet-300 font-medium text-[11px]"
                            >
                              {s.skill?.name || 'Skill'} ({s.level})
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">No direct matches</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Overlapping schedule slots */}
                  {match.sharedSlots?.length > 0 && (
                    <div className="mb-4">
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mb-1.5">
                        <Clock className="w-3 h-3" /> Shared Free Slots:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {match.sharedSlots.slice(0, 2).map((slot, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800 text-slate-300 font-mono"
                          >
                            {slot.label}
                          </span>
                        ))}
                        {match.sharedSlots.length > 2 && (
                          <span className="text-[10px] text-slate-500 self-center">
                            +{match.sharedSlots.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-800/80 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPartnerMatch({ partner, matchData: match })}
                    className="flex-1 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5" /> Propose Session
                  </button>

                  <button
                    onClick={() => handleStartChat(partner._id)}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                    title="Send message"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Propose Session Modal */}
      {selectedPartnerMatch && (
        <ProposeSessionModal
          partner={selectedPartnerMatch.partner}
          matchData={selectedPartnerMatch.matchData}
          onClose={() => setSelectedPartnerMatch(null)}
        />
      )}
    </div>
  );
}
