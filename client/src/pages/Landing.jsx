import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  MessageSquare,
  Users,
  Star,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-gradient-to-b from-indigo-900/20 via-violet-900/10 to-transparent pointer-events-none blur-3xl -z-10" />

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Peer-to-Peer Knowledge Marketplace</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            Trade Skills{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
              Hour for Hour.
            </span>{' '}
            Learn Anything for Free.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-slate-400 leading-relaxed font-normal max-w-2xl">
            You teach Guitar, they teach Python. No expensive tutors, no awkward cold-messages.
            SkillSwap matches your availability across timezones and verifies credibility through
            Bayesian reputation.
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            {user ? (
              <Link
                to="/matches"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-105"
              >
                Go to Matches Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-105"
                >
                  Join SkillSwap Free <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-all hover:border-slate-700"
                >
                  Explore Demo Account
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-24">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Mutual-Match Engine</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Proprietary matching algorithm scores cross-skill wants (+50 mutual bonus), level fit,
              and converts multi-timezone schedules into precise overlapping UTC intervals.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-violet-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Conflict-Free State Machine</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Negotiate sessions with proposal, counter-proposal, and auto-expiry logic. Atomic checks
              guarantee neither user gets double-booked.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Verified Bayesian Reputation</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Reviews can only be given after both parties verify completion. Bayesian averaging
              prevents single-review rating spoofing and rewards consistent teachers.
            </p>
          </div>
        </div>

        {/* How it works workflow */}
        <section className="pt-28">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
              How SkillSwap Works in 4 Steps
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              From listing what you know to verified peer learning sessions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Set Skills & Times',
                desc: 'Add what you teach, what you want to learn, and your weekly availability slots.',
              },
              {
                step: '02',
                title: 'Match & Discover',
                desc: 'See ranked partners with mutual-match badges and pre-calculated overlapping hours.',
              },
              {
                step: '03',
                title: 'Propose & Agree',
                desc: 'Pick an overlapping time slot, negotiate with counter-proposals, and lock in the session.',
              },
              {
                step: '04',
                title: 'Exchange & Review',
                desc: 'Meet, exchange knowledge, confirm completion together, and leave verified reviews.',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <span className="text-2xl font-black text-indigo-500/80 font-mono block mb-3">
                    {s.step}
                  </span>
                  <h4 className="text-base font-bold text-slate-100 mb-1">{s.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 SkillSwap. Community Skill Exchange Marketplace.</p>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-slate-300">Sign In</Link>
            <Link to="/register" className="hover:text-slate-300">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
