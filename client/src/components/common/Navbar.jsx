import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, LogOut, ShieldCheck, GraduationCap } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();

  // Helper function to generate avatar initials (e.g., "Rajesh Verma" -> "RV")
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

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
        {user ? (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl">
              
              {/* Initials Avatar */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                user.role === 'HOD' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'
              }`}>
                {getInitials(user.name)}
              </div>

              <div className="text-xs pr-2">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  {user.name}
                  {user.role === 'HOD' ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                </div>
                {/* Department display */}
                <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">
                  {user.role} • {user.department}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
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