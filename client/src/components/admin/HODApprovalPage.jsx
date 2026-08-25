import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';

const HODApprovalPage = () => {
  const { user } = useAuth();
  const [pendingHODs, setPendingHODs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPendingHODs = async () => {
    try {
      const response = await authAPI.getPendingHODs();
      setPendingHODs(response.data.data || []);
    } catch (err) {
      setError('Failed to fetch pending HOD requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'hod' && user?.hodApproval === 'approved') {
      fetchPendingHODs();
    }
  }, [user]);

  const handleApprove = async (id, status) => {
    if (!window.confirm(`Are you sure you want to ${status} this HOD request?`)) return;

    setProcessing(id);
    setError('');
    setSuccess('');

    try {
      await authAPI.approveHOD(id, status);
      setSuccess(`HOD request ${status} successfully!`);
      fetchPendingHODs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process request');
    } finally {
      setProcessing(null);
    }
  };

  if (user?.role !== 'hod' || user?.hodApproval !== 'approved') return null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">HOD Approval</h2>
          <p className="text-sm text-gray-500 mt-1">Review pending HOD requests</p>
        </div>
        {pendingHODs.length > 0 && (
          <span className="bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">
            {pendingHODs.length} Pending
          </span>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md mb-4">
          {success}
        </div>
      )}

      {/* No Pending */}
      {pendingHODs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-10 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <p className="text-gray-600 font-medium">No pending requests</p>
          <p className="text-sm text-gray-400 mt-1">All HOD requests have been processed</p>
        </div>
      ) : (
        /* Pending List */
        <div className="space-y-3">
          {pendingHODs.map((hod) => (
            <div
              key={hod._id}
              className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 hover:shadow-md transition"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Left - User Info */}
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-medium text-gray-800">{hod.name}</h3>
                    <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      Pending
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-sm text-gray-600">
                    <p className="flex items-center gap-1">
                      <span className="text-gray-400">📧</span> {hod.email}
                    </p>
                    <p className="flex items-center gap-1">
                      <span className="text-gray-400">🏛️</span> {hod.department} Department
                    </p>
                    <p className="flex items-center gap-1">
                      <span className="text-gray-400">🆔</span> ID: {hod.employeeId}
                    </p>
                    <p className="flex items-center gap-1">
                      <span className="text-gray-400">📱</span> {hod.phone}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Requested: {new Date(hod.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Right - Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(hod._id, 'approved')}
                    disabled={processing === hod._id}
                    className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition disabled:opacity-50"
                  >
                    {processing === hod._id ? '...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleApprove(hod._id, 'rejected')}
                    disabled={processing === hod._id}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition disabled:opacity-50"
                  >
                    {processing === hod._id ? '...' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HODApprovalPage;
