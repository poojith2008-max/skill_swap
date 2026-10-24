import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchUserProfile, fetchUserReviews } from '../api/users';
import { startConversation } from '../api/conversations';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  User,
  Star,
  Globe,
  BookOpen,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Calendar,
  Clock,
} from 'lucide-react';

export default function PublicProfile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [reviewsData, setReviewsData] = useState({ reviews: [], count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [userData, revData] = await Promise.all([
          fetchUserProfile(id),
          fetchUserReviews(id),
        ]);
        setProfile(userData);
        setReviewsData(revData);
      } catch (err) {
        toast.error('Failed to load user profile or reviews');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const handleStartChat = async () => {
    try {
      const conv = await startConversation(id);
      navigate(`/messages?conv=${conv._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Cannot start chat with this user');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-xs text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
        Loading member profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-slate-100">User Not Found</h2>
        <p className="text-xs text-slate-400 mt-2">The member profile you requested does not exist.</p>
        <Link
          to="/matches"
          className="inline-block mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
        >
          Back to Matches
        </Link>
      </div>
    );
  }

  const isMe = currentUser?._id?.toString() === profile._id?.toString();
  const bayesianRating = profile.reputation?.bayesian
    ? Number(profile.reputation.bayesian).toFixed(1)
    : '3.5';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Profile Header Card */}
      <div className="p-8 rounded-3xl bg-slate-900/70 border border-slate-800 backdrop-blur-md shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-extrabold text-3xl text-white shadow-xl shadow-indigo-500/20">
              {profile.name.charAt(0)}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-slate-100">{profile.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                  Verified Member
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5">
                <span className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                  <Star className="w-4 h-4 fill-amber-400" />
                  {bayesianRating}
                </span>
                <span>•</span>
                <span className="text-slate-400">
                  {profile.reputation?.count || 0} verified review
                  {(profile.reputation?.count || 0) !== 1 ? 's' : ''}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  {profile.timezone}
                </span>
              </div>
            </div>
          </div>

          {!isMe && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleStartChat}
                className="px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" /> Message
              </button>
            </div>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mt-6 pt-6 border-t border-slate-800 text-sm text-slate-300 leading-relaxed">
            {profile.bio}
          </div>
        )}
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Skills Offered */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" /> Skills Offered
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.skillsOffered?.length === 0 ? (
              <span className="text-xs text-slate-500 italic">No skills listed</span>
            ) : (
              profile.skillsOffered?.map((item, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-lg bg-indigo-950/60 border border-indigo-500/20 text-indigo-200 text-xs font-medium flex items-center gap-1.5"
                >
                  <span>{item.skill?.name || 'Skill'}</span>
                  <span className="text-[10px] uppercase font-bold text-indigo-400">
                    ({item.level})
                  </span>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Skills Wanted */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" /> Skills Wanted
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.skillsWanted?.length === 0 ? (
              <span className="text-xs text-slate-500 italic">No skills listed</span>
            ) : (
              profile.skillsWanted?.map((item, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-lg bg-violet-950/60 border border-violet-500/20 text-violet-200 text-xs font-medium"
                >
                  {item.skill?.name || 'Skill'}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Verified Reviews Section */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Verified Reviews & Feedback
          </h3>
          <span className="text-xs text-slate-500">
            Bayesian Weighting Applied (Prior: 3.5 ★, C=5)
          </span>
        </div>

        {reviewsData.reviews?.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No completed reviews yet for this user.
          </div>
        ) : (
          <div className="space-y-4">
            {reviewsData.reviews?.map((rev) => (
              <div
                key={rev._id}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-200">
                      {rev.reviewer?.name}
                    </span>
                    <span className="text-slate-600">•</span>
                    <div className="flex items-center text-amber-400">
                      {[...Array(rev.rating)].map((_, r) => (
                        <Star key={r} className="w-3 h-3 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(rev.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {rev.comment && (
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "{rev.comment}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
