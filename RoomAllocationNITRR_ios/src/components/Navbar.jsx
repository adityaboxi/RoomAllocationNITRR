import React from 'react';
import { Link } from 'react-router-dom';
import {
  LogOut,
  ShieldCheck,
  GraduationCap,
  Bell,
  Sparkles,
} from 'lucide-react';
import nitrrLogo from '../assets/nitrr_new_logo_new.png';

export default function Navbar({
  currentUser,
  onLogout,
  notifications = [],
  onClearNotifications,
}) {
  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n) => !n.read).length
    : 0;

  return (
    <header
      className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm transition-all"
      style={{
        /* 👈 Explicit 54px clearance below iPhone 15 Dynamic Island */
        paddingTop: 'max(env(safe-area-inset-top), 54px)',
        paddingBottom: '10px',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
        {/* Brand & NIT Raipur Official Logo */}
        <Link
          to="/"
          className="flex items-center space-x-2.5 ios-tap"
        >
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-slate-700/80 p-1 flex items-center justify-center flex-shrink-0 shadow-sm">
            <img
              src={nitrrLogo}
              alt="NIT Raipur Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight flex items-center gap-1 text-white">
              <span>NIT Raipur</span>
              <Sparkles className="w-3 h-3 text-indigo-400" />
            </div>
            <div className="text-[10px] text-slate-400">Room Allocation</div>
          </div>
        </Link>

        {/* User Actions */}
        {currentUser ? (
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <Link
              to="/notifications"
              className="relative p-2 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700/60 ios-tap"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-rose-500 text-white text-[9px] font-extrabold rounded-full px-1 flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700/60 rounded-xl ios-tap"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-[11px]">Logout</span>
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 font-medium">NIT Raipur Portal</div>
        )}
      </div>
    </header>
  );
}