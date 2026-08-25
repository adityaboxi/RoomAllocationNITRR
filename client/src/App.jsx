
import { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import './index.css';

// ============================================
// API CONFIGURATION
// ============================================
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_DOMAIN || 'nitrr.ac.in';

// ============================================
// AUTH CONTEXT
// ============================================
const AuthContext = createContext();
const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed',
        hodApproval: error.response?.data?.hodApproval 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = { user, loading, login, logout, isAuthenticated: !!user };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================
// OTP VERIFICATION
// ============================================
const OTPVerification = ({ email, onVerify, onResend, onBack, purpose = 'signup' }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleChange = (index, value) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleVerify = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }
    setLoading(true);
    setError('');
    const result = await onVerify(otpValue);
    setLoading(false);
    if (!result.success) setError(result.error);
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    const result = await onResend();
    setLoading(false);
    if (result.success) {
      setTimer(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-gray-600">We've sent a 6-digit code to</p>
        <p className="font-semibold text-blue-600 text-lg">{email}</p>
      </div>

      <div className="flex justify-center gap-3">
        {otp.map((digit, index) => (
          <input
            key={index}
            id={`otp-${index}`}
            type="text"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="w-14 h-16 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none transition-all duration-200"
            autoFocus={index === 0}
          />
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={loading}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl"
      >
        {loading ? 'Verifying...' : 'Verify OTP'}
      </button>

      <div className="text-center">
        {canResend ? (
          <button onClick={handleResend} disabled={loading} className="text-blue-600 hover:text-blue-800 font-medium">
            Resend OTP
          </button>
        ) : (
          <span className="text-gray-500">Resend in <span className="font-semibold">{timer}s</span></span>
        )}
      </div>

      <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-center w-full text-sm">
        ← Back
      </button>
    </div>
  );
};

// ============================================
// AUTH PAGES
// ============================================
const ForgotPasswordPage = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter your email'); return; }
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Only @${ALLOWED_DOMAIN} email addresses are allowed`);
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (otp) => {
    try {
      const response = await axios.post(`${API_URL}/auth/verify-reset-otp`, { email, otp });
      if (response.data.success) {
        setResetToken(response.data.resetToken);
        setStep('reset');
        return { success: true };
      }
      return { success: false, error: 'Verification failed' };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'OTP verification failed' };
    }
  };

  const handleResendOTP = async () => {
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Failed to resend OTP' };
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { email, resetToken, newPassword, confirmPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Password Reset Successful!</h2>
          <p className="text-gray-600 mb-8">Your password has been reset successfully.</p>
          <button onClick={onBack} className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Reset Password</h2>
            <p className="text-gray-500">Enter the OTP sent to your email</p>
          </div>
          <OTPVerification
            email={email}
            purpose="forgot"
            onVerify={handleVerifyOTP}
            onResend={handleResendOTP}
            onBack={() => setStep('form')}
          />
        </div>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔑</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Set New Password</h2>
            <p className="text-gray-500">Enter your new password below</p>
          </div>
          <form onSubmit={handleResetPassword}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="Min 6 characters" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="Confirm new password" required />
              </div>
            </div>
            {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"><p className="text-red-700 text-sm">{error}</p></div>}
            <button type="submit" disabled={loading} className="mt-6 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Forgot Password?</h1>
          <p className="text-gray-500 mt-1">Enter your email to reset your password</p>
        </div>
        <form onSubmit={handleSendOTP}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder={`you@${ALLOWED_DOMAIN}`} required />
            <p className="text-xs text-gray-500 mt-1">Must be @{ALLOWED_DOMAIN}</p>
          </div>
          {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"><p className="text-red-700 text-sm">{error}</p></div>}
          <button type="submit" disabled={loading} className="mt-6 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl">
            {loading ? 'Sending OTP...' : 'Send Reset OTP'}
          </button>
          <button type="button" onClick={onBack} className="mt-4 w-full text-gray-500 hover:text-gray-700 text-center text-sm">
            ← Back to Login
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================
// SIGNUP PAGE
// ============================================
const SignupPage = ({ onSwitchToLogin }) => {
  const [step, setStep] = useState('form');
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    role: 'professor', department: '', employeeId: '', phone: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.name || !formData.email || !formData.password || !formData.department || !formData.employeeId || !formData.phone) {
      setError('All fields are required');
      return;
    }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return; }
    if (!formData.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Only @${ALLOWED_DOMAIN} email addresses are allowed`);
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/send-otp`, { email: formData.email, purpose: 'signup' });
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (otp) => {
    try {
      await axios.post(`${API_URL}/auth/verify-otp`, { email: formData.email, otp, purpose: 'signup' });
      const response = await axios.post(`${API_URL}/auth/signup`, { ...formData, otp });
      if (response.data.success) {
        alert(response.data.message || 'Signup successful! Please login.');
        onSwitchToLogin();
        return { success: true };
      }
      return { success: false, error: 'Signup failed' };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Verification failed' };
    }
  };

  const handleResendOTP = async () => {
    try {
      await axios.post(`${API_URL}/auth/send-otp`, { email: formData.email, purpose: 'signup' });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Failed to resend OTP' };
    }
  };

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📧</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Verify Your Email</h2>
            <p className="text-gray-500">Please verify your email address</p>
          </div>
          <OTPVerification
            email={formData.email}
            purpose="signup"
            onVerify={handleVerifyOTP}
            onResend={handleResendOTP}
            onBack={() => setStep('form')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🏫</span>
          </div>
          <h1 className="text-3xl font-bold text-blue-700">Create Account</h1>
          <p className="text-gray-600">NIT Raipur - Room Allocation</p>
          <p className="text-xs text-gray-500 mt-1">Only @{ALLOWED_DOMAIN} email allowed</p>
        </div>
        <form onSubmit={handleSendOTP}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="Dr. John Doe" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder={`you@${ALLOWED_DOMAIN}`} required />
              <p className="text-xs text-gray-500 mt-1">Must be @{ALLOWED_DOMAIN}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="Min 6 chars" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="Confirm" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select name="role" value={formData.role} onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all">
                <option value="professor">Professor</option>
                <option value="hod">HOD (Requires Approval)</option>
              </select>
              {formData.role === 'hod' && <p className="text-xs text-yellow-600 mt-1">⚠️ HOD accounts require admin approval</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select name="department" value={formData.department} onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" required>
                <option value="">Select Department</option>
                <option value="CSE">CSE</option><option value="ECE">ECE</option><option value="ME">ME</option>
                <option value="EE">EE</option><option value="CE">CE</option><option value="MME">MME</option>
                <option value="BT">BT</option><option value="IT">IT</option><option value="MCA">MCA</option><option value="MBA">MBA</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input type="text" name="employeeId" value={formData.employeeId} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="EMP001" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="9876543210" required />
              </div>
            </div>
          </div>
          {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"><p className="text-red-700 text-sm">{error}</p></div>}
          <button type="submit" disabled={loading} className="mt-6 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl">
            {loading ? 'Sending OTP...' : 'Send OTP to Email'}
          </button>
          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <button type="button" onClick={onSwitchToLogin} className="text-blue-600 hover:text-blue-800 font-medium">Login</button>
          </p>
        </form>
      </div>
    </div>
  );
};

// ============================================
// LOGIN PAGE
// ============================================
const LoginPage = ({ onLogin, onSwitchToSignup, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPendingApproval(false);
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Only @${ALLOWED_DOMAIN} email addresses are allowed`);
      setLoading(false);
      return;
    }
    const result = await login(email, password);
    if (result.success) {
      onLogin();
    } else {
      if (result.hodApproval === 'pending') {
        setPendingApproval(true);
        setError('Your HOD account is pending approval.');
      } else {
        setError(result.error);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🏫</span>
          </div>
          <h1 className="text-3xl font-bold text-blue-700">Room Allocation</h1>
          <p className="text-gray-600">NIT Raipur</p>
          <p className="text-sm text-gray-500 mt-2">Only @{ALLOWED_DOMAIN} email allowed</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder={`you@${ALLOWED_DOMAIN}`} required />
              <p className="text-xs text-gray-500 mt-1">Must be @{ALLOWED_DOMAIN}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="••••••••" required />
            </div>
          </div>
          <div className="text-right mt-2">
            <button type="button" onClick={onForgotPassword} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              Forgot Password?
            </button>
          </div>
          {error && (
            <div className={`mt-4 border-l-4 p-4 rounded-lg ${pendingApproval ? 'bg-yellow-50 border-yellow-500' : 'bg-red-50 border-red-500'}`}>
              <p className={`text-sm ${pendingApproval ? 'text-yellow-700' : 'text-red-700'}`}>{error}</p>
            </div>
          )}
          <button type="submit" disabled={loading} className="mt-6 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl">
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
          <p className="mt-4 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <button type="button" onClick={onSwitchToSignup} className="text-blue-600 hover:text-blue-800 font-medium">Sign Up</button>
          </p>
          <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
            <p className="font-medium text-gray-600">Demo Accounts</p>
            <div className="mt-2 space-y-1">
              <p className="text-xs">HOD: <span className="font-mono text-blue-600">hod@nitrr.ac.in</span> / <span className="font-mono">Hod@12345</span></p>
              <p className="text-xs">Professor: <span className="font-mono text-blue-600">prof@nitrr.ac.in</span> / <span className="font-mono">Prof@12345</span></p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// BOOKING MODAL
// ============================================
const BookingModal = ({ room, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    date: '', startTime: '', endTime: '', subject: '', comment: 'No comment provided'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/bookings/book`, {
        roomId: room._id,
        ...formData
      });
      onSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Book Room <span className="text-blue-600">{room.roomNumber}</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input type="time" required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input type="time" required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input type="text" required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Enter subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment (Optional)</label>
              <textarea className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" rows="2"
                placeholder="Add a comment..." value={formData.comment} onChange={(e) => setFormData({ ...formData, comment: e.target.value })} />
            </div>
          </div>
          {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"><p className="text-red-700 text-sm">{error}</p></div>}
          <div className="flex gap-3 mt-6">
            <button type="submit" disabled={loading} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 shadow-lg">
              {loading ? 'Booking...' : 'Confirm Booking'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-200">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// DASHBOARD PAGE
// ============================================
const DashboardPage = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ totalRooms: 0, available: 0, myBookings: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [searchDate, setSearchDate] = useState('');
  const [searchStart, setSearchStart] = useState('');
  const [searchEnd, setSearchEnd] = useState('');
  const [searchDept, setSearchDept] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState('dashboard');
  const [myBookings, setMyBookings] = useState([]);

  const fetchRooms = async () => {
    try {
      const params = new URLSearchParams();
      if (searchDept) params.append('department', searchDept);
      const response = await axios.get(`${API_URL}/rooms?${params}`);
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const fetchAvailableRooms = async () => {
    if (!searchDate || !searchStart || !searchEnd) {
      alert('Please select date, start time and end time');
      return;
    }
    try {
      const params = new URLSearchParams({ date: searchDate, startTime: searchStart, endTime: searchEnd });
      if (searchDept) params.append('department', searchDept);
      const response = await axios.get(`${API_URL}/rooms/available?${params}`);
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Error fetching available rooms:', error);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings/my-bookings`);
      setMyBookings(response.data.data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [roomsRes, bookingsRes] = await Promise.all([
          axios.get(`${API_URL}/rooms`),
          axios.get(`${API_URL}/bookings/my-bookings`)
        ]);
        const allRooms = roomsRes.data.data || [];
        const bookings = bookingsRes.data.data || [];
        setStats({
          totalRooms: allRooms.length,
          available: allRooms.filter(r => r.isAvailable !== false).length,
          myBookings: bookings.length,
          cancelled: bookings.filter(b => b.status === 'cancelled').length
        });
        setMyBookings(bookings);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    fetchRooms();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navbar */}
      <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold">🏫</span>
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">NITRR</span>
                <span className="text-sm text-gray-500 ml-1">Room Allocation</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user?.name}</span>
                <span className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 px-2 py-1 rounded-lg font-medium">{user?.role}</span>
                {user?.hodApproval === 'pending' && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg font-medium">⏳ Pending</span>
                )}
              </div>
              <button onClick={logout} className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto bg-white rounded-2xl p-2 shadow-md border border-gray-100">
          {[
            { id: 'dashboard', label: '📊 Dashboard' },
            { id: 'rooms', label: '🏢 Rooms' },
            { id: 'booking', label: '📖 Book Room' },
            { id: 'mybookings', label: '📋 My Bookings' },
            ...(user?.role === 'hod' ? [{ id: 'timetable', label: '📅 Timetable' }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 whitespace-nowrap ${
                view === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Welcome back, <span className="text-blue-600">{user?.name}</span>! 👋</h1>
                <p className="text-gray-500 mt-1">{user?.role === 'hod' ? 'HOD' : 'Professor'} - {user?.department} Department</p>
              </div>
              <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-xl shadow-md border border-gray-100">
                ⚡ 4 req/sec | 👥 500+ users
              </div>
            </div>

            {user?.hodApproval === 'pending' && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-xl">
                <p className="text-yellow-700">⏳ Your HOD account is pending approval. You will be notified once approved.</p>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Rooms', value: stats.totalRooms, color: 'from-blue-500 to-blue-600', icon: '🏢' },
                { label: 'Available', value: stats.available, color: 'from-green-500 to-green-600', icon: '✅' },
                { label: 'My Bookings', value: stats.myBookings, color: 'from-purple-500 to-purple-600', icon: '📚' },
                { label: 'Cancelled', value: stats.cancelled, color: 'from-red-500 to-red-600', icon: '❌' }
              ].map((stat, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-800 mt-1">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-xl flex items-center justify-center text-white text-2xl shadow-md`}>
                      {stat.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">🚀 Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { action: () => setView('booking'), icon: '📖', title: 'Book a Room', desc: 'Check availability & book' },
                  { action: () => { setView('mybookings'); fetchMyBookings(); }, icon: '📋', title: 'My Bookings', desc: 'View all your bookings' },
                  { action: () => setView('rooms'), icon: '🏢', title: 'View Rooms', desc: 'Browse all rooms' }
                ].map((item, index) => (
                  <button
                    key={index}
                    onClick={item.action}
                    className="group bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 p-6 rounded-xl border-2 border-blue-100 hover:border-blue-300 transition-all duration-200 text-center"
                  >
                    <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">{item.icon}</div>
                    <h3 className="font-semibold text-gray-800">{item.title}</h3>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rooms View */}
        {view === 'rooms' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🏢 All Rooms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map(room => (
                <div key={room._id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold text-blue-600">Room {room.roomNumber}</h3>
                    <span className={`px-3 py-1 rounded-xl text-xs font-semibold ${
                      room.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {room.isAvailable ? '✅ Available' : '❌ Unavailable'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <p>📍 Floor: {room.floor} | Building: {room.building}</p>
                    <p>🏛️ {room.department} | 👥 Capacity: {room.capacity}</p>
                    <div className="flex gap-2 mt-2">
                      {room.hasProjector && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs">📽️ Projector</span>}
                      {room.hasAC && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs">❄️ AC</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Booking View */}
        {view === 'booking' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📖 Find & Book a Room</h2>
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={searchDate} onChange={(e) => setSearchDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input type="time" className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={searchStart} onChange={(e) => setSearchStart(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input type="time" className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={searchEnd} onChange={(e) => setSearchEnd(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={searchDept} onChange={(e) => setSearchDept(e.target.value)}>
                    <option value="">All</option>
                    <option value="CSE">CSE</option><option value="ECE">ECE</option><option value="ME">ME</option>
                    <option value="EE">EE</option><option value="CE">CE</option><option value="MME">MME</option>
                    <option value="BT">BT</option><option value="IT">IT</option><option value="MCA">MCA</option><option value="MBA">MBA</option>
                  </select>
                </div>
              </div>
              <button onClick={fetchAvailableRooms} className="mt-4 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl">
                🔍 Check Availability
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map(room => (
                <div key={room._id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-200">
                  <h3 className="text-xl font-bold text-blue-600">Room {room.roomNumber}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>📍 Floor: {room.floor} | Building: {room.building}</p>
                    <p>🏛️ {room.department} | 👥 Capacity: {room.capacity}</p>
                    <div className="flex gap-2 mt-2">
                      {room.hasProjector && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs">📽️</span>}
                      {room.hasAC && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs">❄️</span>}
                    </div>
                  </div>
                  <button onClick={() => { setSelectedRoom(room); setShowModal(true); }}
                    className="mt-4 w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2 rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg">
                    📖 Book This Room
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Bookings View */}
        {view === 'mybookings' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📋 My Bookings</h2>
            {myBookings.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-gray-500 text-lg">No bookings found</p>
                <p className="text-sm text-gray-400">You haven't made any bookings yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myBookings.map(booking => (
                  <div key={booking._id} className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-blue-600">Room {booking.room?.roomNumber}</h3>
                          <span className={`px-3 py-1 rounded-xl text-xs font-semibold ${
                            booking.status === 'active' ? 'bg-green-100 text-green-700' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <p>📅 {new Date(booking.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          <p>🕐 {booking.startTime} - {booking.endTime}</p>
                          <p>📚 <span className="font-medium">{booking.subject}</span></p>
                          {booking.comment && <p className="text-gray-500 italic">💬 "{booking.comment}"</p>}
                          {booking.hasConflict && (
                            <div className="mt-2 bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-lg">
                              <p className="text-sm text-yellow-700">⚠️ Conflict: {booking.conflictDetails?.subject} by {booking.conflictDetails?.professor} at {booking.conflictDetails?.time}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {showModal && selectedRoom && (
        <BookingModal
          room={selectedRoom}
          onClose={() => { setShowModal(false); setSelectedRoom(null); }}
          onSuccess={() => {
            setShowModal(false);
            setSelectedRoom(null);
            alert('✅ Room booked successfully!');
            fetchMyBookings();
          }}
        />
      )}
    </div>
  );
};

// ============================================
// MAIN APP
// ============================================
function App() {
  const { isAuthenticated, loading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <DashboardPage />;
  }

  if (showForgotPassword) {
    return <ForgotPasswordPage onBack={() => setShowForgotPassword(false)} />;
  }

  return showSignup ? (
    <SignupPage onSwitchToLogin={() => setShowSignup(false)} />
  ) : (
    <LoginPage 
      onLogin={() => {}} 
      onSwitchToSignup={() => setShowSignup(true)}
      onForgotPassword={() => setShowForgotPassword(true)}
    />
  );
}

export default function WrappedApp() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
