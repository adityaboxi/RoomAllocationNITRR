import React, { useState } from 'react';
import {
  Building2,
  GraduationCap,
  ShieldCheck,
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  CalendarCheck,
  Zap,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';

// API base URL – change or use env var
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function AuthPage({ onLoginSuccess }) {
  // ---------- NAVIGATION ----------
  const [view, setView] = useState('login'); // 'login' | 'signup' | 'forgot' | 'verify-otp' | 'reset-password'
  const [role, setRole] = useState('FACULTY');

  // ---------- FORM STATE ----------
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',      // used for signup only
    newPassword: '',          // used for reset-password step
    confirmNewPassword: '',   // used for reset-password step
    department: 'cs',
  });

  // ---------- OTP & RESET TOKEN ----------
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [emailForReset, setEmailForReset] = useState('');

  // ---------- UI HELPERS ----------
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // ---------- DEPARTMENTS ----------
  const departments = [
    { code: 'cs', name: 'Computer Science & Engineering (CSE)' },
    { code: 'it', name: 'Information Technology (IT)' },
    { code: 'ec', name: 'Electronics & Communication (ECE)' },
    { code: 'ee', name: 'Electrical Engineering (EE)' },
    { code: 'me', name: 'Mechanical Engineering (ME)' },
    { code: 'ce', name: 'Civil Engineering (CE)' },
    { code: 'ch', name: 'Chemical Engineering (CHE)' },
    { code: 'bt', name: 'Biotechnology (BT)' },
    { code: 'mm', name: 'Metallurgical & Materials (MME)' },
    { code: 'mi', name: 'Mining Engineering (MIN)' },
  ];

  // ---------- HANDLERS ----------
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const evaluatePasswordStrength = (pass) => {
    let score = 0;
    if (!pass) return { score: 0, label: '', color: 'bg-slate-200' };
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (score <= 3) return { score: 2, label: 'Medium', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };
  const passwordStrength = evaluatePasswordStrength(formData.password);

  // ---------- MAIN SUBMIT (login, signup, forgot) ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // ========== NEW EMAIL VALIDATION: only @gmail.com ==========
    if (!formData.email.endsWith('@gmail.com')) {
      setError('Only @gmail.com email addresses are allowed for testing.');
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // --- LOGIN ---
      if (view === 'login') {
        if (!formData.password) {
          setError('Please enter your password.');
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Login failed');
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        if (onLoginSuccess) onLoginSuccess(data.user);
        return;
      }

      // --- SIGNUP ---
      if (view === 'signup') {
        if (!formData.name) {
          setError('Please enter your full name.');
          setLoading(false);
          return;
        }
        if (formData.password.length < 8) {
          setError('Password must be at least 8 characters long.');
          setLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            confirmPassword: formData.confirmPassword,
            department: formData.department,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Signup failed');
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        if (onLoginSuccess) onLoginSuccess(data.user);
        return;
      }

      // --- FORGOT PASSWORD (step 1) ---
      if (view === 'forgot') {
        const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
        setEmailForReset(formData.email);
        setSuccessMsg(data.message || 'OTP sent to your email (check console).');
        setView('verify-otp');
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- VERIFY OTP (step 2) ----------
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailForReset, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'OTP verification failed');
      setResetToken(data.resetToken);
      setSuccessMsg('OTP verified! Set your new password.');
      setView('reset-password');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- RESET PASSWORD (step 3) ----------
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const { newPassword, confirmNewPassword } = formData;
    if (!newPassword || !confirmNewPassword) {
      setError('Please fill in both password fields.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailForReset,
          resetToken,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Password reset failed');
      setSuccessMsg('✅ Password reset successfully! Please login.');
      setFormData({ ...formData, password: '', newPassword: '', confirmNewPassword: '' });
      setView('login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- NAVIGATION HELPERS ----------
  const goBack = (targetView) => {
    setView(targetView);
    setError('');
    setSuccessMsg('');
  };

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* ---- LEFT SIDE: BRAND ---- */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wide mb-6">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Official Institutional Portal</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight leading-none">NIT Raipur</h2>
                <span className="text-xs text-slate-400">Department Room Allocation</span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-6 leading-snug">
              Smart Room Booking System
            </h1>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              Real-time room occupancy, master timetable integration, and first-come first-served ad-hoc slot reservation.
            </p>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-800/80 space-y-3 relative z-10">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <span>Instant slot reservation with collision prevention</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-indigo-400 flex-shrink-0">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <span>HOD-managed master class timetable sync</span>
            </div>
          </div>
        </div>

        {/* ---- RIGHT SIDE: FORMS ---- */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-10 flex flex-col justify-center">
          {/* Error / Success */}
          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start text-rose-800 text-xs sm:text-sm font-medium">
              <ShieldAlert className="w-5 h-5 mr-2 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start text-emerald-800 text-xs sm:text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>{successMsg}</div>
            </div>
          )}

          {/* ----- LOGIN / SIGNUP ----- */}
          {(view === 'login' || view === 'signup') && (
            <div>
              {/* Role Selector */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Select Authorization Role</span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Active: <strong className={role === 'HOD' ? 'text-emerald-700' : 'text-indigo-700'}>{role}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setRole('FACULTY'); setError(''); }}
                    className={`relative flex items-center p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                      role === 'FACULTY'
                        ? 'border-indigo-600 bg-indigo-50/80 shadow-sm ring-2 ring-indigo-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-2.5 flex-shrink-0 ${
                      role === 'FACULTY' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className={`text-sm font-bold leading-tight ${role === 'FACULTY' ? 'text-indigo-950' : 'text-slate-800'}`}>
                        Faculty
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Book free slots</div>
                    </div>
                    {role === 'FACULTY' && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-indigo-100" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRole('HOD'); setError(''); }}
                    className={`relative flex items-center p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                      role === 'HOD'
                        ? 'border-emerald-600 bg-emerald-50/80 shadow-sm ring-2 ring-emerald-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-2.5 flex-shrink-0 ${
                      role === 'HOD' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className={`text-sm font-bold leading-tight ${role === 'HOD' ? 'text-emerald-950' : 'text-slate-800'}`}>
                        HOD
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Manage schedule</div>
                    </div>
                    {role === 'HOD' && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-emerald-100" />
                    )}
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }}
                  className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                    view === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setView('signup'); setError(''); setSuccessMsg(''); }}
                  className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                    view === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Register Account
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {view === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name & Title</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Dr. D. S. Sisodia"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      {role === 'HOD' ? 'HOD Email' : 'Faculty Email'}
                    </label>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      role === 'HOD' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {role === 'HOD' ? 'HOD' : 'FACULTY'}
                    </span>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder={role === 'HOD' ? 'hod.cs@gmail.com' : 'test.cs@gmail.com'}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Only <strong className="text-indigo-700">@gmail.com</strong> addresses are allowed for testing.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                  >
                    {departments.map((d) => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    {view === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setView('forgot'); setError(''); setSuccessMsg(''); }}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {view === 'signup' && formData.password && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-400">Strength:</span>
                        <span className="font-semibold text-slate-600">{passwordStrength.label}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1">
                        <div className={`h-full flex-1 rounded-full ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-slate-200'}`} />
                        <div className={`h-full flex-1 rounded-full ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-slate-200'}`} />
                        <div className={`h-full flex-1 rounded-full ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-slate-200'}`} />
                      </div>
                    </div>
                  )}
                </div>

                {view === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-3 flex items-center justify-center py-3 px-4 rounded-xl text-white bg-slate-950 hover:bg-slate-800 font-bold text-sm shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">...</svg>
                      Processing...
                    </span>
                  ) : (
                    <>
                      <span>{view === 'login' ? `Sign In as ${role}` : `Register & Enter Portal`}</span>
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ----- FORGOT PASSWORD (step 1) ----- */}
          {view === 'forgot' && (
            <div>
              <button
                type="button"
                onClick={() => goBack('login')}
                className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 mb-6"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Sign In
              </button>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter your <strong>@gmail.com</strong> email to receive reset instructions.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address (@gmail.com)</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="test.cs@gmail.com"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl text-white bg-slate-950 hover:bg-slate-800 font-bold text-sm shadow-md transition-all"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </div>
          )}

          {/* ----- VERIFY OTP (step 2) ----- */}
          {view === 'verify-otp' && (
            <div>
              <button
                type="button"
                onClick={() => goBack('forgot')}
                className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 mb-6"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </button>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Verify OTP</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter the 6‑digit code sent to <span className="font-medium text-slate-700">{emailForReset}</span>
                </p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">OTP Code</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      maxLength="6"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Valid for 5 minutes</p>
                </div>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-3 px-4 rounded-xl text-white bg-slate-950 hover:bg-slate-800 font-bold text-sm shadow-md transition-all disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>
            </div>
          )}

          {/* ----- RESET PASSWORD (step 3) ----- */}
          {view === 'reset-password' && (
            <div>
              <button
                type="button"
                onClick={() => goBack('verify-otp')}
                className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 mb-6"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </button>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Set New Password</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Choose a strong password for your account.
                </p>
              </div>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      name="confirmNewPassword"
                      value={formData.confirmNewPassword}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl text-white bg-slate-950 hover:bg-slate-800 font-bold text-sm shadow-md transition-all disabled:opacity-50"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}