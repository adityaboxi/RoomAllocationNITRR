import React, { useState, useEffect, useRef } from 'react';
import {
  getRooms,
  getAvailableRooms,
  createBooking,
  getMyBookings,
  cancelBooking,
  getRoomReviews,
} from '../services/api';
import {
  onBookingCreated,
  offBookingCreated,
  onBookingCancelled,
  offBookingCancelled,
} from '../services/socket';
import ReviewsModal from './ReviewsModal';

export default function BookingView({ user }) {
  const [rooms, setRooms] = useState([]);
  const [availableRoomIds, setAvailableRoomIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bookingData, setBookingData] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: new Date().toTimeString().slice(0, 5),
    endTime: '',
    purpose: '',
    comment: '',
  });
  const [myBookings, setMyBookings] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviews, setReviews] = useState({});
  const [loadingReviews, setLoadingReviews] = useState({});
  const [selectedRoomReviews, setSelectedRoomReviews] = useState(null);
  const [selectedReviewRoom, setSelectedReviewRoom] = useState(null);

  const abortControllerRef = useRef(null);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Fetch rooms and my bookings on mount
  useEffect(() => {
    if (user) {
      fetchRooms();
      fetchMyBookings();
    }
  }, [user]);

  // Fetch available rooms whenever date/time changes
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    fetchAvailableRooms(abortControllerRef.current.signal);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [bookingData.date, bookingData.startTime, bookingData.endTime]);

  // ---------- SOCKET LISTENERS ----------
  useEffect(() => {
    const handleBookingCancelled = (data) => {
      console.log('🔔 Booking cancelled by another user:', data);
      fetchAvailableRooms(abortControllerRef.current?.signal);
      fetchMyBookings();
      setSuccess(`Room "${data.roomName}" is now available.`);
    };

    const handleBookingCreated = (data) => {
      console.log('📌 Booking created by another user:', data);
      fetchAvailableRooms(abortControllerRef.current?.signal);
    };

    onBookingCancelled(handleBookingCancelled);
    onBookingCreated(handleBookingCreated);

    return () => {
      offBookingCancelled(handleBookingCancelled);
      offBookingCreated(handleBookingCreated);
    };
  }, []);

  // ---------- API functions ----------
  const fetchRooms = async () => {
    try {
      const data = await getRooms({ department: user.department });
      setRooms(data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load rooms');
    }
  };

  const fetchAvailableRooms = async (signal) => {
    try {
      const { date, startTime, endTime } = bookingData;
      let end = endTime;
      if (!end && startTime) {
        const [h, m] = startTime.split(':').map(Number);
        const endH = h + 1;
        end = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      if (!date || !startTime || !end) {
        setAvailableRoomIds([]);
        return;
      }
      const data = await getAvailableRooms(date, startTime, end, { department: user.department }, { signal });
      const ids = (data.data || []).map(r => r.id);
      setAvailableRoomIds(ids);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to check availability');
    }
  };

  const fetchMyBookings = async () => {
    try {
      const data = await getMyBookings();
      setMyBookings(data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load bookings');
    }
  };

  // ✅ FIXED: extract reviews array correctly
  const fetchReviewsForRoom = async (roomId) => {
    if (loadingReviews[roomId]) return;
    setLoadingReviews(prev => ({ ...prev, [roomId]: true }));
    try {
      const data = await getRoomReviews(roomId);
      // data.data = { reviews: [], avgRating, count }
      const reviewsArray = data.data?.reviews || data.data || [];
      setReviews(prev => ({ ...prev, [roomId]: reviewsArray }));
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
      setReviews(prev => ({ ...prev, [roomId]: [] }));
    } finally {
      setLoadingReviews(prev => ({ ...prev, [roomId]: false }));
    }
  };

  // ✅ FIXED: open modal immediately with empty array, fetch in background
  const handleViewReviews = (room) => {
    if (reviews[room.id] && reviews[room.id].length > 0) {
      setSelectedReviewRoom(room);
      setSelectedRoomReviews(reviews[room.id]);
      return;
    }
    // Open modal with empty array
    setSelectedReviewRoom(room);
    setSelectedRoomReviews([]);
    fetchReviewsForRoom(room.id);
  };

  // Sync when reviews for selected room update
  useEffect(() => {
    if (selectedReviewRoom && reviews[selectedReviewRoom.id]) {
      setSelectedRoomReviews(reviews[selectedReviewRoom.id]);
    }
  }, [reviews, selectedReviewRoom]);

  const handleBookingInput = (e) => {
    setBookingData({ ...bookingData, [e.target.name]: e.target.value });
  };

  const handleBookRoom = async (roomId) => {
    console.log('🟢 handleBookRoom called with roomId:', roomId);

    let { date, startTime, endTime, purpose, comment } = bookingData;

    // Auto-fill endTime if missing (default: +1 hour)
    if (!endTime && startTime) {
      const [h, m] = startTime.split(':').map(Number);
      const endH = (h + 1) % 24;
      const endM = m;
      const autoEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      setBookingData(prev => ({ ...prev, endTime: autoEnd }));
      endTime = autoEnd;
      console.log('⏰ Auto-filled endTime:', endTime);
    }

    console.log('📦 Booking data:', { date, startTime, endTime, purpose, comment });

    if (!date || !startTime || !endTime || !purpose) {
      setError('Please fill all required fields (Date, Start, End, Purpose).');
      return;
    }
    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await createBooking({ roomId, date, startTime, endTime, purpose, comment });
      console.log('✅ Booking success:', result);
      setSuccess('Booking created successfully!');
      setBookingData({ ...bookingData, purpose: '', comment: '', endTime: '' });
      setSelectedRoom(null);
      await Promise.all([fetchMyBookings(), fetchAvailableRooms(abortControllerRef.current?.signal)]);
    } catch (err) {
      console.error('❌ Booking error:', err);
      const message = err.response?.data?.message || err.message || 'Booking failed. Please try again.';
      setError(message);
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
      setError(err.message || 'Cancellation failed');
    }
  };

  const isRoomAvailable = (roomId) => availableRoomIds.includes(roomId);
  const isTimeFilled = bookingData.date && bookingData.startTime && bookingData.endTime;

  return (
    <div>
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

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
          {isTimeFilled ? 'Select a room below' : 'Fill date/time to see availability'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.length === 0 && <p className="text-slate-500">No rooms found.</p>}
        {rooms.map((room) => {
          const available = isRoomAvailable(room.id);
          const roomReviews = reviews[room.id] || []; // ✅ now it's always an array
          const avgRating = roomReviews.length > 0
            ? (roomReviews.reduce((acc, r) => acc + r.rating, 0) / roomReviews.length).toFixed(1)
            : null;
          const reviewCount = roomReviews.length;

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

              <div className="mt-3 flex items-center gap-2">
                {avgRating ? (
                  <span className="text-sm font-medium text-amber-600">{avgRating} ★</span>
                ) : (
                  <span className="text-xs text-slate-400">No reviews</span>
                )}
                <button
                  onClick={() => handleViewReviews(room)}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  {reviewCount > 0 ? `(${reviewCount})` : 'Add review'}
                </button>
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

      {/* ✅ Correct modal rendering – shows even when reviews are empty */}
      {selectedReviewRoom && selectedRoomReviews !== null && (
        <ReviewsModal
          room={selectedReviewRoom}
          reviews={selectedRoomReviews}
          onClose={() => {
            setSelectedReviewRoom(null);
            setSelectedRoomReviews(null);
          }}
        />
      )}
    </div>
  );
}