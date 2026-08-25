import { useState } from 'react';
import { bookingAPI } from '../../services/api';

const BookingModal = ({ room, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ date: '', startTime: '', endTime: '', subject: '', comment: 'No comment provided' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await bookingAPI.book({ roomId: room._id, ...formData });
      onSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
        <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-800">Book Room <span className="text-blue-600">{room.roomNumber}</span></h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} min={new Date().toISOString().split('T')[0]} /></div>
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label><input type="time" required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">End Time</label><input type="time" required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} /></div></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject</label><input type="text" required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="Enter subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Comment (Optional)</label><textarea className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" rows="2" placeholder="Add a comment..." value={formData.comment} onChange={(e) => setFormData({ ...formData, comment: e.target.value })} /></div>
          </div>
          {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"><p className="text-red-700 text-sm">{error}</p></div>}
          <div className="flex gap-3 mt-6"><button type="submit" disabled={loading} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 shadow-lg">{loading ? 'Booking...' : 'Confirm Booking'}</button><button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-200">Cancel</button></div>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;
