import React, { useState, useEffect, useRef } from 'react';
import { getRooms, getAvailableRooms, getRoomReviews } from '../services/api';
import { getSocket } from '../services/socket';
import ReviewsModal from './ReviewsModal';
import {
  Building2,
  Clock,
  Search,
  Star,
  Users,
  Layers,
  AlertCircle,
  RefreshCw,
  X,
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

const getCurrentTimeString = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

export default function RoomDashboard({ user }) {
  const [rooms, setRooms] = useState([]);
  const [availableRoomIds, setAvailableRoomIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [filterProjector, setFilterProjector] = useState(false);
  const [filterAC, setFilterAC] = useState(false);
  const [filterSmartBoard, setFilterSmartBoard] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState({});
  const [loadingReviews, setLoadingReviews] = useState({});
  const [selectedRoomReviews, setSelectedRoomReviews] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError('');

    try {
      const date = getTodayDateString();
      const startTime = getCurrentTimeString();
      const [h, m] = startTime.split(':').map(Number);
      const endH = (h + 1) % 24;
      const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      const dept = user?.department;

      const [roomsRes, availRes] = await Promise.all([
        getRooms({ department: dept }),
        getAvailableRooms(date, startTime, endTime, { department: dept }),
      ]);

      if (isMountedRef.current) {
        const fetchedRooms = roomsRes?.data || [];
        setRooms(fetchedRooms);
        const ids = (availRes?.data || []).map((r) => r.id || r._id);
        setAvailableRoomIds(ids);
        setCurrentTime(new Date());

        // Pre-fetch reviews for all fetched rooms to populate star ratings
        fetchedRooms.forEach((r) => {
          const rId = r.id || r._id;
          fetchReviewsForRoom(rId);
        });
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(extractErrorMessage(err, 'Failed to refresh room availability.'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const fetchReviewsForRoom = async (roomId) => {
    if (loadingReviews[roomId]) return;
    setLoadingReviews((prev) => ({ ...prev, [roomId]: true }));

    try {
      const data = await getRoomReviews(roomId);
      const reviewsArray = data?.data?.reviews || (Array.isArray(data?.data) ? data.data : []);
      if (isMountedRef.current) {
        setReviews((prev) => ({ ...prev, [roomId]: reviewsArray }));
        if (selectedRoom && (selectedRoom.id === roomId || selectedRoom._id === roomId)) {
          setSelectedRoomReviews(reviewsArray);
        }
      }
    } catch (err) {
      // Non-critical background lookup handled silently
    } finally {
      if (isMountedRef.current) {
        setLoadingReviews((prev) => ({ ...prev, [roomId]: false }));
      }
    }
  };

  const handleViewReviews = (room) => {
    const roomId = room.id || room._id;
    setSelectedRoom(room);

    if (reviews[roomId]) {
      setSelectedRoomReviews(reviews[roomId]);
    } else {
      setSelectedRoomReviews([]);
      fetchReviewsForRoom(roomId);
    }
  };

  // Continuous background synchronization (polls every 15s to keep live time & status fresh)
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 15000);

    return () => clearInterval(interval);
  }, [user?.department]);

  // Real-time Socket.IO Listeners (Instant triggers for all actions + Real-time Reviews)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = () => {
      if (isMountedRef.current) {
        fetchData();
      }
    };

    // Live Socket listener for newly submitted reviews
    const handleReviewCreated = ({ roomId, review }) => {
      if (!isMountedRef.current || !roomId || !review) return;
      const targetId = String(roomId);

      setReviews((prev) => {
        const existing = prev[targetId] || [];
        const filtered = existing.filter((r) => (r.id || r._id) !== (review.id || review._id));
        return {
          ...prev,
          [targetId]: [review, ...filtered],
        };
      });

      if (selectedRoom && String(selectedRoom.id || selectedRoom._id) === targetId) {
        setSelectedRoomReviews((prev) => [review, ...(prev || [])]);
      }
    };

    socket.on('booking-created', handleUpdate);
    socket.on('booking-cancelled', handleUpdate);
    socket.on('room-locked', handleUpdate);
    socket.on('room-unlocked', handleUpdate);
    socket.on('timetable-updated', handleUpdate);
    socket.on('review-created', handleReviewCreated);

    return () => {
      socket.off('booking-created', handleUpdate);
      socket.off('booking-cancelled', handleUpdate);
      socket.off('room-locked', handleUpdate);
      socket.off('room-unlocked', handleUpdate);
      socket.off('timetable-updated', handleUpdate);
      socket.off('review-created', handleReviewCreated);
    };
  }, [selectedRoom]);

  const isRoomAvailable = (room) => {
    const id = room.id || room._id;
    return availableRoomIds.includes(id);
  };

  // Extract unique floors
  const floors = ['ALL', ...new Set(rooms.map((r) => r.floor).filter(Boolean))];

  // Filtered rooms
  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      searchTerm === '' ||
      room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.building.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFloor = selectedFloor === 'ALL' || room.floor === selectedFloor;
    const matchesProjector = !filterProjector || room.hasProjector;
    const matchesAC = !filterAC || room.hasAC;
    const matchesSmartBoard = !filterSmartBoard || room.hasSmartBoard;

    return matchesSearch && matchesFloor && matchesProjector && matchesAC && matchesSmartBoard;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Live Department Room Occupancy
              </h2>
              <p className="text-xs text-slate-400">
                Real-time occupancy status for {user?.department}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentTime.toLocaleTimeString()}</span>
            </span>

            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by room name, number, or building..."
              className="w-full pl-10 pr-3.5 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="sm:col-span-6 flex flex-wrap items-center gap-2">
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition-all"
            >
              {floors.map((fl) => (
                <option key={fl} value={fl}>
                  {fl === 'ALL' ? 'All Floors' : fl}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setFilterProjector(!filterProjector)}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                filterProjector
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              Projector
            </button>

            <button
              type="button"
              onClick={() => setFilterAC(!filterAC)}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                filterAC
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              AC
            </button>

            <button
              type="button"
              onClick={() => setFilterSmartBoard(!filterSmartBoard)}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                filterSmartBoard
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              SmartBoard
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start text-rose-800 text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 mr-2.5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 whitespace-pre-line">{error}</div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Room Status Cards Grid */}
      {loading && rooms.length === 0 ? (
        <div className="p-16 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span>Loading live room availability...</span>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700 text-sm">No rooms match your filter criteria.</p>
          <p className="text-xs text-slate-400 mt-1">Try clearing some search filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRooms.map((room) => {
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
            const reviewCount = roomReviews.length;

            return (
              <div
                key={roomId}
                className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all duration-200 ${
                  available
                    ? 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
                    : 'border-slate-200/70 bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 leading-tight">
                        {room.name}
                      </h3>
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
                      {available ? 'Free Now' : 'Class / Booked'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 flex items-center gap-2 mt-2">
                    <span className="flex items-center gap-1 font-medium">
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

                  {/* Live Star Rating Summary */}
                  <div className="mt-3.5 flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-bold text-slate-700">
                        {avgRating ? `${avgRating} ★` : 'No reviews'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleViewReviews(room)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      {reviewCount > 0 ? `(${reviewCount} reviews)` : 'Reviews'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-100 text-center">
                  <span
                    className={`text-xs font-bold ${
                      available ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {available ? '● Available for reservation' : '○ Currently Occupied'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Real-Time Reviews Modal */}
      {selectedRoom && selectedRoomReviews !== null && (
        <ReviewsModal
          room={selectedRoom}
          reviews={selectedRoomReviews}
          onClose={() => {
            setSelectedRoom(null);
            setSelectedRoomReviews(null);
          }}
        />
      )}
    </div>
  );
}