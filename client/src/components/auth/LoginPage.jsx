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
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
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
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-2">
            <button type="button" onClick={() => navigate('/signup')} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Create Account</button>
            <button type="button" onClick={() => navigate('/forgot-password')} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Forgot Password?</button>
          </div>

          {error && (
            <div className={`mt-4 border-l-4 p-4 rounded-lg ${pendingApproval ? 'bg-yellow-50 border-yellow-500' : 'bg-red-50 border-red-500'}`}>
              <p className={`text-sm ${pendingApproval ? 'text-yellow-700' : 'text-red-700'}`}>{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="mt-6 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl">
            {loading ? 'Logging in...' : 'Sign In'}
          </button>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
            <p className="font-medium text-gray-600">Demo Accounts</p>
            <div className="mt-2 space-y-1">
              <p className="text-xs">HOD: <span className="font-mono text-blue-600">{DEMO_ACCOUNTS.hod.email}</span> / <span className="font-mono">{DEMO_ACCOUNTS.hod.password}</span></p>
              <p className="text-xs">Professor: <span className="font-mono text-blue-600">{DEMO_ACCOUNTS.professor.email}</span> / <span className="font-mono">{DEMO_ACCOUNTS.professor.password}</span></p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
