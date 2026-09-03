import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios'; // <-- Added to handle cancellation checks
import {
  getRooms,
  getAvailableRooms,
  createBooking,
  getMyBookings,
  cancelBooking,
  getRoomReviews,
  lockRoom,
  unlockRoom,
  getDepartments,
} from '../services/api';
import {
  getSocket,
  onBookingCancelled,
  onBookingCreated,
  offBookingCancelled,
  offBookingCreated,
  onRoomCreated,
  offRoomCreated,
  onRoomUpdated,
  offRoomUpdated,
  onRoomDeleted,
  offRoomDeleted,
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
  Palmtree,
  Filter,
  Search,
  RotateCcw,
  BookOpen,
  User as UserIcon,
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

const VALID_START_SLOTS = [
  '08:10',
  '09:00',
  '09:50',
  '10:40',
  '11:30',
  '12:20',
  '13:10',
  '14:10',
  '15:00',
  '15:50',
  '16:40',
];

const VALID_END_SLOTS = [
  '09:00',
  '09:50',
  '10:40',
  '11:30',
  '12:20',
  '13:10',
  '14:10',
  '15:00',
  '15:50',
  '16:40',
  '17:30',
];

const getDefaultEndHHMM = (startStr) => {
  if (!startStr) return '09:00';
  const idx = VALID_START_SLOTS.indexOf(startStr);
  if (idx !== -1 && idx < VALID_END_SLOTS.length) {
    return VALID_END_SLOTS[idx];
  }
  const [h, m] = startStr.split(':').map(Number);
  if (h >= 17) return '17:30';
  const nextH = h + 1;
  return `${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
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

const FALLBACK_DEPARTMENTS = [
  'Computer Science & Engineering',
  'Information Technology',
  'Electronics & Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Biotechnology',
  'Metallurgical & Materials',
  'Mining Engineering',
  'Common / Institute Level',
];

export default function BookingView({ user }) {
  const todayStr = getTodayDateString();
  const currentHHMM = getCurrentTimeHHMM();

  const [departments, setDepartments] = useState(FALLBACK_DEPARTMENTS);
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedFloor, setSelectedFloor] = useState('ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [minCapacity, setMinCapacity] = useState('ALL');
  const [sortBy, setSortBy] = useState('DEFAULT');

  const [filterProjector, setFilterProjector] = useState(false);
  const [filterAC, setFilterAC] = useState(false);
  const [filterSmartBoard, setFilterSmartBoard] = useState(false);
  const [filterWiFi, setFilterWiFi] = useState(false);

  const [rooms, setRooms] = useState([]);
  const [availableRoomIds, setAvailableRoomIds] = useState([]);
  const [occupancyMap, setOccupancyMap] = useState({});
  const [myBookings, setMyBookings] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState(null);
  const [isHolidayDate, setIsHolidayDate] = useState(false);
  const [holidayDateTitle, setHolidayDateTitle] = useState('');

  const [bookingData, setBookingData] = useState({
    date: todayStr,
    startTime: '08:10',
    endTime: '09:00',
    purpose: '',
    comment: '',
  });

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeLockId, setActiveLockId] = useState(null);

  const [reviews, setReviews] = useState({});
  const [loadingReviews, setLoadingReviews] = useState({});
  const [selectedRoomReviews, setSelectedRoomReviews] = useState(null);
  const [selectedReviewRoom, setSelectedReviewRoom] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    getDepartments()
      .then((res) => {
        const list = (res?.data || []).map((d) => (typeof d === 'string' ? d : d.code || d.name));
        if (list.length > 0 && isMountedRef.current) setDepartments(list);
      })
      .catch((err) => {
        if (axios.isCancel(err) || err?.message === 'canceled') return;
      });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setReviews({});
    const controller = new AbortController();
    Promise.all([fetchRooms(controller.signal), fetchMyBookings()]).finally(() => {
      if (isMountedRef.current) setInitialLoading(false);
    });
    return () => controller.abort();
  }, [selectedBranch, selectedFloor]);

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
  }, [bookingData.date, bookingData.startTime, bookingData.endTime, selectedBranch, selectedFloor]);

  useEffect(() => {
    const handleBookingCancelled = (data) => {
      fetchAvailableRooms(abortControllerRef.current?.signal);
      fetchMyBookings();
      if (data?.roomName && isMountedRef.current) {
        setSuccess(`Room "${data.roomName}" is now available.`);
      }
    };

    const handleBookingCreated = () => {
      fetchAvailableRooms(abortControllerRef.current?.signal);
    };

    const handleRoomDataChange = (data) => {
      fetchRooms();
      fetchAvailableRooms(abortControllerRef.current?.signal);
      if (data?.roomName && isMountedRef.current) {
        setSuccess(`Room "${data.roomName}" updated.`);
      }
    };

    const handleRoomDeleted = (data) => {
      fetchRooms();
      fetchAvailableRooms(abortControllerRef.current?.signal);
      fetchMyBookings();
      if (data?.roomName && isMountedRef.current) {
        setSuccess(`Room "${data.roomName}" was removed.`);
      }
    };

    onBookingCancelled(handleBookingCancelled);
    onBookingCreated(handleBookingCreated);
    onRoomCreated(handleRoomDataChange);
    onRoomUpdated(handleRoomDataChange);
    onRoomDeleted(handleRoomDeleted);

    const socket = getSocket();
    const handleReviewCreated = ({ roomId, review }) => {
      if (!roomId || !review) return;
      const targetId = String(roomId);

      if (isMountedRef.current) {
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
      }
    };

    if (socket) {
      socket.on('review-created', handleReviewCreated);
      socket.on('holiday-added', handleBookingCreated);
      socket.on('holiday-deleted', handleBookingCreated);
    }

    return () => {
      offBookingCancelled(handleBookingCancelled);
      offBookingCreated(handleBookingCreated);
      offRoomCreated(handleRoomDataChange);
      offRoomUpdated(handleRoomDataChange);
      offRoomDeleted(handleRoomDeleted);
      if (socket) {
        socket.off('review-created', handleReviewCreated);
        socket.off('holiday-added', handleBookingCreated);
        socket.off('holiday-deleted', handleBookingCreated);
      }
    };
  }, [selectedReviewRoom]);

  useEffect(() => {
    return () => {
      if (activeLockId) {
        unlockRoom(activeLockId).catch(() => {});
      }
    };
  }, [activeLockId]);

  const fetchRooms = async (signal) => {
    try {
      const deptParam = selectedBranch === 'ALL' ? undefined : selectedBranch;
      const floorParam = selectedFloor === 'ALL' ? undefined : selectedFloor;
      const data = await getRooms({ department: deptParam, floor: floorParam }, { signal });
      if (!isMountedRef.current) return;
      const roomList = data?.data || [];
      setRooms(roomList);

      roomList.forEach((r) => {
        const rId = r.id || r._id;
        fetchReviewsForRoom(rId);
      });
    } catch (err) {
      // PROPERLY IGNORE CANCELLATIONS HERE
      if (
        axios.isCancel(err) ||
        err.message === 'canceled' ||
        err.name === 'AbortError' ||
        err.name === 'CanceledError' ||
        err.code === 'ERR_CANCELED'
      ) {
        return;
      }
      if (isMountedRef.current) {
        setError(extractErrorMessage(err, 'Failed to load classrooms.'));
      }
    }
  };

  const fetchAvailableRooms = async (signal) => {
    try {
      let { date, startTime, endTime } = bookingData;
      let end = endTime;

      if (!startTime) {
        startTime = getCurrentTimeHHMM();
      }

      if (!end || startTime >= end) {
        end = getDefaultEndHHMM(startTime);
      }

      const nowTime = getCurrentTimeHHMM();
      if (date === todayStr && startTime < nowTime) {
        startTime = nowTime;
        end = getDefaultEndHHMM(nowTime);
      }

      const deptParam = selectedBranch === 'ALL' ? undefined : selectedBranch;
      const floorParam = selectedFloor === 'ALL' ? undefined : selectedFloor;
      const data = await getAvailableRooms(
        date,
        startTime,
        end,
        { department: deptParam, floor: floorParam },
        { signal }
      );

      if (!isMountedRef.current) return;

      if (data?.isHoliday) {
        setIsHolidayDate(true);
        setHolidayDateTitle(data.holidayTitle || 'Declared Department Holiday');
        setAvailableRoomIds([]);
        setOccupancyMap({});
      } else {
        setIsHolidayDate(false);
        setHolidayDateTitle('');
        const ids = (data?.data || []).map((r) => r.id || r._id);
        setAvailableRoomIds(ids);
        setOccupancyMap(data?.occupancyMap || {});
      }
    } catch (err) {
      // PROPERLY IGNORE CANCELLATIONS HERE
      if (
        axios.isCancel(err) ||
        err.message === 'canceled' ||
        err.name === 'AbortError' ||
        err.name === 'CanceledError' ||
        err.code === 'ERR_CANCELED'
      ) {
        return;
      }
    }
  };

  const fetchMyBookings = async () => {
    try {
      const data = await getMyBookings();
      if (isMountedRef.current) {
        setMyBookings(data?.data || []);
      }
    } catch (err) {
      if (axios.isCancel(err) || err.message === 'canceled') return;
      // Handled silently
    }
  };

  const fetchReviewsForRoom = async (roomId) => {
    if (loadingReviews[roomId]) return;
    if (isMountedRef.current) {
      setLoadingReviews((prev) => ({ ...prev, [roomId]: true }));
    }
    try {
      const data = await getRoomReviews(roomId);
      if (!isMountedRef.current) return;
      const reviewsArray = data?.data?.reviews || (Array.isArray(data?.data) ? data.data : []);
      setReviews((prev) => ({ ...prev, [roomId]: reviewsArray }));
    } catch (err) {
      if (axios.isCancel(err) || err.message === 'canceled') return;
      // Handled silently
    } finally {
      if (isMountedRef.current) {
        setLoadingReviews((prev) => ({ ...prev, [roomId]: false }));
      }
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
    setError('');

    setBookingData((prev) => {
      const updated = { ...prev, [name]: value };
      const currentNow = getCurrentTimeHHMM();

      if (name === 'date') {
        if (value === todayStr && prev.startTime < currentNow) {
          updated.startTime = currentNow;
          updated.endTime = getDefaultEndHHMM(currentNow);
        }
      }

      if (name === 'startTime') {
        if (value >= '17:10') {
          setError('Start time must be before 5:10 PM.');
          return prev;
        }
        if (prev.date === todayStr && value < currentNow) {
          setError(`Slot time has already passed.`);
        }
        updated.endTime = getDefaultEndHHMM(value);
      }

      if (name === 'endTime') {
        if (value <= prev.startTime) {
          updated.endTime = getDefaultEndHHMM(prev.startTime);
        }
      }

      return updated;
    });
  };

  const handleSelectRoom = async (room) => {
    setError('');
    const roomId = room.id || room._id;
    const currentNow = getCurrentTimeHHMM();

    if (bookingData.date === todayStr && bookingData.startTime < currentNow) {
      setError(`Cannot book past slot.`);
      return;
    }

    try {
      const lockRes = await lockRoom({
        roomId,
        date: bookingData.date,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
      });

      setActiveLockId(lockRes.lockId);
      setSelectedRoom(room);
      setSuccess(`Room "${room.name}" locked for reservation.`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Room was just locked or booked by another user.'));
    }
  };

  const handleCancelSelectedRoom = () => {
    if (activeLockId) {
      unlockRoom(activeLockId).catch(() => {});
      setActiveLockId(null);
    }
    setSelectedRoom(null);
  };

  const handleConfirmBooking = async () => {
    if (!selectedRoom) return;
    const roomId = selectedRoom.id || selectedRoom._id;
    const currentNow = getCurrentTimeHHMM();

    let { date, startTime, endTime, purpose, comment } = bookingData;

    if (!date || !startTime || !endTime || !purpose.trim()) {
      setError('Please provide date, times, and purpose.');
      return;
    }

    if (startTime >= endTime) {
      endTime = getDefaultEndHHMM(startTime);
    }

    if (date === todayStr && startTime < currentNow) {
      setError(`Cannot book past slot.`);
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

      setSuccess(`Room "${selectedRoom.name}" reserved.`);
      setBookingData((prev) => ({ ...prev, purpose: '', comment: '' }));
      setSelectedRoom(null);
      setActiveLockId(null);

      await Promise.all([
        fetchMyBookings(),
        fetchAvailableRooms(abortControllerRef.current?.signal),
      ]);
    } catch (err) {
      setError(extractErrorMessage(err, 'Booking conflict occurred.'));
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Cancel this booking?')) return;

    setCancellingBookingId(bookingId);
    setError('');
    setSuccess('');
    try {
      await cancelBooking(bookingId);
      setSuccess('Booking cancelled.');
      await Promise.all([
        fetchMyBookings(),
        fetchAvailableRooms(abortControllerRef.current?.signal),
      ]);
    } catch (err) {
      setError(extractErrorMessage(err, 'Cancellation failed.'));
    } finally {
      if (isMountedRef.current) setCancellingBookingId(null);
    }
  };

  const isRoomAvailable = (room) => {
    if (isHolidayDate) return false;
    const id = String(room.id || room._id);
    return availableRoomIds.map(String).includes(id);
  };

  const resetFilters = () => {
    setSelectedBranch('ALL');
    setSelectedFloor('ALL');
    setStatusFilter('ALL');
    setSearchTerm('');
    setSelectedType('ALL');
    setMinCapacity('ALL');
    setSortBy('DEFAULT');
    setFilterProjector(false);
    setFilterAC(false);
    setFilterSmartBoard(false);
    setFilterWiFi(false);
  };

  const filteredRooms = useMemo(() => {
    return rooms
      .filter((room) => {
        const available = isRoomAvailable(room);

        if (statusFilter === 'AVAILABLE' && !available) return false;
        if (statusFilter === 'OCCUPIED' && available) return false;
        if (selectedType !== 'ALL' && room.type !== selectedType) return false;
        if (minCapacity !== 'ALL' && (room.capacity || 0) < Number(minCapacity)) return false;

        if (filterProjector && !room.hasProjector) return false;
        if (filterAC && !room.hasAC) return false;
        if (filterSmartBoard && !room.hasSmartBoard) return false;
        if (filterWiFi && !room.hasWiFi) return false;

        if (searchTerm.trim()) {
          const tokens = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
          const amenityWords = [
            room.hasProjector ? 'projector screen' : '',
            room.hasAC ? 'ac air conditioning cooler' : '',
            room.hasSmartBoard ? 'smartboard smart board digital board' : '',
            room.hasWiFi ? 'wifi wireless internet' : '',
          ].join(' ');

          const corpus = [
            room.name || '',
            room.roomNumber || '',
            room.building || '',
            room.floor !== undefined ? `floor ${room.floor}` : '',
            room.type || '',
            room.department || '',
            room.capacity ? `capacity ${room.capacity} seats ${room.capacity}` : '',
            amenityWords,
          ]
            .join(' ')
            .toLowerCase();

          const allMatch = tokens.every((token) => corpus.includes(token));
          if (!allMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'NAME_ASC') {
          return (a.name || '').localeCompare(b.name || '');
        }
        if (sortBy === 'CAPACITY_DESC') {
          return (b.capacity || 0) - (a.capacity || 0);
        }
        if (sortBy === 'FLOOR_ASC') {
          return String(a.floor || 0).localeCompare(String(b.floor || 0));
        }
        return 0;
      });
  }, [
    rooms,
    availableRoomIds,
    isHolidayDate,
    statusFilter,
    selectedType,
    minCapacity,
    filterProjector,
    filterAC,
    filterSmartBoard,
    filterWiFi,
    searchTerm,
    sortBy,
  ]);

  const freeCount = rooms.filter((r) => isRoomAvailable(r)).length;
  const occupiedCount = rooms.length - freeCount;

  return (
    <div className="space-y-6 font-sans">
      {/* Alert Notices */}
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

      {/* 1. Date, Time & Branch Slot Selector */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
          <Clock className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Reservation Slot
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              Department
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-medium"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Floor</label>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-medium"
            >
              <option value="ALL">All Floors</option>
              <option value="0">Ground Floor (0)</option>
              <option value="1">1st Floor</option>
              <option value="2">2nd Floor</option>
              <option value="3">3rd Floor</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
            <input
              type="date"
              name="date"
              min={todayStr}
              value={bookingData.date}
              onChange={handleBookingInput}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Time</label>
            <select
              name="startTime"
              value={bookingData.startTime}
              onChange={handleBookingInput}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-medium"
            >
              {VALID_START_SLOTS.map((t) => (
                <option key={'start-' + t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Time</label>
            <select
              name="endTime"
              value={bookingData.endTime}
              onChange={handleBookingInput}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-medium"
            >
              {VALID_END_SLOTS.filter((t) => t > bookingData.startTime).map((t) => (
                <option key={'end-' + t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Holiday Alert */}
      {isHolidayDate && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-900">
          <Palmtree className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="text-xs">
            <span className="font-bold">{bookingData.date} is a Holiday:</span> {holidayDateTitle}. Booking unavailable.
          </div>
        </div>
      )}

      {/* 2. Unified Search & Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Filters & Room Search
            </h2>
          </div>

          {/* Status Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({rooms.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('AVAILABLE')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'AVAILABLE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-700 hover:text-emerald-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Free ({freeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('OCCUPIED')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'OCCUPIED'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-700 hover:text-rose-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              Occupied ({occupiedCount})
            </button>
          </div>
        </div>

        {/* Inputs & Sorting Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search room or building..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900"
            />
          </div>

          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-medium"
            >
              <option value="ALL">All Types</option>
              {STANDARD_ROOM_TYPES.filter((t) => t !== 'ALL').map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={minCapacity}
              onChange={(e) => setMinCapacity(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-medium"
            >
              <option value="ALL">Any Capacity</option>
              <option value="30">30+ Seats</option>
              <option value="60">60+ Seats</option>
              <option value="100">100+ Seats</option>
              <option value="150">150+ Seats</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-medium"
            >
              <option value="DEFAULT">Sort: Default</option>
              <option value="NAME_ASC">Name (A-Z)</option>
              <option value="CAPACITY_DESC">Capacity (High-Low)</option>
              <option value="FLOOR_ASC">Floor (Low-High)</option>
            </select>

            <button
              type="button"
              onClick={resetFilters}
              title="Reset"
              className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Amenity Badges */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Amenities:</span>
          {[
            { label: 'Projector', state: filterProjector, toggle: setFilterProjector },
            { label: 'AC', state: filterAC, toggle: setFilterAC },
            { label: 'Smart Board', state: filterSmartBoard, toggle: setFilterSmartBoard },
            { label: 'Wi-Fi', state: filterWiFi, toggle: setFilterWiFi },
          ].map(({ label, state, toggle }) => (
            <button
              key={label}
              type="button"
              onClick={() => toggle((p) => !p)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                state
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Rooms Grid */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-bold text-slate-800">
            Available Classrooms ({filteredRooms.length})
          </h2>
          <span className="text-[11px] font-medium text-slate-500">
            {bookingData.date} • {bookingData.startTime} - {bookingData.endTime}
          </span>
        </div>

        {initialLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Loading rooms...</span>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
            <p className="text-xs font-semibold">No classrooms match criteria.</p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((room) => {
              const roomId = String(room.id || room._id);
              const available = isRoomAvailable(room);
              const occupancyInfo = occupancyMap[roomId];

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
                  className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all ${
                    available
                      ? 'border-slate-200 hover:border-indigo-300 hover:shadow-indigo-50/50'
                      : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 leading-tight">
                          {room.name}
                        </h3>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          #{room.roomNumber} {room.department ? `• ${room.department}` : ''}
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold rounded-md flex items-center gap-1.5 border ${
                          isHolidayDate
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : available
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isHolidayDate
                              ? 'bg-amber-500'
                              : available
                              ? 'bg-emerald-500'
                              : 'bg-rose-500'
                          }`}
                        ></span>
                        <span>{isHolidayDate ? 'Holiday' : available ? 'Free' : 'Occupied'}</span>
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {room.capacity} seats
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        Floor {room.floor}, {room.building}
                      </span>
                      {room.type && (
                        <>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                            {room.type}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1 text-[10px]">
                      {room.hasProjector && (
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                          Projector
                        </span>
                      )}
                      {room.hasAC && (
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                          AC
                        </span>
                      )}
                      {room.hasSmartBoard && (
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                          SmartBoard
                        </span>
                      )}
                      {room.hasWiFi && (
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                          WiFi
                        </span>
                      )}
                    </div>

                    {!available && occupancyInfo && (
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-100/70 border border-slate-200 text-xs text-slate-800 space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-[11px]">
                          {occupancyInfo.type === 'TIMETABLE' ? (
                            <>
                              <BookOpen className="w-3 h-3 text-indigo-600" />
                              <span>Timetable Lecture</span>
                            </>
                          ) : (
                            <>
                              <UserIcon className="w-3 h-3 text-indigo-600" />
                              <span>Faculty Booking</span>
                            </>
                          )}
                        </div>
                        <div className="text-[11px] font-medium text-slate-700">
                          {occupancyInfo.purpose}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between pt-0.5">
                          <span>{occupancyInfo.facultyName || 'Faculty'}</span>
                          <span>{occupancyInfo.startTime} - {occupancyInfo.endTime}</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        <span className="text-xs font-semibold text-slate-700">
                          {avgRating ? `${avgRating}` : '—'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewReviews(room)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        {roomReviews.length > 0 ? `${roomReviews.length} reviews` : 'Reviews'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-2">
                    {available ? (
                      <button
                        type="button"
                        onClick={() => handleSelectRoom(room)}
                        className="w-full bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-100"
                      >
                        Reserve Slot
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full bg-slate-100 text-slate-400 px-3 py-2 rounded-xl text-xs font-semibold cursor-not-allowed border border-slate-200"
                      >
                        {isHolidayDate ? 'Holiday' : 'Unavailable'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Booking Confirmation Drawer */}
      {selectedRoom && (
        <div className="bg-white border-2 border-indigo-600 rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between pb-2.5 mb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Confirm Reservation: {selectedRoom.name}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectedRoom.department} • {bookingData.date} • {bookingData.startTime} - {bookingData.endTime}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelSelectedRoom}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Purpose *
              </label>
              <input
                type="text"
                name="purpose"
                value={bookingData.purpose}
                onChange={handleBookingInput}
                placeholder="Lecture, Seminar, Project..."
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Comments
              </label>
              <input
                type="text"
                name="comment"
                value={bookingData.comment}
                onChange={handleBookingInput}
                placeholder="Optional notes or requirements"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancelSelectedRoom}
              className="bg-slate-100 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmBooking}
              disabled={loading}
              className="bg-indigo-600 text-white px-5 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Reserving...</span>
                </>
              ) : (
                <>
                  <span>Confirm</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 5. User Scheduled Bookings Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              My Bookings ({myBookings.length})
            </h3>
          </div>
        </div>

        {myBookings.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No scheduled reservations.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 font-bold text-slate-700 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-4 py-2.5 font-bold text-slate-700 uppercase tracking-wider">
                    Slot
                  </th>
                  <th className="px-4 py-2.5 font-bold text-slate-700 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="px-4 py-2.5 font-bold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-2.5 font-bold text-slate-700 uppercase tracking-wider">
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
                    <tr key={bookingId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{b.roomId?.name || 'Room'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {b.roomId?.roomNumber || ''}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-medium">{b.date}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {b.startTime} - {b.endTime}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-medium">{b.purpose}</div>
                        {b.comment && b.comment !== 'No comment provided' && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">{b.comment}</div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-md border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isCancelled
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {isActive && (
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(bookingId)}
                            disabled={isCancelling}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 disabled:opacity-40"
                          >
                            {isCancelling ? 'Cancelling...' : 'Cancel'}
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