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
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & NIT Raipur Official Logo (Top Left Corner) */}
        <Link
          to="/"
          className="flex items-center space-x-3 group transition-transform active:scale-95"
        >
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-slate-700/80 p-1 flex items-center justify-center group-hover:border-indigo-400 group-hover:bg-white/20 transition-all flex-shrink-0 shadow-sm">
            <img
              src={nitrrLogo}
              alt="NIT Raipur Logo"
              className="w-full h-full object-contain drop-shadow"
            />
          </div>
          <div>
            <div className="font-bold text-base leading-tight tracking-tight flex items-center gap-1.5 text-white">
              <span>NIT Raipur</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xs text-slate-400">Room Allocation & Scheduling</div>
          </div>
        </Link>

        {/* User Status & Navigation Actions */}
        {currentUser ? (
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notification Bell Link */}
            <Link
              to="/notifications"
              className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-extrabold rounded-full px-1 flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Profile / Role Badge */}
            <div className="hidden sm:flex items-center gap-2.5 bg-slate-800/80 border border-slate-700/80 px-3.5 py-1.5 rounded-xl">
              {currentUser.role === 'HOD' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <GraduationCap className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              )}
              <div className="text-xs leading-tight">
                <div className="font-bold text-slate-200 truncate max-w-[140px]">
                  {currentUser.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  {currentUser.role === 'HOD' ? 'Department Head' : 'Faculty Member'}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-rose-950/60 hover:border-rose-800/60 border border-slate-700 rounded-xl transition-all active:scale-95"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-medium">Authorized Personnel Only</div>
        )}
      </div>
    </header>
  );
}