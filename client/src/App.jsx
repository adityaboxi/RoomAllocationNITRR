import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

// ============================================
// PAGES
// ============================================

// Home Page
const HomePage = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await axios.get('http://localhost:3000/health');
        setStatus(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Server is not responding');
      } finally {
        setLoading(false);
      }
    };
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">🏫</div>
          <h1 className="text-5xl font-bold text-blue-700 mb-2">
            Room Allocation System
          </h1>
          <p className="text-xl text-gray-600">NIT Raipur</p>
          <p className="text-sm text-gray-500 mt-2">React + Vite + Tailwind CSS</p>
        </div>

        {/* Status Card */}
        <div className="max-w-2xl mx-auto">
          <div className="card">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Server Status
            </h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-700">{error}</p>
                <p className="text-sm text-gray-600 mt-2">
                  Make sure the server is running on port 3000
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-600">Status</span>
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                    ✅ {status.status}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-600">MongoDB</span>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {status.mongodb}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-600">Port</span>
                  <span className="font-mono">{status.port}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Uptime</span>
                  <span className="font-mono">{Math.round(status.uptime)}s</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="max-w-2xl mx-auto mt-8">
          <div className="card">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Link 
                to="/test"
                className="bg-blue-500 hover:bg-blue-600 text-white text-center py-3 px-4 rounded-lg transition duration-200"
              >
                🧪 Test API
              </Link>
              <Link 
                to="/echo"
                className="bg-green-500 hover:bg-green-600 text-white text-center py-3 px-4 rounded-lg transition duration-200"
              >
                📤 Send Data
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>Room Allocation System - NIT Raipur</p>
        </div>
      </div>
    </div>
  );
};

// Test API Page
const TestPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGetRequest = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('http://localhost:3000/api/test', {
        params: { name: 'Aditya', department: 'CSE' }
      });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePostRequest = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:3000/api/echo', {
        message: 'Hello from React!',
        name: 'Aditya Boxi',
        role: 'HOD'
      });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUserRequest = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('http://localhost:3000/api/users/123');
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Home
        </Link>
        
        <div className="card">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">🧪 API Testing</h1>
          
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={handleGetRequest}
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              GET /api/test
            </button>
            <button
              onClick={handlePostRequest}
              disabled={loading}
              className="btn-success disabled:opacity-50"
            >
              POST /api/echo
            </button>
            <button
              onClick={handleUserRequest}
              disabled={loading}
              className="btn-outline disabled:opacity-50"
            >
              GET /api/users/:id
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {data && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">📥 Response:</h3>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Echo Page (POST testing with form)
const EchoPage = () => {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: 'Aditya Boxi',
    role: 'HOD',
    department: 'CSE',
    message: 'This is a test message',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:3000/api/echo', formData);
      setResponse(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Home
        </Link>
        
        <div className="card">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">📤 Send Data to Server</h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="input-label">Role</label>
              <input
                type="text"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="input-label">Department</label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="input-label">Message</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                className="input"
                rows="3"
                required
              ></textarea>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send to Server'}
            </button>
          </form>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mt-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {response && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-700 mb-2">📥 Server Response:</h3>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN APP WITH ROUTING
// ============================================

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/echo" element={<EchoPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
