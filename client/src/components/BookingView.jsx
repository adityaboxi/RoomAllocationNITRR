import React, { useState, useEffect, useRef } from 'react';
import {
  getRooms,
  getAvailableRooms,
  createBooking,
  getMyBookings,
  cancelBooking,
  getRoomReviews,
  lockRoom,
  unlockRoom,
} from '../services/api';
import {
  getSocket,
  onBookingCancelled,
  onBookingCreated,
  offBookingCancelled,
  offBookingCreated,
} from '../services/socket';
import ReviewsModal from './ReviewsModal';
import {
  Calendar,
  Clock,
  Building2,
  Users,
  Layers,
  Star,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';

const extractErrorMessage = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err.response?.data?.message || err.message || fallback;
};

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTimeHHMM = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const getDefaultEndHHMM = (startStr) => {
  if (!startStr) return '10:00';
  const [h, m] = startStr.split(':').map(Number);
  const nextH = (h + 1) % 24;
  return `${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export default function BookingView({ user }) {
  const todayStr = getTodayDateString();
  const currentHHMM = getCurrentTimeHHMM();
  const defaultEndHHMM = getDefaultEndHHMM(currentHHMM);

  const [rooms, setRooms] = useState([]);
  const [availableRoomIds, setAvailableRoomIds] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState(null);

  const [bookingData, setBookingData] = useState({
    date: todayStr,
    startTime: currentHHMM,
    endTime: defaultEndHHMM,
    purpose: '',
    comment: '',
  });

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeLockId, setActiveLockId] = useState(null);

  // Reviews state
  const [reviews, setReviews] = useState({});
  const [loadingReviews, setLoadingReviews] = useState({});
  const [selectedRoomReviews, setSelectedRoomReviews] = useState(null);
  const [selectedReviewRoom, setSelectedReviewRoom] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const abortControllerRef = useRef(null);

  // Initial Load
  useEffect(() => {
    if (user?.department) {
      Promise.all([fetchRooms(), fetchMyBookings()]).finally(() => {
        setInitialLoading(false);
      });
    }
  }, [user?.department]);

  // Query room availability whenever date or times change
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
  }, [bookingData.date, bookingData.startTime, bookingData.endTime, user?.department]);

  // Real-Time Socket.IO Synchronization (Bookings + Live Reviews)
  useEffect(() => {
    const handleBookingCancelled = (data) => {
      fetchAvailableRooms(abortControllerRef.current?.signal);
      fetchMyBookings();
      if (data?.roomName) {
        setSuccess(`Notification: Room "${data.roomName}" is now available.`);
      }
    };

    const handleBookingCreated = () => {
      fetchAvailableRooms(abortControllerRef.current?.signal);
    };

    onBookingCancelled(handleBookingCancelled);
    onBookingCreated(handleBookingCreated);

    // Live Socket.IO Listener for real-time review updates
    const socket = getSocket();
    const handleReviewCreated = ({ roomId, review }) => {
      if (!roomId || !review) return;
      const targetId = String(roomId);

      setReviews((prev) => {
        const raw = prev[targetId] || [];
        const existing = Array.isArray(raw) ? raw : raw.reviews || [];
        const filtered = existing.filter((r) => (r.id || r._id) !== (review.id || review._id));
        return {
          ...prev,
          [targetId]: [review, ...filtered],
        };
      });

      if (selectedReviewRoom && String(selectedReviewRoom.id || selectedReviewRoom._id) === targetId) {
        setSelectedRoomReviews((prev) => [review, ...(prev || [])]);
      }
    };

    if (socket) {
      socket.on('review-created', handleReviewCreated);
    }

    return () => {
      offBookingCancelled(handleBookingCancelled);
      offBookingCreated(handleBookingCreated);
      if (socket) {
        socket.off('review-created', handleReviewCreated);
      }
    };
  }, [selectedReviewRoom]);

  // Cleanup room lock if component unmounts while booking modal is open
  useEffect(() => {
    return () => {
      if (activeLockId) {
        unlockRoom(activeLockId).catch(() => {});
      }
    };
  }, [activeLockId]);

  // ---------- API HANDLERS ----------
  const fetchRooms = async () => {
    try {
      const data = await getRooms({ department: user?.department });
      const roomList = data?.data || [];
      setRooms(roomList);

      // Pre-fetch reviews for all rooms to show stars immediately on cards
      roomList.forEach((r) => {
        const rId = r.id || r._id;
        fetchReviewsForRoom(rId);
      });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load department rooms.'));
    }
  };

  const fetchAvailableRooms = async (signal) => {
    try {
      const { date, startTime, endTime } = bookingData;
      let end = endTime;

      if (!end && startTime) {
        end = getDefaultEndHHMM(startTime);
      }

      if (!date || !startTime || !end || startTime >= end) {
        setAvailableRoomIds([]);
        return;
      }

      const data = await getAvailableRooms(
        date,
        startTime,
        end,
        { department: user?.department },
        { signal }
      );

      const ids = (data?.data || []).map((r) => r.id || r._id);
      setAvailableRoomIds(ids);
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  };

  const fetchMyBookings = async () => {
    try {
      const data = await getMyBookings();
      setMyBookings(data?.data || []);
    } catch (err) {
      // Non-critical fallback
    }
  };

  const fetchReviewsForRoom = async (roomId) => {
    if (loadingReviews[roomId]) return;
    setLoadingReviews((prev) => ({ ...prev, [roomId]: true }));
    try {
      const data = await getRoomReviews(roomId);
      const reviewsArray = data?.data?.reviews || (Array.isArray(data?.data) ? data.data : []);
      setReviews((prev) => ({ ...prev, [roomId]: reviewsArray }));
    } catch (err) {
      // Non-critical fallback
    } finally {
      setLoadingReviews((prev) => ({ ...prev, [roomId]: false }));
    }
  };

  const handleViewReviews = (room) => {
    const roomId = room.id || room._id;
    const raw = reviews[roomId] || [];
    const list = Array.isArray(raw) ? raw : raw.reviews || [];

    setSelectedReviewRoom(room);
    setSelectedRoomReviews(list);
    fetchReviewsForRoom(roomId);
  };

  useEffect(() => {
    if (selectedReviewRoom) {
      const roomId = selectedReviewRoom.id || selectedReviewRoom._id;
      const raw = reviews[roomId] || [];
      const list = Array.isArray(raw) ? raw : raw.reviews || [];
      setSelectedRoomReviews(list);
    }
  }, [reviews, selectedReviewRoom]);

  const handleBookingInput = (e) => {
    const { name, value } = e.target;
    setBookingData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'startTime' && value) {
        if (!prev.endTime || prev.endTime <= value) {
          updated.endTime = getDefaultEndHHMM(value);
        }
      }
      return updated;
    });
    setError('');
  };

  // Select a room & initiate temporary lock
  const handleSelectRoom = async (room) => {
    const roomId = room.id || room._id;
    setSelectedRoom(room);
    setError('');

    try {
      const lockRes = await lockRoom(
        roomId,
        bookingData.date,
        bookingData.startTime,
        bookingData.endTime
      );
      if (lockRes.success && lockRes.lockId) {
        setActiveLockId(lockRes.lockId);
      }
    } catch (err) {
      // Handled silently
    }
  };

  const handleCancelSelectedRoom = async () => {
    if (activeLockId) {
      unlockRoom(activeLockId).catch(() => {});
      setActiveLockId(null);
    }
    setSelectedRoom(null);
  };

  // Submit confirmed booking
  const handleConfirmBooking = async () => {
    if (!selectedRoom) return;
    const roomId = selectedRoom.id || selectedRoom._id;

    let { date, startTime, endTime, purpose, comment } = bookingData;

    // Validate inputs
    if (!date || !startTime || !endTime || !purpose.trim()) {
      setError('Please provide Date, Start Time, End Time, and Purpose.');
      return;
    }

    if (startTime >= endTime) {
      setError('Start time must be strictly before end time.');
      return;
    }

    // Past-time check for today
    if (date === todayStr && startTime < currentHHMM) {
      setError(`Cannot book past hours for today (Current local time: ${currentHHMM}).`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await createBooking({
        roomId,
        date,
        startTime,
        endTime,
        purpose: purpose.trim(),
        comment: (comment || '').trim() || 'No comment provided',
        lockId: activeLockId,
      });

      setSuccess(`Room "${selectedRoom.name}" booked successfully! Confirmation details sent.`);
      setBookingData((prev) => ({ ...prev, purpose: '', comment: '' }));
      setSelectedRoom(null);
      setActiveLockId(null);

      await Promise.all([
        fetchMyBookings(),
        fetchAvailableRooms(abortControllerRef.current?.signal),
      ]);
    } catch (err) {
      setError(extractErrorMessage(err, 'Booking failed. Room slot may have been reserved by another faculty.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    const confirmCancel = window.confirm('Are you sure you want to cancel this booking?');
    if (!confirmCancel) return;

    setCancellingBookingId(bookingId);
    setError('');
    setSuccess('');
    try {
      await cancelBooking(bookingId);
      setSuccess('Booking cancelled successfully.');
      await Promise.all([
        fetchMyBookings(),
        fetchAvailableRooms(abortControllerRef.current?.signal),
      ]);
    } catch (err) {
      setError(extractErrorMessage(err, 'Cancellation failed.'));
    } finally {
      setCancellingBookingId(null);
    }
  };

  const isRoomAvailable = (room) => {
    const id = room.id || room._id;
    return availableRoomIds.includes(id);
  };

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start text-rose-800 text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 mr-2.5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 whitespace-pre-line font-medium">{error}</div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start text-emerald-800 text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 mr-2.5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{success}</div>
          <button type="button" onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Date & Time Selection Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Select Desired Booking Slot
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono font-medium">
            Local Time: {currentHHMM}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
            <input
              type="date"
              name="date"
              min={todayStr}
              value={bookingData.date}
              onChange={handleBookingInput}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time *</label>
            <input
              type="time"
              name="startTime"
              value={bookingData.startTime}
              onChange={handleBookingInput}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">End Time *</label>
            <input
              type="time"
              name="endTime"
              value={bookingData.endTime}
              onChange={handleBookingInput}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Available Department Rooms Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <span>Room Availability for {bookingData.date} ({bookingData.startTime} - {bookingData.endTime})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Green rooms are free during your selected time window.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg">
            {availableRoomIds.length} of {rooms.length} Free
          </span>
        </div>

        {initialLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading available rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-sm">No rooms found in your department.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rooms.map((room) => {
              const roomId = room.id || room._id;
              const available = isRoomAvailable(room);
              const rawReviews = reviews[roomId] || [];
              const roomReviews = Array.isArray(rawReviews) ? rawReviews : rawReviews.reviews || [];
              const avgRating =
                roomReviews.length > 0
                  ? (
                      roomReviews.reduce((acc, r) => acc + (r.rating || 0), 0) / roomReviews.length
                    ).toFixed(1)
                  : null;

              return (
                <div
                  key={roomId}
                  className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all duration-200 ${
                    available
                      ? 'border-slate-200 hover:border-indigo-400 hover:shadow-md'
                      : 'border-slate-200/60 opacity-60 bg-slate-50/50'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-base text-slate-900 leading-tight">
                          {room.name}
                        </h4>
                        <div className="text-xs font-mono text-slate-500 mt-0.5">
                          {room.roomNumber}
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                          available
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {available ? 'Free for Slot' : 'Occupied / Class'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-2 mt-2">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        Cap: {room.capacity}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        {room.floor}, {room.building}
                      </span>
                    </div>

                    {/* Amenities Badges */}
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                      {room.hasProjector && (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                          Projector
                        </span>
                      )}
                      {room.hasAC && (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                          AC
                        </span>
                      )}
                      {room.hasSmartBoard && (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                          SmartBoard
                        </span>
                      )}
                      {room.hasWiFi && (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                          WiFi
                        </span>
                      )}
                    </div>

                    {/* Live Star Ratings on Room Card */}
                    <div className="mt-3.5 flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-xs font-bold text-slate-700">
                          {avgRating ? `${avgRating} ★` : 'No ratings'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewReviews(room)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        {roomReviews.length > 0 ? `(${roomReviews.length} reviews)` : 'Reviews'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-2">
                    {available ? (
                      <button
                        type="button"
                        onClick={() => handleSelectRoom(room)}
                        className="w-full bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
                      >
                        Reserve This Room
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full bg-slate-100 text-slate-400 px-4 py-2 rounded-xl text-xs font-semibold cursor-not-allowed"
                      >
                        Unavailable for this slot
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking Confirmation Drawer / Form */}
      {selectedRoom && (
        <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 shadow-xl animate-fadeIn">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Reservation: {selectedRoom.name} ({selectedRoom.roomNumber})
                </h3>
                <p className="text-xs text-slate-500">
                  Date: {bookingData.date} | Time: {bookingData.startTime} - {bookingData.endTime}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelSelectedRoom}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purpose of Reservation *
              </label>
              <input
                type="text"
                name="purpose"
                value={bookingData.purpose}
                onChange={handleBookingInput}
                placeholder="e.g. Remedial Lecture, Seminar, Project Presentation"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Additional Comments / Requests
              </label>
              <input
                type="text"
                name="comment"
                value={bookingData.comment}
                onChange={handleBookingInput}
                placeholder="e.g. Projector & mic setup needed"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
              />
            </div>
          </div>

          <div className="mt-5 flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancelSelectedRoom}
              className="bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmBooking}
              disabled={loading}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Confirming Booking...</span>
                </>
              ) : (
                <>
                  <span>Confirm Reservation</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* User's Active Bookings Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-600" />
            <h3 className="text-base font-bold text-slate-900">
              My Scheduled Bookings ({myBookings.length})
            </h3>
          </div>
        </div>

        {myBookings.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            You have no active or completed room bookings yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {myBookings.map((b) => {
                  const bookingId = b.id || b._id;
                  const isCancelled = b.status === 'cancelled';
                  const isActive = b.status === 'active';
                  const isCancelling = cancellingBookingId === bookingId;

                  return (
                    <tr key={bookingId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 text-sm">
                        <div className="font-bold text-slate-900">{b.roomId?.name || 'Room'}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {b.roomId?.roomNumber || ''}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-sm">
                        <div className="font-semibold text-slate-800">{b.date}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {b.startTime} - {b.endTime}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-sm text-slate-700">
                        <div className="font-medium">{b.purpose}</div>
                        {b.comment && b.comment !== 'No comment provided' && (
                          <div className="text-xs text-slate-400 italic mt-0.5">{b.comment}</div>
                        )}
                        {b.conflictMessage && (
                          <div className="text-xs text-rose-600 mt-1 font-medium">
                            {b.conflictMessage}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : isCancelled
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-sm text-right whitespace-nowrap">
                        {isActive && (
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(bookingId)}
                            disabled={isCancelling}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline disabled:opacity-40"
                          >
                            {isCancelling ? 'Cancelling...' : 'Cancel Slot'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reviews Modal */}
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