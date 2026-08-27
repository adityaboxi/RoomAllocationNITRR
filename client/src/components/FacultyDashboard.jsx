import React, { useState, useEffect } from 'react';
import { getRooms, getAvailableRooms, createBooking, getMyBookings, cancelBooking } from '../services/api';

export default function FacultyDashboard({ user }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bookingData, setBookingData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    purpose: '',
    comment: '',
  });
  const [myBookings, setMyBookings] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);

  useEffect(() => {
    fetchRooms();
    fetchMyBookings();
  }, []);

  useEffect(() => {
    if (bookingData.date && bookingData.startTime && bookingData.endTime) {
      fetchAvailableRooms();
    }
  }, [bookingData.date, bookingData.startTime, bookingData.endTime]);

  const fetchRooms = async () => {
    try {
      const data = await getRooms({ department: user.department });
      setRooms(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchAvailableRooms = async () => {
    try {
      const { date, startTime, endTime } = bookingData;
      if (!date || !startTime || !endTime) return;
      const data = await getAvailableRooms(date, startTime, endTime, { department: user.department });
      setAvailableRooms(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const data = await getMyBookings();
      setMyBookings(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBookingInput = (e) => {
    setBookingData({ ...bookingData, [e.target.name]: e.target.value });
  };

  const handleBookRoom = async (roomId) => {
    const { date, startTime, endTime, purpose, comment } = bookingData;
    if (!date || !startTime || !endTime || !purpose) {
      setError('Please fill all required fields.');
      return;
    }
    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }
    setLoading(true);
    try {
      await createBooking({ roomId, date, startTime, endTime, purpose, comment });
      setSuccess('Booking created successfully!');
      setBookingData({ date: '', startTime: '', endTime: '', purpose: '', comment: '' });
      setSelectedRoom(null);
      fetchMyBookings();
      fetchRooms();
      setAvailableRooms([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await cancelBooking(bookingId);
      fetchMyBookings();
      setSuccess('Booking cancelled.');
    } catch (err) {
      setError(err.message);
    }
  };

  const isRoomAvailable = (roomId) => {
    return availableRooms.some(r => r.id === roomId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Faculty Dashboard</h1>
      {error && <div className="bg-rose-50 text-rose-800 p-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-emerald-50 text-emerald-800 p-3 rounded mb-4">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">All Rooms</h2>
          <div className="space-y-4">
            {rooms.length === 0 && <p className="text-slate-500">No rooms found.</p>}
            {rooms.map((room) => {
              const available = isRoomAvailable(room.id);
              return (
                <div key={room.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between">
                  <div>
                    <h3 className="font-bold">{room.name}</h3>
                    <p className="text-sm text-slate-600">{room.floor} • Cap: {room.capacity}</p>
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${available ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {available ? 'Available' : 'Busy'}
                    </span>
                  </div>
                  {available && (
                    <button
                      onClick={() => setSelectedRoom(room.id)}
                      className="mt-2 md:mt-0 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800"
                    >
                      Book
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-2">Select date and time to check availability.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-fit">
          <h2 className="text-xl font-semibold mb-4">Book a Room</h2>
          <div className="space-y-2">
            <input
              type="date"
              name="date"
              value={bookingData.date}
              onChange={handleBookingInput}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              type="time"
              name="startTime"
              value={bookingData.startTime}
              onChange={handleBookingInput}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              type="time"
              name="endTime"
              value={bookingData.endTime}
              onChange={handleBookingInput}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              type="text"
              name="purpose"
              value={bookingData.purpose}
              onChange={handleBookingInput}
              placeholder="Purpose"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <textarea
              name="comment"
              value={bookingData.comment}
              onChange={handleBookingInput}
              placeholder="Comment (optional)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              rows="2"
            />
            {selectedRoom ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleBookRoom(selectedRoom)}
                  disabled={loading}
                  className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Booking...' : 'Confirm Booking'}
                </button>
                <button
                  onClick={() => setSelectedRoom(null)}
                  className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a room from the list to book.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">My Bookings</h2>
        {myBookings.length === 0 ? (
          <p className="text-slate-500">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-slate-200 rounded-xl">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left p-3 text-sm font-semibold">Room</th>
                  <th className="text-left p-3 text-sm font-semibold">Date</th>
                  <th className="text-left p-3 text-sm font-semibold">Time</th>
                  <th className="text-left p-3 text-sm font-semibold">Purpose</th>
                  <th className="text-left p-3 text-sm font-semibold">Status</th>
                  <th className="text-left p-3 text-sm font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {myBookings.map((b) => (
                  <tr key={b.id} className="border-b">
                    <td className="p-3 text-sm">{b.roomId?.name}</td>
                    <td className="p-3 text-sm">{b.date}</td>
                    <td className="p-3 text-sm">{b.startTime} - {b.endTime}</td>
                    <td className="p-3 text-sm">{b.purpose}</td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${b.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      {b.status === 'active' && (
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          className="text-rose-600 hover:text-rose-800 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}