import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { ALLOWED_DOMAIN } from '../../utils/constants';
import OTPVerification from './OTPVerification';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
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
    if (!email) {
      setError('Please enter your email');
      return;
    }
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Only @${ALLOWED_DOMAIN} emails are allowed`);
      return;
    }
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (otp) => {
    try {
      const response = await authAPI.verifyResetOTP(email, otp);
      if (response.data.success) {
        setResetToken(response.data.resetToken);
        setStep('reset');
        return { success: true };
      }
      return { success: false, error: 'Verification failed' };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || 'OTP verification failed',
      };
    }
  };

  const handleResendOTP = async () => {
    try {
      await authAPI.forgotPassword(email);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || 'Failed to resend OTP',
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
      await authAPI.resetPassword({ email, resetToken, newPassword, confirmPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed');
    }
    setLoading(false);
  };

  // Success Screen
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Password Reset Success!</h2>
          <p className="text-gray-600 text-sm mb-6">Your password has been reset successfully.</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md text-sm font-medium transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // OTP Screen
  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🔐</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Reset Password</h2>
            <p className="text-sm text-gray-500 mt-1">Enter the OTP sent to your email</p>
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

  // Reset Password Screen
  if (step === 'reset') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🔑</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Set New Password</h2>
            <p className="text-sm text-gray-500">Enter your new password below</p>
          </div>

          <form onSubmit={handleResetPassword}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Min 6 characters"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Confirm new password"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Initial Form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">Forgot Password?</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your email to reset your password</p>
        </div>

        <form onSubmit={handleSendOTP}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder={`you@${ALLOWED_DOMAIN}`}
              required
            />
            <p className="text-xs text-gray-400 mt-1">Must be @{ALLOWED_DOMAIN}</p>
          </div>

          {error && (
            <div className="mt-3 bg-red-50 text-red-700 text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-5 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? 'Sending OTP...' : 'Send Reset OTP'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full mt-3 text-gray-500 hover:text-gray-700 text-sm text-center"
          >
            ← Back to Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
