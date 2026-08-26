import React from 'react';
import { Building2, User, LogOut, ShieldCheck, GraduationCap } from 'lucide-react';

export default function Navbar({ currentUser, onLogout, onToggleRole }) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Institution */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold text-base leading-tight tracking-tight flex items-center gap-2">
              NIT Raipur 
            </div>
            <div className="text-xs text-slate-400">Room Allocation & Scheduling</div>
          </div>
        </div>

        {/* User Info & Actions */}
        {currentUser ? (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl">
              {currentUser.role === 'HOD' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <GraduationCap className="w-4 h-4 text-indigo-400" />
              )}
              <div className="text-xs">
                <div className="font-semibold text-slate-200">{currentUser.name}</div>
                <div className="text-slate-400 text-[11px]">{currentUser.role === 'HOD' ? 'Head of Department' : 'Faculty Member'}</div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-medium">
            Authorized Personnel Only
          </div>
        )}

      </div>
    </header>
  );
}