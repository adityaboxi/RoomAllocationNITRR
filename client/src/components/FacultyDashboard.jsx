import React, { useState, useEffect } from 'react';
import { getRooms, getAvailableRooms, createBooking, getMyBookings, cancelBooking } from '../services/api';
import { getDayOfWeek, formatDate } from '../utils/helpers';

export default function FacultyDashboard({ user }) {
  // All rooms (for display)
  const [rooms, setRooms] = useState([]);
  // Available room IDs for the selected date/time
  const [availableRoomIds, setAvailableRoomIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Booking form state
  const [bookingData, setBookingData] = useState({
    date: new Date().toISOString().split('T')[0], // today
    startTime: new Date().toTimeString().slice(0, 5), // current time (HH:MM)
    endTime: '',
    purpose: '',
    comment: '',
  });

  const [myBookings, setMyBookings] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch all rooms and available rooms on mount and when date/time changes
  useEffect(() => {
    fetchRooms();
    fetchMyBookings();
  }, []);

  useEffect(() => {
    if (bookingData.date && bookingData.startTime && bookingData.endTime) {
      fetchAvailableRooms();
    } else {
      // If no time selected, just show all rooms with a default status
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
      // If no end time, set a default (e.g., +1 hour)
      let end = endTime;
      if (!end && startTime) {
        const [h, m] = startTime.split(':').map(Number);
        const endH = h + 1;
        end = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      if (!date || !startTime || !end) {
        // If missing data, just mark none available (or all)
        setAvailableRoomIds([]);
        return;
      }
      const data = await getAvailableRooms(date, startTime, end, { department: user.department });
      const ids = (data.data || []).map(r => r.id);
      setAvailableRoomIds(ids);
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
      setBookingData({
        ...bookingData,
        purpose: '',
        comment: '',
      });
      setSelectedRoom(null);
      fetchMyBookings();
      fetchAvailableRooms(); // refresh availability
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

  // Check if a room is available for the selected time
  const isRoomAvailable = (roomId) => {
    return availableRoomIds.includes(roomId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Faculty Dashboard</h1>

      {error && <div className="bg-rose-50 text-rose-800 p-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-emerald-50 text-emerald-800 p-3 rounded mb-4">{success}</div>}

      {/* Time Selection Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
          <input
            type="date"
            name="date"
            value={bookingData.date}
            onChange={handleBookingInput}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Start Time</label>
          <input
            type="time"
            name="startTime"
            value={bookingData.startTime}
            onChange={handleBookingInput}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">End Time</label>
          <input
            type="time"
            name="endTime"
            value={bookingData.endTime}
            onChange={handleBookingInput}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="text-xs text-slate-500 italic">
          Select a time slot to see room availability.
        </div>
      </div>

      {/* Room Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.length === 0 && <p className="text-slate-500">No rooms found.</p>}
        {rooms.map((room) => {
          const available = isRoomAvailable(room.id);
          return (
            <div key={room.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{room.name}</h3>
                  <p className="text-sm text-slate-600">{room.floor} • Cap: {room.capacity}</p>
                  <p className="text-xs text-slate-500">{room.building}</p>
                </div>
                <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${available ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {available ? 'Available' : 'Booked'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                {room.hasProjector && <span className="bg-slate-100 px-2 py-0.5 rounded">Projector</span>}
                {room.hasAC && <span className="bg-slate-100 px-2 py-0.5 rounded">AC</span>}
                {room.hasSmartBoard && <span className="bg-slate-100 px-2 py-0.5 rounded">SmartBoard</span>}
                {room.hasWiFi && <span className="bg-slate-100 px-2 py-0.5 rounded">WiFi</span>}
              </div>
              <div className="mt-4">
                {available ? (
                  <button
                    onClick={() => setSelectedRoom(room.id)}
                    className="w-full bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800"
                  >
                    Book Now
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full bg-slate-100 text-slate-400 px-4 py-2 rounded-lg text-sm font-semibold cursor-not-allowed"
                  >
                    Unavailable
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Booking Form (appears when a room is selected) */}
      {selectedRoom && (
        <div className="mt-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Book Room</h2>
          <p className="text-sm text-slate-600 mb-4">Room ID: {selectedRoom}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Purpose</label>
              <input
                type="text"
                name="purpose"
                value={bookingData.purpose}
                onChange={handleBookingInput}
                placeholder="e.g., Lecture, Meeting"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Comment (optional)</label>
              <input
                type="text"
                name="comment"
                value={bookingData.comment}
                onChange={handleBookingInput}
                placeholder="Any notes"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => handleBookRoom(selectedRoom)}
              disabled={loading}
              className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Booking...' : 'Confirm Booking'}
            </button>
            <button
              onClick={() => setSelectedRoom(null)}
              className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg text-sm font-semibold hover:bg-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* My Bookings Table */}
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