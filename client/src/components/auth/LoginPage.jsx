import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ALLOWED_DOMAIN, DEMO_ACCOUNTS } from '../../utils/constants';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

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
      navigate('/dashboard');
    } else {
      if (result.hodApproval === 'pending') {
        setPendingApproval(true);
        setError('Your HOD account is pending approval. Please wait for admin approval.');
      } else {
        setError(result.error);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🏫</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">Room Allocation</h1>
          <p className="text-sm text-gray-500 mt-1">NIT Raipur</p>
          <p className="text-xs text-gray-400 mt-2">Only @{ALLOWED_DOMAIN} email allowed</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {/* Links */}
          <div className="flex justify-between items-center mt-4">
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Forgot Password?
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              className={`mt-4 border-l-4 p-3 rounded-md text-sm ${
                pendingApproval
                  ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                  : 'bg-red-50 border-red-500 text-red-700'
              }`}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-5 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>

         
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
