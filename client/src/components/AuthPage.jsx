import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Building2, GraduationCap, ShieldCheck, Mail, Lock, User, 
  ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, ShieldAlert,
  CalendarCheck, Zap, Sparkles, ArrowLeft, Loader
} from 'lucide-react';

const departments = [
  { code: 'cs', name: 'Computer Science (CSE)' },
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

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, signup, forgotPassword, verifyResetOTP, resetPassword, loading: authLoading } = useAuth();
  
  const [view, setView] = useState('login');
  const [role, setRole] = useState('FACULTY');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: 'cs',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetStep, setResetStep] = useState('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOTP, setResetOTP] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Updated email validation - allow @cse.nitrr.ac.in and @gmail.com
    const isValidEmail = formData.email.endsWith('@cse.nitrr.ac.in') || formData.email.endsWith('@gmail.com');
    if (!isValidEmail) {
      setError('Only @cse.nitrr.ac.in or @gmail.com email addresses are allowed');
      setLoading(false);
      return;
    }

    if (view === 'login') {
      if (!formData.password) {
        setError('Password is required');
        setLoading(false);
        return;
      }
      
      const result = await login(formData.email, formData.password);
      if (result.success) {
        setSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          navigate('/dashboard');
        }, 500);
      } else {
        setError(result.error);
      }
    } else if (view === 'signup') {
      // Password validation - backend requires min 8 chars
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters');
        setLoading(false);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      // Send data matching backend expectations
      const result = await signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        department: formData.department,
      });
      
      if (result.success) {
        setSuccess('Account created! Redirecting...');
        setTimeout(() => {
          navigate('/dashboard');
        }, 500);
      } else {
        setError(result.error);
      }
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (resetStep === 'email') {
      const result = await forgotPassword(resetEmail);
      if (result.success) {
        setSuccess('OTP sent to your email!');
        setResetStep('otp');
      } else {
        setError(result.error);
      }
    } else if (resetStep === 'otp') {
      const result = await verifyResetOTP(resetEmail, resetOTP);
      if (result.success) {
        setResetToken(result.resetToken);
        setSuccess('OTP verified! Set new password.');
        setResetStep('new');
      } else {
        setError(result.error);
      }
    } else if (resetStep === 'new') {
      if (newPassword.length < 8) {
        setError('Password must be at least 8 characters');
        setLoading(false);
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      const result = await resetPassword({
        email: resetEmail,
        resetToken,
        newPassword,
        confirmPassword: confirmNewPassword,
      });
      if (result.success) {
        setSuccess('Password reset successfully!');
        setTimeout(() => {
          setView('login');
          setResetStep('email');
          setResetEmail('');
          setResetOTP('');
          setNewPassword('');
          setConfirmNewPassword('');
          setSuccess('');
        }, 2000);
      } else {
        setError(result.error);
      }
    }
    setLoading(false);
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

  // Forgot Password View
  if (view === 'forgot') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8">
          <button onClick={() => { setView('login'); setResetStep('email'); setError(''); setSuccess(''); }} className="text-slate-400 hover:text-white mb-4 flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-3">
              <KeyRound className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white">Reset Password</h2>
            <p className="text-sm text-slate-400">
              {resetStep === 'email' && 'Enter your email to receive OTP'}
              {resetStep === 'otp' && 'Enter the 6-digit OTP sent to your email'}
              {resetStep === 'new' && 'Set your new password'}
            </p>
          </div>

          <form onSubmit={handleResetPassword}>
            {resetStep === 'email' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="you@cse.nitrr.ac.in or you@gmail.com"
                  required
                />
              </div>
            )}

            {resetStep === 'otp' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">OTP Code</label>
                <input
                  type="text"
                  value={resetOTP}
                  onChange={(e) => setResetOTP(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="— — — — — —"
                  maxLength={6}
                  required
                />
                <p className="text-xs text-slate-500 mt-2">Enter the 6-digit OTP sent to {resetEmail}</p>
              </div>
            )}

            {resetStep === 'new' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="Min 8 characters"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || authLoading}
              className="w-full mt-4 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading || authLoading ? (
                <><Loader className="w-4 h-4 animate-spin" /> Please wait...</>
              ) : (
                <>{resetStep === 'new' ? 'Reset Password' : resetStep === 'otp' ? 'Verify OTP' : 'Send OTP'}</>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Login/Signup View
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        
        {/* Left Side: Branding */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wide mb-6">
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

            <h1 className="text-2xl font-extrabold text-white tracking-tight mt-6 leading-snug">
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

        {/* Right Side: Auth Form */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-10 flex flex-col justify-center">
          
          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start text-rose-800 text-xs sm:text-sm font-medium">
              <ShieldAlert className="w-5 h-5 mr-2 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start text-emerald-800 text-xs sm:text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>{success}</div>
            </div>
          )}

          {/* Role Selector */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Role</span>
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
              onClick={() => { setView('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                view === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setView('signup'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                view === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {view === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Dr. D. S. Sisodia"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition"
                    required={view === 'signup'}
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Email Address</label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  role === 'HOD' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  @cse.nitrr.ac.in or @gmail.com
                </span>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder={role === 'HOD' ? 'hod@cse.nitrr.ac.in' : 'faculty@gmail.com'}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition"
                required={view === 'signup'}
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
                    onClick={() => { setView('forgot'); setError(''); setSuccess(''); setResetEmail(formData.email || ''); }}
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
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition"
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
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition"
                    required={view === 'signup'}
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
              disabled={loading || authLoading}
              className="w-full mt-3 flex items-center justify-center py-3 px-4 rounded-xl text-white bg-slate-950 hover:bg-slate-800 font-bold text-sm shadow-md transition-all active:scale-[0.99] disabled:opacity-50 gap-2"
            >
              {loading || authLoading ? (
                <><Loader className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                <>
                  <span>{view === 'login' ? `Sign In as ${role}` : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            {view === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              {view === 'login' ? 'Register' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
