import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Sparkles,
  Layers,
  Calendar,
  MessageSquare,
  User,
  LogOut,
  Bell,
  Check,
  Menu,
  X,
  Star,
  Clock,
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const {
    connected,
    notifications,
    unreadCount,
    unreadMessagesCount,
    pendingSessionsCount,
    markRead,
    markAllRead,
  } = useSocket();
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { name: 'Matches', path: '/matches', icon: Sparkles },
    {
      name: 'Sessions',
      path: '/sessions',
      icon: Calendar,
      badge: pendingSessionsCount > 0 ? pendingSessionsCount : null,
      badgeColor: 'bg-amber-500 text-slate-950 shadow-amber-500/30',
      badgeLabel: 'New Proposals',
    },
    {
      name: 'Messages',
      path: '/messages',
      icon: MessageSquare,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : null,
      badgeColor: 'bg-indigo-500 text-white shadow-indigo-500/30',
      badgeLabel: 'Unread Messages',
    },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to={user ? '/matches' : '/'} className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
              SkillSwap
            </span>
            <span className="text-[10px] text-indigo-400 font-medium tracking-wider uppercase -mt-1">
              Peer Exchange
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        {user ? (
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="relative flex items-center">
                    <Icon className="w-4 h-4" />
                    {item.badge && (
                      <span
                        className={`absolute -top-2 -right-2.5 px-1.5 py-0.2 min-w-[17px] h-4 rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-lg animate-pulse ${item.badgeColor}`}
                        title={`${item.badge} ${item.badgeLabel}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        ) : null}

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Socket connectivity indicator */}
          {user && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border bg-slate-900/80 border-slate-800"
              title={connected ? 'Connected to real-time engine' : 'Reconnecting...'}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-400 text-[11px]">{connected ? 'Live' : 'Connecting'}</span>
            </div>
          )}

          {user ? (
            <>
              {/* Notifications Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent hover:border-slate-800 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center animate-bounce">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 px-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-200">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                      {notifications.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">
                          No notifications yet
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n._id}
                            onClick={() => !n.read && markRead(n._id)}
                            className={`p-3 rounded-xl transition-colors cursor-pointer text-xs ${
                              n.read
                                ? 'bg-slate-950/40 text-slate-400 hover:bg-slate-800/40'
                                : 'bg-indigo-950/30 border border-indigo-500/20 text-slate-200 hover:bg-indigo-900/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-slate-200">{n.title}</p>
                              {!n.read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 shrink-0" />
                              )}
                            </div>
                            <p className="mt-1 text-slate-400 leading-relaxed">{n.message}</p>
                            <span className="text-[10px] text-slate-500 mt-1.5 block">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User avatar & reputation */}
              <Link
                to={`/users/${user._id}`}
                className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-xs text-white">
                  {user.name.charAt(0)}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200 leading-tight">
                    {user.name.split(' ')[0]}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                    <span>{user.reputation?.bayesian ? Number(user.reputation.bayesian).toFixed(1) : '3.5'}</span>
                  </div>
                </div>
              </Link>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Log out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900/60 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/25 transition-all"
              >
                Get Started
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          {user && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile nav drawer */}
      {user && mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 pt-3 pb-5 space-y-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold shadow-md animate-pulse ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
