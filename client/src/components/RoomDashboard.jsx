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
  ArrowUpDown,
  RotateCcw,
  Palmtree,
  GraduationCap,
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

const STANDARD_ROOM_TYPES = [
  'ALL',
  'Classroom',
  'Lecture Hall',
  'Lab',
  'Computer Lab',
  'Seminar Hall',
  'Auditorium',
  'Conference Room',
  'Tutorial Room',
  'Workshop',
  'Meeting Room',
];

const roomMatchesSearchQuery = (room, query) => {
  if (!query || !query.trim()) return true;

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const amenityWords = [
    room.hasProjector ? 'projector proj screen' : '',
    room.hasAC ? 'ac air conditioning cooler' : '',
    room.hasSmartBoard ? 'smartboard smart board digital board display' : '',
    room.hasWiFi ? 'wifi internet wireless' : '',
  ].join(' ');

  const searchableCorpus = [
    room.name || '',
    room.roomNumber || '',
    room.building || '',
    room.floor || '',
    room.type || '',
    room.department || '',
    room.capacity ? `capacity ${room.capacity} seats ${room.capacity} cap` : '',
    room.createdByName || '',
    amenityWords,
  ]
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => searchableCorpus.includes(token));
};

export default function RoomDashboard({ user }) {
  const [rooms, setRooms] = useState([]);
  const [availableRoomIds, setAvailableRoomIds] = useState([]);
  const [occupancyMap, setOccupancyMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayTitle, setHolidayTitle] = useState('');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [minCapacity, setMinCapacity] = useState('ALL');
  const [sortBy, setSortBy] = useState('DEFAULT');

  // Amenities
  const [filterProjector, setFilterProjector] = useState(false);
  const [filterAC, setFilterAC] = useState(false);
  const [filterSmartBoard, setFilterSmartBoard] = useState(false);
  const [filterWiFi, setFilterWiFi] = useState(false);

  // Reviews
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
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();

      let startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      let endTime;

      // ⚡ Midnight-Safe Calculation: strictly guarantees startTime < endTime at all hours
      if (h >= 23) {
        startTime = '23:00';
        endTime = '23:59';
      } else {
        endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }

      const dept = user?.department;

      const [roomsRes, availRes] = await Promise.all([
        getRooms({ department: dept }),
        getAvailableRooms(date, startTime, endTime, { department: dept }),
      ]);

      if (isMountedRef.current) {
        const fetchedRooms = roomsRes?.data || [];
        setRooms(fetchedRooms);

        if (availRes?.isHoliday) {
          setIsHoliday(true);
          setHolidayTitle(availRes.holidayTitle || 'Declared Department Holiday');
          setAvailableRoomIds([]);
          setOccupancyMap({});
        } else {
          setIsHoliday(false);
          setHolidayTitle('');
          const ids = (availRes?.data || []).map((r) => r.id || r._id);
          setAvailableRoomIds(ids);
          setOccupancyMap(availRes?.occupancyMap || {});
        }

        setCurrentTime(new Date());

        fetchedRooms.forEach((r) => {
          const rId = r.id || r._id;
          fetchReviewsForRoom(rId);
        });
      }
    } catch (err) {
      console.error('❌ [ROOM DASHBOARD] Failed to refresh live room status:', err.message || err);
      if (isMountedRef.current) {
        setError(extractErrorMessage(err, 'Failed to refresh live room status.'));
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
      console.error(`❌ [ROOM DASHBOARD] Failed to fetch reviews for room ${roomId}:`, err.message || err);
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

  // 1. Initial fetch & 15-second Clock Ticker (rolls statuses when time boundaries pass)
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 15000);

    return () => clearInterval(interval);
  }, [user?.department]);

  // 2. Tab Visibility Focus & Socket Reconnection Recovery
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMountedRef.current) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.department]);

  // 3. Real-time Socket.IO Listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = () => {
      if (isMountedRef.current) {
        fetchData();
      }
    };

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
    socket.on('holiday-added', handleUpdate);
    socket.on('holiday-deleted', handleUpdate);
    socket.on('holiday-updated', handleUpdate);
    socket.on('room-created', handleUpdate);
    socket.on('room-updated', handleUpdate);
    socket.on('review-created', handleReviewCreated);

    return () => {
      socket.off('booking-created', handleUpdate);
      socket.off('booking-cancelled', handleUpdate);
      socket.off('room-locked', handleUpdate);
      socket.off('room-unlocked', handleUpdate);
      socket.off('timetable-updated', handleUpdate);
      socket.off('holiday-added', handleUpdate);
      socket.off('holiday-deleted', handleUpdate);
      socket.off('holiday-updated', handleUpdate);
      socket.off('room-created', handleUpdate);
      socket.off('room-updated', handleUpdate);
      socket.off('review-created', handleReviewCreated);
    };
  }, [selectedRoom]);

  const isRoomAvailable = (room) => {
    if (isHoliday) return false;
    const id = room.id || room._id;
    return availableRoomIds.includes(id);
  };

  const getAvgRating = (roomId) => {
    const raw = reviews[roomId] || [];
    const list = Array.isArray(raw) ? raw : raw.reviews || [];
    if (list.length === 0) return 0;
    return Number((list.reduce((acc, r) => acc + (r.rating || 0), 0) / list.length).toFixed(1));
  };

  const floors = ['ALL', ...new Set(rooms.map((r) => r.floor).filter(Boolean))];

  const roomTypes = [
    'ALL',
    ...new Set([
      ...STANDARD_ROOM_TYPES.filter((t) => t !== 'ALL'),
      ...rooms.map((r) => r.type).filter(Boolean),
    ]),
  ];

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setSelectedFloor('ALL');
    setSelectedType('ALL');
    setMinCapacity('ALL');
    setSortBy('DEFAULT');
    setFilterProjector(false);
    setFilterAC(false);
    setFilterSmartBoard(false);
    setFilterWiFi(false);
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    statusFilter !== 'ALL' ||
    selectedFloor !== 'ALL' ||
    selectedType !== 'ALL' ||
    minCapacity !== 'ALL' ||
    sortBy !== 'DEFAULT' ||
    filterProjector ||
    filterAC ||
    filterSmartBoard ||
    filterWiFi;

  const filteredRooms = rooms
    .filter((room) => {
      const isAvail = isRoomAvailable(room);

      if (statusFilter === 'AVAILABLE' && !isAvail) return false;
      if (statusFilter === 'OCCUPIED' && isAvail) return false;

      if (!roomMatchesSearchQuery(room, searchTerm)) return false;

      if (selectedFloor !== 'ALL' && room.floor !== selectedFloor) return false;
      if (selectedType !== 'ALL' && room.type !== selectedType) return false;

      if (minCapacity !== 'ALL') {
        const minCapNum = Number(minCapacity);
        if ((room.capacity || 0) < minCapNum) return false;
      }

      if (filterProjector && !room.hasProjector) return false;
      if (filterAC && !room.hasAC) return false;
      if (filterSmartBoard && !room.hasSmartBoard) return false;
      if (filterWiFi && !room.hasWiFi) return false;

      return true;
    })
    .sort((a, b) => {
      const aId = a.id || a._id;
      const bId = b.id || b._id;

      if (sortBy === 'CAPACITY_DESC') {
        return (b.capacity || 0) - (a.capacity || 0);
      }
      if (sortBy === 'RATING_DESC') {
        return getAvgRating(bId) - getAvgRating(aId);
      }
      if (sortBy === 'NAME_ASC') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return (a.floor || '').localeCompare(b.floor || '') || (a.roomNumber || '').localeCompare(b.roomNumber || '');
    });

  const totalRoomsCount = rooms.length;
  const availableCount = isHoliday ? 0 : rooms.filter((r) => isRoomAvailable(r)).length;
  const occupiedCount = totalRoomsCount - availableCount;

  return (
    <div className="space-y-6 font-sans">
      {/* Live Holiday Notice Banner */}
      {isHoliday && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-3xl flex items-center gap-3 text-amber-900 shadow-sm animate-fadeIn">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
            <Palmtree className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold">🏖️ Department Holiday: {holidayTitle}</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              All departmental classrooms are closed and master timetables are suspended for today.
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter Header Container */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        {/* Top Title & Status Filter Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Live Room Status & Search
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time occupancy for {user?.department || 'Department'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({totalRoomsCount})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('AVAILABLE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'AVAILABLE'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'AVAILABLE' ? 'bg-white' : 'bg-emerald-500'}`} />
                <span>Free ({availableCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('OCCUPIED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'OCCUPIED'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'OCCUPIED' ? 'bg-white' : 'bg-rose-500'}`} />
                <span>Occupied ({occupiedCount})</span>
              </button>
            </div>

            {/* Time & Refresh Button */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all disabled:opacity-50"
                title="Refresh Status"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar & Dropdown Selects */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by room name, #, building, floor, or amenity..."
              className="w-full pl-10 pr-8 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition-all placeholder:text-slate-400"
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

          <div className="sm:col-span-2">
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition-all"
            >
              {floors.map((fl) => (
                <option key={fl} value={fl}>
                  {fl === 'ALL' ? 'All Floors' : fl}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition-all"
            >
              {roomTypes.map((t) => (
                <option key={t} value={t}>
                  {t === 'ALL' ? 'All Room Types' : t}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={minCapacity}
              onChange={(e) => setMinCapacity(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition-all"
            >
              <option value="ALL">Any Capacity</option>
              <option value="30">30+ Seats</option>
              <option value="60">60+ Seats</option>
              <option value="100">100+ Seats</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-xl pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition-all appearance-none"
              >
                <option value="DEFAULT">Sort: Default</option>
                <option value="CAPACITY_DESC">Capacity (High to Low)</option>
                <option value="RATING_DESC">Rating (Highest)</option>
                <option value="NAME_ASC">Name (A-Z)</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Amenity Filter Toggle Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Amenities:
          </span>

          <button
            type="button"
            onClick={() => setFilterProjector(!filterProjector)}
            className={`px-3 py-1 text-xs font-bold rounded-xl border transition-all ${
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
            className={`px-3 py-1 text-xs font-bold rounded-xl border transition-all ${
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
            className={`px-3 py-1 text-xs font-bold rounded-xl border transition-all ${
              filterSmartBoard
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            SmartBoard
          </button>

          <button
            type="button"
            onClick={() => setFilterWiFi(!filterWiFi)}
            className={`px-3 py-1 text-xs font-bold rounded-xl border transition-all ${
              filterWiFi
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            WiFi
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 ml-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}

          <div className="ml-auto text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredRooms.length}</strong> of {totalRoomsCount} rooms
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
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700 text-sm">No classrooms match your search criteria.</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or clearing search text.</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors inline-block"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRooms.map((room) => {
            const roomId = room.id || room._id;
            const available = isRoomAvailable(room);
            const occupancy = occupancyMap[roomId];

            const isMyOngoingClass =
              occupancy &&
              ((user?.email && occupancy.facultyEmail?.toLowerCase() === user.email.toLowerCase()) ||
                (user?.name && occupancy.facultyName?.toLowerCase() === user.name.toLowerCase()));

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
                className={`bg-white border rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all duration-200 ${
                  isMyOngoingClass
                    ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-md bg-indigo-50/20'
                    : available
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
                        {room.roomNumber} {room.type ? `• ${room.type}` : ''}
                      </div>
                    </div>

                    {/* Dynamic Status Badge */}
                    {isHoliday ? (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                        Holiday / Closed
                      </span>
                    ) : available ? (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Free Now</span>
                      </span>
                    ) : isMyOngoingClass ? (
                      <span className="px-3 py-1 text-xs font-extrabold rounded-full bg-indigo-600 text-white shadow-sm flex items-center gap-1.5 animate-pulse">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>In Class</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span>Currently Class Running</span>
                      </span>
                    )}
                  </div>

                  {/* Occupancy Detail Subtext */}
                  {!available && occupancy && (
                    <div
                      className={`mt-2 p-2.5 rounded-xl text-xs font-medium border ${
                        isMyOngoingClass
                          ? 'bg-indigo-50 border-indigo-100 text-indigo-900'
                          : 'bg-rose-50 border-rose-100 text-rose-900'
                      }`}
                    >
                      {isMyOngoingClass ? (
                        <div>
                          <strong>Your Class:</strong> {occupancy.purpose} ({occupancy.startTime} - {occupancy.endTime})
                        </div>
                      ) : (
                        <div>
                          <strong>Class:</strong> {occupancy.purpose}{' '}
                          {occupancy.facultyName ? `• Prof. ${occupancy.facultyName}` : ''} ({occupancy.startTime} - {occupancy.endTime})
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-slate-600 flex items-center gap-2 mt-2.5">
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
                </div>

                <div className="mt-4 pt-3 flex items-center justify-between border-t border-slate-100">
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
            );
          })}
        </div>
      )}

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