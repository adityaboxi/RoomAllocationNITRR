import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { ALLOWED_DOMAIN } from '../../utils/constants';
import OTPVerification from './OTPVerification';

const SignupPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('form');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'professor',
    department: '',
    employeeId: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    if (
      !formData.name ||
      !formData.email ||
      !formData.password ||
      !formData.department ||
      !formData.employeeId ||
      !formData.phone
    ) {
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
      setError(`Only @${ALLOWED_DOMAIN} emails are allowed`);
      return;
    }
    setLoading(true);
    try {
      await authAPI.sendOTP(formData.email, 'signup');
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (otp) => {
    try {
      await authAPI.verifyOTP(formData.email, otp, 'signup');
      const response = await authAPI.signup({ ...formData, otp });
      if (response.data.success) {
        alert(response.data.message || 'Signup successful! Please login.');
        navigate('/login');
        return { success: true };
      }
      return { success: false, error: 'Signup failed' };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || 'Verification failed',
      };
    }
  };

  const handleResendOTP = async () => {
    try {
      await authAPI.sendOTP(formData.email, 'signup');
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || 'Failed to resend OTP',
      };
    }
  };

  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">📧</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Verify Your Email</h2>
            <p className="text-sm text-gray-500 mt-1">Please verify your email address</p>
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🏫</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">Create Account</h1>
          <p className="text-sm text-gray-500">NIT Raipur - Room Allocation</p>
          <p className="text-xs text-gray-400 mt-1">Only @{ALLOWED_DOMAIN} email allowed</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSendOTP}>
          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Dr. John Doe"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder={`you@${ALLOWED_DOMAIN}`}
                required
              />
              <p className="text-xs text-gray-400 mt-1">Must be @{ALLOWED_DOMAIN}</p>
            </div>

            {/* Password & Confirm */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
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
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Confirm"
                  required
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              >
                <option value="professor">Professor</option>
                <option value="hod">HOD (Requires Approval)</option>
              </select>
              {formData.role === 'hod' && (
                <p className="text-xs text-yellow-600 mt-1">⚠️ HOD accounts require admin approval</p>
              )}
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
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

            {/* Employee ID & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
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
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="9876543210"
                  required
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 bg-red-50 text-red-700 text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-5 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? 'Sending OTP...' : 'Send OTP to Email'}
          </button>

          {/* Login Link */}
          <p className="mt-3 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
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

export default SignupPage;
