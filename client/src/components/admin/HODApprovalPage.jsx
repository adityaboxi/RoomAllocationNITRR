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
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (user?.role === 'hod' && user?.hodApproval === 'approved') fetchPendingHODs();
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
    } finally { setProcessing(null); }
  };

  if (user?.role !== 'hod' || user?.hodApproval !== 'approved') return null;
  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><div><h2 className="text-2xl font-bold text-gray-800">👑 HOD Approval Management</h2><p className="text-gray-500">Review and manage pending HOD requests</p></div><div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-xl">{pendingHODs.length} Pending Requests</div></div>
      {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"><p className="text-red-700 text-sm">{error}</p></div>}
      {success && <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg"><p className="text-green-700 text-sm">{success}</p></div>}
      {pendingHODs.length === 0 ? <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100"><div className="text-5xl mb-4">🎉</div><p className="text-gray-500 text-lg">No pending HOD requests</p><p className="text-sm text-gray-400">All HOD requests have been processed</p></div> : <div className="grid grid-cols-1 gap-4">{pendingHODs.map(hod => <div key={hod._id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-200"><div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4"><div><div className="flex items-center gap-3"><h3 className="text-xl font-bold text-gray-800">{hod.name}</h3><span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-xl text-xs font-medium">⏳ Pending</span></div><div className="mt-2 space-y-1 text-sm text-gray-600"><p>📧 {hod.email}</p><p>🏛️ {hod.department} Department</p><p>🆔 Employee ID: {hod.employeeId}</p><p>📱 {hod.phone}</p><p className="text-xs text-gray-400">Requested: {new Date(hod.createdAt).toLocaleDateString()}</p></div></div><div className="flex gap-3"><button onClick={() => handleApprove(hod._id, 'approved')} disabled={processing === hod._id} className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-2 rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg">{processing === hod._id ? 'Processing...' : '✅ Approve'}</button><button onClick={() => handleApprove(hod._id, 'rejected')} disabled={processing === hod._id} className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-2 rounded-xl font-medium hover:from-red-600 hover:to-red-700 transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg">{processing === hod._id ? 'Processing...' : '❌ Reject'}</button></div></div></div>)}</div>}
    </div>
  );
};

export default HODApprovalPage;
