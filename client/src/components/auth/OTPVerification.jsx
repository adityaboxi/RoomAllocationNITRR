import { useState, useEffect } from 'react';

const OTPVerification = ({ email, onVerify, onResend, onBack, purpose = 'signup' }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
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
    <div>
      {/* Message */}
      <div className="text-center mb-6">
        <p className="text-sm text-gray-600">
          {purpose === 'signup'
            ? "We've sent a 6-digit code to"
            : "We've sent a password reset OTP to"}
        </p>
        <p className="font-medium text-blue-600">{email}</p>
      </div>

      {/* OTP Inputs */}
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
            className="w-12 h-14 text-center text-xl font-medium border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            autoFocus={index === 0}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 bg-red-50 text-red-700 text-sm p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Verify Button */}
      <button
        onClick={handleVerify}
        disabled={loading}
        className="w-full mt-5 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
      >
        {loading ? 'Verifying...' : 'Verify OTP'}
      </button>

      {/* Resend */}
      <div className="text-center mt-3">
        {canResend ? (
          <button
            onClick={handleResend}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Resend OTP
          </button>
        ) : (
          <span className="text-sm text-gray-500">
            Resend in <span className="font-medium">{timer}s</span>
          </span>
        )}
      </div>

      {/* Back */}
      <button
        onClick={onBack}
        className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 text-center"
      >
        ← Back
      </button>
    </div>
  );
};

export default OTPVerification;
