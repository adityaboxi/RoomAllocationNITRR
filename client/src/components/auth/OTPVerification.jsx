import { useState, useEffect } from 'react';
import { OTP_CONFIG } from '../../utils/constants';

const OTPVerification = ({ email, onVerify, onResend, onBack, purpose = 'signup' }) => {
  const [otp, setOtp] = useState(Array(OTP_CONFIG.length).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
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
    if (value && index < OTP_CONFIG.length - 1) {
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
    if (otpValue.length !== OTP_CONFIG.length) {
      setError(`Please enter all ${OTP_CONFIG.length} digits`);
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
      setOtp(Array(OTP_CONFIG.length).fill(''));
      document.getElementById('otp-0')?.focus();
    } else {
      setError(result.error);
    }
  };

  const getMessage = () => {
    if (purpose === 'signup') return "We've sent a 6-digit code to";
    if (purpose === 'forgot') return "We've sent a password reset OTP to";
    return "We've sent an OTP to";
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-gray-600">{getMessage()}</p>
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
          <span className="text-gray-500">
            Resend in <span className="font-semibold">{timer}s</span>
          </span>
        )}
      </div>

      <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-center w-full text-sm">
        ← Back
      </button>
    </div>
  );
};

export default OTPVerification;
