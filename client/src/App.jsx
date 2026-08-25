
import { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import './index.css';

// ============================================
// AUTH CONTEXT
// ============================================
const AuthContext = createContext();
const useAuth = () => useContext(AuthContext);
const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_DOMAIN || 'nitrr.ac.in';

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      axios.defaults.headers.common['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post('http://localhost:3000/api/auth/login', { email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setToken(token);
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
    setToken(null);
    setUser(null);
  };

  const value = { user, loading, login, logout, isAuthenticated: !!user };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================
// OTP VERIFICATION COMPONENT
// ============================================
const OTPVerification = ({ email, onVerify, onResend, onBack, purpose = 'signup' }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
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
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
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
    if (!result.success) {
      setError(result.error);
    }
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

  const getTitle = () => {
    if (purpose === 'signup') return 'Verify Your Email';
    if (purpose === 'forgot') return 'Reset Your Password';
    return 'OTP Verification';
  };

  const getMessage = () => {
    if (purpose === 'signup') return `We've sent a 6-digit OTP to`;
    if (purpose === 'forgot') return `We've sent a password reset OTP to`;
    return `We've sent an OTP to`;
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-gray-600">{getMessage()}</p>
        <p className="font-semibold text-blue-600">{email}</p>
      </div>

      <div className="flex justify-center gap-2">
        {otp.map((digit, index) => (
          <input
            key={index}
            id={`otp-${index}`}
            type="text"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
            autoFocus={index === 0}
          />
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleVerify}
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>
      </div>

      <div className="text-center text-sm">
        {canResend ? (
          <button
            onClick={handleResend}
            disabled={loading}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Resend OTP
          </button>
        ) : (
          <span className="text-gray-500">Resend in {timer}s</span>
        )}
      </div>

      <button
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-700 text-center w-full"
      >
        ← Back
      </button>
    </div>
  );
};

// ============================================
// FORGOT PASSWORD PAGE
// ============================================
const ForgotPasswordPage = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('form'); // 'form' | 'otp' | 'reset'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email');
      return;
    }

    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Only @${ALLOWED_DOMAIN} email addresses are allowed`);
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:3000/api/auth/forgot-password', { email });
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (otp) => {
    try {
      const response = await axios.post('http://localhost:3000/api/auth/verify-reset-otp', {
        email,
        otp
      });
      
      if (response.data.success) {
        setResetToken(response.data.resetToken);
        setStep('reset');
        return { success: true };
      }
      return { success: false, error: 'Verification failed' };
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.message || 'OTP verification failed' 
      };
    }
  };

  const handleResendOTP = async () => {
    try {
      await axios.post('http://localhost:3000/api/auth/forgot-password', { email });
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.message || 'Failed to resend OTP' 
      };
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:3000/api/auth/reset-password', {
        email,
        resetToken,
        newPassword,
        confirmPassword
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Password Reset Successful!</h2>
          <p className="text-gray-600 mb-6">Your password has been reset successfully.</p>
          <button
            onClick={onBack}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔐</div>
            <h2 className="text-2xl font-bold text-gray-800">Reset Password</h2>
            <p className="text-sm text-gray-500">Enter the OTP sent to your email</p>
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔑</div>
            <h2 className="text-2xl font-bold text-gray-800">Set New Password</h2>
            <p className="text-sm text-gray-500">Enter your new password below</p>
          </div>

          <form onSubmit={handleResetPassword}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Min 6 characters"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm new password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-3 rounded">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-gray-800">Forgot Password?</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your email to reset your password</p>
        </div>

        <form onSubmit={handleSendOTP}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={`you@${ALLOWED_DOMAIN}`}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Must be @{ALLOWED_DOMAIN}</p>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-3 rounded">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Sending OTP...' : 'Send Reset OTP'}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700"
          >
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
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'professor',
    department: '',
    employeeId: '',
    phone: ''
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

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!formData.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Only @${ALLOWED_DOMAIN} email addresses are allowed`);
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:3000/api/auth/send-otp', {
        email: formData.email,
        purpose: 'signup'
      });
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (otp) => {
    try {
      await axios.post('http://localhost:3000/api/auth/verify-otp', {
        email: formData.email,
        otp,
        purpose: 'signup'
      });

      const response = await axios.post('http://localhost:3000/api/auth/signup', {
        ...formData,
        otp
      });

      if (response.data.success) {
        alert(response.data.message || 'Signup successful! Please login.');
        onSwitchToLogin();
        return { success: true };
      }
      return { success: false, error: 'Signup failed' };
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.message || 'Verification failed' 
      };
    }
  };

  const handleResendOTP = async () => {
    try {
      await axios.post('http://localhost:3000/api/auth/send-otp', {
        email: formData.email,
        purpose: 'signup'
      });
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.message || 'Failed to resend OTP' 
      };
    }
  };

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">📧</div>
            <h2 className="text-2xl font-bold text-gray-800">Verify Your Email</h2>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏫</div>
          <h1 className="text-2xl font-bold text-blue-700">Create Account</h1>
          <p className="text-gray-600 text-sm">NIT Raipur - Room Allocation</p>
          <p className="text-xs text-gray-500 mt-1">Only @{ALLOWED_DOMAIN} email allowed</p>
        </div>

        <form onSubmit={handleSendOTP}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Dr. John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`you@${ALLOWED_DOMAIN}`}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Must be @{ALLOWED_DOMAIN}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Min 6 chars"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="professor">Professor</option>
                <option value="hod">HOD (Requires Approval)</option>
              </select>
              {formData.role === 'hod' && (
                <p className="text-xs text-yellow-600 mt-1">⚠️ HOD accounts require admin approval</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Department</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="ME">ME</option>
                <option value="EE">EE</option>
                <option value="CE">CE</option>
                <option value="MME">MME</option>
                <option value="BT">BT</option>
                <option value="IT">IT</option>
                <option value="MCA">MCA</option>
                <option value="MBA">MBA</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="EMP001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="9876543210"
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-3 rounded">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Sending OTP...' : 'Send OTP to Email'}
          </button>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Login
            </button>
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
        setError('Your HOD account is pending approval. You will be notified once approved.');
      } else {
        setError(result.error);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏫</div>
          <h1 className="text-3xl font-bold text-blue-700">Room Allocation</h1>
          <p className="text-gray-600">NIT Raipur</p>
          <p className="text-sm text-gray-500 mt-2">Only @{ALLOWED_DOMAIN} email allowed</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`you@${ALLOWED_DOMAIN}`}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Must be @{ALLOWED_DOMAIN}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="text-right mt-2">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Forgot Password?
            </button>
          </div>

          {error && (
            <div className={`mt-4 border-l-4 p-3 rounded ${pendingApproval ? 'bg-yellow-50 border-yellow-500' : 'bg-red-50 border-red-500'}`}>
              <p className={`text-sm ${pendingApproval ? 'text-yellow-700' : 'text-red-700'}`}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>

          <p className="mt-4 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Sign Up
            </button>
          </p>

          <div className="mt-4 text-center text-sm text-gray-500 border-t pt-4">
            <p>Demo Accounts (Only @{ALLOWED_DOMAIN}):</p>
            <p className="text-xs">HOD: hod@nitrr.ac.in / Hod@12345</p>
            <p className="text-xs">Professor: prof@nitrr.ac.in / Prof@12345</p>
            <p className="text-xs mt-2">⚡ 4 requests/second | 👥 500+ users</p>
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
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    subject: '',
    comment: 'I have taken this class'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:3000/api/bookings', {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Book Room {room.roomNumber}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="Enter subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                rows="2"
                placeholder="I have taken this class"
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-3 rounded">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Booking...' : 'Confirm Booking'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
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

  const fetchRooms = async () => {
    try {
      let url = 'http://localhost:3000/api/rooms';
      const params = new URLSearchParams();
      if (searchDept) params.append('department', searchDept);
      
      const response = await axios.get(`${url}?${params}`);
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
      const params = new URLSearchParams({
        date: searchDate,
        startTime: searchStart,
        endTime: searchEnd
      });
      if (searchDept) params.append('department', searchDept);
      
      const response = await axios.get(`http://localhost:3000/api/rooms/available?${params}`);
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Error fetching available rooms:', error);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [roomsRes, bookingsRes] = await Promise.all([
          axios.get('http://localhost:3000/api/rooms'),
          axios.get('http://localhost:3000/api/bookings/my-bookings')
        ]);
        
        const allRooms = roomsRes.data.data || [];
        const bookings = bookingsRes.data.data || [];
        
        setStats({
          totalRooms: allRooms.length,
          available: allRooms.filter(r => r.isAvailable !== false).length,
          myBookings: bookings.length,
          cancelled: bookings.filter(b => b.status === 'cancelled').length
        });
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold">🏫 NITRR</span>
              <span className="text-sm opacity-80">Room Allocation</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm hidden sm:inline">{user?.email}</span>
              <span className="text-sm bg-blue-700 px-3 py-1 rounded">{user?.role}</span>
              {user?.hodApproval === 'pending' && (
                <span className="text-sm bg-yellow-500 px-3 py-1 rounded">⏳ Pending Approval</span>
              )}
              <button onClick={logout} className="bg-red-500 hover:bg-red-600 px-4 py-1 rounded transition">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setView('dashboard')}
            className={`px-4 py-2 rounded-lg transition ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => { setView('rooms'); fetchRooms(); }}
            className={`px-4 py-2 rounded-lg transition ${view === 'rooms' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            🏢 Rooms
          </button>
          <button
            onClick={() => setView('booking')}
            className={`px-4 py-2 rounded-lg transition ${view === 'booking' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            📖 Book Room
          </button>
          <button
            onClick={() => setView('mybookings')}
            className={`px-4 py-2 rounded-lg transition ${view === 'mybookings' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            📋 My Bookings
          </button>
          {user?.role === 'hod' && (
            <button
              onClick={() => setView('timetable')}
              className={`px-4 py-2 rounded-lg transition ${view === 'timetable' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              📅 Timetable
            </button>
          )}
        </div>

        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-gray-800">
                Welcome, {user?.name}! 👋
              </h1>
              <div className="text-sm text-gray-500">
                ⚡ 4 req/sec | 👥 500+ users
              </div>
            </div>

            {user?.hodApproval === 'pending' && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded mb-6">
                <p className="text-yellow-700">
                  ⏳ Your HOD account is pending approval. You will be notified once approved.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-md p-6">
                <p className="text-gray-500 text-sm">Total Rooms</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalRooms}</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6">
                <p className="text-gray-500 text-sm">Available</p>
                <p className="text-3xl font-bold text-green-600">{stats.available}</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6">
                <p className="text-gray-500 text-sm">My Bookings</p>
                <p className="text-3xl font-bold text-purple-600">{stats.myBookings}</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6">
                <p className="text-gray-500 text-sm">Cancelled</p>
                <p className="text-3xl font-bold text-red-600">{stats.cancelled}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setView('booking')}
                  className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg border-2 border-blue-200 transition text-center"
                >
                  <div className="text-2xl mb-2">📖</div>
                  <h3 className="font-semibold">Book a Room</h3>
                  <p className="text-sm text-gray-600">Check availability & book</p>
                </button>
                <button
                  onClick={() => setView('mybookings')}
                  className="bg-green-50 hover:bg-green-100 p-4 rounded-lg border-2 border-green-200 transition text-center"
                >
                  <div className="text-2xl mb-2">📋</div>
                  <h3 className="font-semibold">My Bookings</h3>
                  <p className="text-sm text-gray-600">View all your bookings</p>
                </button>
                <button
                  onClick={() => setView('rooms')}
                  className="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg border-2 border-purple-200 transition text-center"
                >
                  <div className="text-2xl mb-2">🏢</div>
                  <h3 className="font-semibold">View Rooms</h3>
                  <p className="text-sm text-gray-600">Browse all rooms</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rooms View */}
        {view === 'rooms' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🏢 All Rooms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map(room => (
                <div key={room._id} className="bg-white rounded-xl shadow-md p-4">
                  <h3 className="text-xl font-bold text-blue-600">Room {room.roomNumber}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>📍 Floor: {room.floor} | Building: {room.building}</p>
                    <p>🏛️ {room.department} | 👥 Capacity: {room.capacity}</p>
                    <p className="flex gap-2">
                      {room.hasProjector && <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">📽️</span>}
                      {room.hasAC && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">❄️</span>}
                      {room.isAvailable ? (
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">✅ Available</span>
                      ) : (
                        <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded">❌ Unavailable</span>
                      )}
                    </p>
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
            
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={searchStart}
                    onChange={(e) => setSearchStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={searchEnd}
                    onChange={(e) => setSearchEnd(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={searchDept}
                    onChange={(e) => setSearchDept(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="ME">ME</option>
                    <option value="EE">EE</option>
                    <option value="CE">CE</option>
                    <option value="MME">MME</option>
                    <option value="BT">BT</option>
                    <option value="IT">IT</option>
                    <option value="MCA">MCA</option>
                    <option value="MBA">MBA</option>
                  </select>
                </div>
              </div>
              <button
                onClick={fetchAvailableRooms}
                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Check Availability
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map(room => (
                <div key={room._id} className="bg-white rounded-xl shadow-md p-4">
                  <h3 className="text-xl font-bold text-blue-600">Room {room.roomNumber}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>📍 Floor: {room.floor} | Building: {room.building}</p>
                    <p>🏛️ {room.department} | 👥 Capacity: {room.capacity}</p>
                    <p className="flex gap-2">
                      {room.hasProjector && <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">📽️</span>}
                      {room.hasAC && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">❄️</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedRoom(room);
                      setShowModal(true);
                    }}
                    className="mt-3 w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition"
                  >
                    Book This Room
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
            <div className="space-y-3">
              <p className="text-gray-500">Your bookings will appear here</p>
            </div>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {showModal && selectedRoom && (
        <BookingModal
          room={selectedRoom}
          onClose={() => { setShowModal(false); setSelectedRoom(null); }}
          onSuccess={(data) => {
            setShowModal(false);
            setSelectedRoom(null);
            alert('✅ Room booked successfully!');
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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