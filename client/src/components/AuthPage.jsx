import React, { useState, useEffect } from 'react';
import {
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
  Clock,
  Loader2,
} from 'lucide-react';
import {
  getDepartments,
  login as apiLogin,
  sendSignupOtp as apiSendSignupOtp,
  verifySignupOtp as apiVerifySignupOtp,
  forgotPassword as apiForgotPassword,
  verifyResetOtp as apiVerifyResetOtp,
  resetPassword as apiResetPassword,
} from '../services/api';
import nitrrLogo from '../assets/nitrr_new_logo_new.png';

// Safe error extractor helper
const extractErrorMessage = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err.response?.data?.message || err.message || fallback;
};

export default function AuthPage({ onLoginSuccess }) {
  const [view, setView] = useState('login');
  const [role, setRole] = useState('FACULTY');

  // 100% Dynamic: Starts empty, strictly relies on the Backend .env
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    newPassword: '',
    confirmNewPassword: '',
    department: '',
  });

  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [emailForReset, setEmailForReset] = useState('');
  const [otpPurpose, setOtpPurpose] = useState(null);
  const [otpTimer, setOtpTimer] = useState(300);
  const [resending, setResending] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch dynamic departments directly from the Backend API on mount
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await getDepartments();
        const deptList = (res?.data || []).map((d) => (typeof d === 'string' ? { code: d, name: d } : d));
        
        if (deptList.length > 0) {
          setDepartments(deptList);
          setFormData((prev) => ({
            ...prev,
            department: deptList[0].code, // Auto-select the first backend branch
          }));
        }
      } catch (err) {
        setError('Failed to load department branches from the server. Please refresh.');
      } finally {
        setLoadingDepts(false);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    let interval = null;
    if (view === 'verify-otp' && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [view, otpTimer]);

  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setSuccessMsg('');
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

  // ============================================
  // STRICT ROLE-BASED EMAIL VALIDATION
  // ============================================
  const validateEmailByRole = (email, selectedRole) => {
    const cleanEmail = email.trim().toLowerCase();
    
    // Basic format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return false;
    }

    if (selectedRole === 'ADMIN') {
      return true; // Admin can use ANY valid email domain
    }

    // STRICT DOMAIN CHECK: Faculty & HOD must end with nitrr.ac.in
    return cleanEmail.endsWith('nitrr.ac.in');
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = formData.email.trim().toLowerCase();

    // Enforce role-based email rules (skip for forgot-password – server validates user existence)
    if (view !== 'forgot' && !validateEmailByRole(cleanEmail, role)) {
      if (role === 'ADMIN') {
        setError('Please enter a valid email address.');
      } else {
        setError(`Access Denied: ${role} accounts must use an institutional .nitrr.ac.in email address.`);
      }
      return;
    }

    setLoading(true);

    try {
      if (view === 'login') {
        if (!formData.password) {
          setError('Please enter your account password.');
          setLoading(false);
          return;
        }

        const data = await apiLogin(cleanEmail, formData.password, role);

        if (!data.success) throw new Error(data.message || 'Login failed. Please verify your credentials.');

        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        if (onLoginSuccess) onLoginSuccess(data.user);
        return;
      }

      if (view === 'signup') {
        if (!formData.name.trim()) {
          setError('Please enter your full name & academic title.');
          setLoading(false);
          return;
        }
        if (!formData.department) {
          setError('Please select a valid department.');
          setLoading(false);
          return;
        }
        if (formData.password.length < 8) {
          setError('Password must be at least 8 characters long.');
          setLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match. Please re-enter your password.');
          setLoading(false);
          return;
        }

        const data = await apiSendSignupOtp({
          name: formData.name.trim(),
          email: cleanEmail,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          department: formData.department,
          role,
        });

        setEmailForReset(cleanEmail);
        setOtpPurpose('signup');
        setOtpTimer(300);
        setSuccessMsg(data.message || 'Verification OTP sent! Please check your email inbox.');
        setView('verify-otp');
        setLoading(false);
        return;
      }

      if (view === 'forgot') {
        const data = await apiForgotPassword(cleanEmail);

        setEmailForReset(cleanEmail);
        setOtpPurpose('forgot');
        setOtpTimer(300);
        setSuccessMsg(data.message || 'Password reset code sent! Please check your email inbox.');
        setView('verify-otp');
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Authentication request failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (otp.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      setLoading(false);
      return;
    }

    try {
      let data;

      if (otpPurpose === 'signup') {
        data = await apiVerifySignupOtp(emailForReset, otp);
      } else if (otpPurpose === 'forgot') {
        data = await apiVerifyResetOtp(emailForReset, otp);
      } else {
        throw new Error('Verification session expired. Please start over.');
      }

      if (otpPurpose === 'signup') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        if (onLoginSuccess) onLoginSuccess(data.user);
      } else {
        setResetToken(data.resetToken);
        setSuccessMsg('OTP verified successfully! Please choose your new password.');
        setView('reset-password');
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'OTP verification failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setResending(true);
    try {
      if (otpPurpose === 'signup') {
        await apiSendSignupOtp({
          name: formData.name,
          email: emailForReset,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          department: formData.department,
          role,
        });
      } else {
        await apiForgotPassword(emailForReset);
      }

      setOtpTimer(300);
      setSuccessMsg('A fresh verification code has been dispatched to your email.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to resend OTP. Please try again.'));
    } finally {
      setResending(false);
    }
  };

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
      setError('New passwords do not match. Please re-type carefully.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiResetPassword(emailForReset, resetToken, newPassword, confirmNewPassword);

      setSuccessMsg('Password updated successfully! Please sign in with your new password.');
      setFormData((prev) => ({
        ...prev,
        password: '',
        confirmPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      }));
      setView('login');
    } catch (err) {
      setError(extractErrorMessage(err, 'Password reset failed.'));
    } finally {
      setLoading(false);
    }
  };

  const goBack = (targetView) => {
    setView(targetView);
    setError('');
    setSuccessMsg('');
    setOtpPurpose(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* ---- LEFT BRANDING PANEL WITH OFFICIAL LOGO ---- */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wide mb-6">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>National Institute of Technology Raipur</span>
            </div>
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 p-1.5 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-600/30 flex-shrink-0">
                <img
                  src={nitrrLogo}
                  alt="NIT Raipur Logo"
                  className="w-full h-full object-contain drop-shadow"
                />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight leading-none">NIT Raipur</h2>
                <span className="text-xs text-slate-400">Department Room Allocation</span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-6 leading-snug">
              Smart Room Booking Portal
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

        {/* ---- RIGHT AUTH FORMS PANEL ---- */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-10 flex flex-col justify-center">
          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start text-rose-800 text-xs sm:text-sm font-medium animate-fadeIn">
              <ShieldAlert className="w-5 h-5 mr-2 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-line">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start text-emerald-800 text-xs sm:text-sm font-medium animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-line">{successMsg}</div>
            </div>
          )}

          {/* VIEW: LOGIN & SIGNUP */}
          {(view === 'login' || view === 'signup') && (
            <div>
              {/* Role Selector */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Authorization Role
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Selected:{' '}
                    <strong className={
                      role === 'HOD' ? 'text-emerald-700' : 
                      role === 'ADMIN' ? 'text-purple-700' : 
                      'text-indigo-700'
                    }>
                      {role}
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('FACULTY');
                      setError('');
                    }}
                    className={`relative flex items-center p-2.5 sm:p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                      role === 'FACULTY'
                        ? 'border-indigo-600 bg-indigo-50/80 shadow-sm ring-2 ring-indigo-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center mr-2 flex-shrink-0 ${
                        role === 'FACULTY'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <div
                        className={`text-xs sm:text-sm font-bold leading-tight ${
                          role === 'FACULTY' ? 'text-indigo-950' : 'text-slate-800'
                        }`}
                      >
                        Faculty
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 hidden sm:block">Book slots</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('HOD');
                      setError('');
                    }}
                    className={`relative flex items-center p-2.5 sm:p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                      role === 'HOD'
                        ? 'border-emerald-600 bg-emerald-50/80 shadow-sm ring-2 ring-emerald-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center mr-2 flex-shrink-0 ${
                        role === 'HOD'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div
                        className={`text-xs sm:text-sm font-bold leading-tight ${
                          role === 'HOD' ? 'text-emerald-950' : 'text-slate-800'
                        }`}
                      >
                        HOD
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 hidden sm:block">Schedule</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('ADMIN');
                      setError('');
                    }}
                    className={`relative flex items-center p-2.5 sm:p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                      role === 'ADMIN'
                        ? 'border-purple-600 bg-purple-50/80 shadow-sm ring-2 ring-purple-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center mr-2 flex-shrink-0 ${
                        role === 'ADMIN'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <div
                        className={`text-xs sm:text-sm font-bold leading-tight ${
                          role === 'ADMIN' ? 'text-purple-950' : 'text-slate-800'
                        }`}
                      >
                        Admin
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 hidden sm:block">Inventory</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Form Mode Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setError('');
                    setSuccessMsg('');
                    setOtpPurpose(null);
                  }}
                  className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                    view === 'login'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView('signup');
                    setError('');
                    setSuccessMsg('');
                    setOtpPurpose(null);
                  }}
                  className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                    view === 'signup'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Register Account
                </button>
              </div>

              {view === 'signup' && role === 'ADMIN' ? (
                <div className="text-center p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                  <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-900 mb-1">System Admin Account</h3>
                  <p className="text-xs text-slate-500">
                    Administrator accounts are provisioned via system variables. Please use the Sign In tab.
                  </p>
                  <button
                    type="button"
                    onClick={() => setView('login')}
                    className="mt-4 px-4 py-2 bg-slate-950 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-md transition-all"
                  >
                    Go to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {view === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name & Title *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Dr. Rajesh Kumar"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Email Address *
                    </label>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-800'
                          : role === 'HOD'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {role}
                    </span>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder={
                        role === 'ADMIN' ? 'admin@anydomain.com' : 
                        role === 'HOD' ? 'hod@nitrr.ac.in' : 
                        'faculty@nitrr.ac.in'
                      }
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      required
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {role === 'ADMIN' ? (
                      <>Supported: <strong className="text-slate-600">Any valid email</strong></>
                    ) : (
                      <>Supported: <strong className="text-slate-600">.nitrr.ac.in</strong> domains only</>
                    )}
                  </span>
                </div>

                {view === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Department / Branch *
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      disabled={loadingDepts}
                      className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all disabled:opacity-50"
                    >
                      {loadingDepts ? (
                        <option value="">Loading branches...</option>
                      ) : (
                        departments.map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Password *</label>
                    {view === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setView('forgot');
                          setError('');
                          setSuccessMsg('');
                          setOtpPurpose('forgot');
                        }}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
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
                      required
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
                        <span className="font-semibold text-slate-600">
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1">
                        <div
                          className={`h-full flex-1 rounded-full ${
                            passwordStrength.score >= 1 ? passwordStrength.color : 'bg-slate-200'
                          }`}
                        />
                        <div
                          className={`h-full flex-1 rounded-full ${
                            passwordStrength.score >= 2 ? passwordStrength.color : 'bg-slate-200'
                          }`}
                        />
                        <div
                          className={`h-full flex-1 rounded-full ${
                            passwordStrength.score >= 3 ? passwordStrength.color : 'bg-slate-200'
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {view === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-3 flex items-center justify-center py-3 px-4 rounded-xl text-white bg-slate-950 hover:bg-slate-800 font-bold text-sm shadow-md transition-all active:scale-[0.99] disabled:opacity-50 gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 text-white" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {view === 'login' ? `Sign In as ${role}` : `Register & Enter Portal`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
              )}
            </div>
          )}

          {/* VIEW: FORGOT PASSWORD */}
          {view === 'forgot' && (
            <div>
              <button
                type="button"
                onClick={() => goBack('login')}
                className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 mb-6 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Sign In
              </button>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Reset Account Password</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter your registered institutional email to receive a 6-digit verification code.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="faculty@nitrr.ac.in"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl text-white bg-slate-950 hover:bg-slate-800 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* VIEW: VERIFY OTP */}
          {view === 'verify-otp' && (
            <div>
              <button
                type="button"
                onClick={() => {
                  if (otpPurpose === 'signup') {
                    goBack('signup');
                  } else {
                    goBack('forgot');
                  }
                }}
                className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 mb-6 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </button>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Enter Verification Code</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter the 6‑digit OTP code sent to{' '}
                  <span className="font-semibold text-slate-800">{emailForReset}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">6-Digit OTP</label>
                    <span className="text-xs font-mono font-bold text-indigo-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTimer(otpTimer)}
                    </span>
                  </div>

                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      maxLength="6"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-mono text-center tracking-widest text-lg font-bold focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Didn't receive the OTP?</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending || otpTimer > 240}
                    className="font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-40 transition-all"
                  >
                    {resending ? 'Resending...' : 'Resend Code'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-3 px-4 rounded-xl text-white bg-slate-950 hover:bg-slate-800 font-bold text-sm shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Confirm & Proceed</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* VIEW: RESET PASSWORD */}
          {view === 'reset-password' && (
            <div>
              <button
                type="button"
                onClick={() => goBack('verify-otp')}
                className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 mb-6 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </button>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Create New Password</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Please choose a strong password with at least 8 characters.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      name="confirmNewPassword"
                      value={formData.confirmNewPassword}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl text-white bg-slate-950 hover:bg-slate-800 font-bold text-sm shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Save Password & Sign In</span>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}