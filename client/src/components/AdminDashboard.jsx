import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getRooms, createRoom, updateRoom, deleteRoom, getDepartments, getAllRoomsStatus } from '../services/api';
import { Building2, Plus, Edit2, Trash2, Eye, EyeOff, AlertTriangle, Loader2, X, CheckSquare, Square, Activity, Clock, Users, Search, Filter, RotateCcw, RefreshCw, Calendar } from 'lucide-react';
import { getSocket } from '../services/socket';
import TimetableManager from './hod/TimetableManager';

// ── Delete Confirmation Modal ──────────────────────────────────────────────
function DeleteConfirmModal({ room, onConfirm, onCancel }) {
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) { setError('Enter admin password.'); return; }
    setError('');
    setLoading(true);
    try {
      await onConfirm(password.trim());
    } catch (err) {
      setError(err?.response?.data?.message || 'Incorrect password. Deletion aborted.');
      setLoading(false);
      setPassword('');
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-rose-50/80 border-b border-rose-100 px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-950">Delete Room</h2>
              <p className="text-[11px] text-rose-600">Action cannot be reversed</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
            <p className="font-bold text-slate-900">{room.name} <span className="text-slate-400 font-mono">({room.roomNumber})</span></p>
            <p className="text-slate-500 mt-0.5">{room.building} • Floor {room.floor} • {room.department}</p>
          </div>

          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900">
            <p className="font-semibold text-amber-800 mb-1">Impact Warning</p>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Timetable allocations and active bookings will be cleared immediately. Affected faculty and department heads will receive automated notifications.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Password Confirmation
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter administrator password"
                  disabled={loading}
                  className={`w-full border rounded-xl px-3 py-2 pr-9 text-xs outline-none transition-all ${
                    error
                      ? 'border-rose-300 bg-rose-50/50 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {error && (
                <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {error}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 font-semibold rounded-xl text-xs hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !password.trim()}
                className="flex-1 px-4 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
              >
                {loading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...</>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5" /> Confirm Delete</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Dashboard ───────────────────────────────────────────────────
export default function AdminDashboard({ user, onLogout }) {
  const [departments, setDepartments] = useState(['Computer Science & Engineering', 'Common / Institute Level']);
  const [rooms, setRooms] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    roomNumber: '',
    capacity: '',
    type: 'Classroom',
    floor: '0',
    building: 'Main Building',
    department: 'Common / Institute Level',
    hasAC: false,
    hasProjector: false,
    hasSmartBoard: false,
    hasWiFi: false,
  });
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'status'

  // Room Status Dashboard State
  const [statusRooms, setStatusRooms] = useState([]);
  const [statusSummary, setStatusSummary] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'free' | 'occupied'
  const [statusDeptFilter, setStatusDeptFilter] = useState('ALL');
  const [statusSearch, setStatusSearch] = useState('');

  const isMountedRef = useRef(true);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await getRooms({ department: 'ALL' });
      if (isMountedRef.current) setRooms(res.data || []);
    } catch (err) {
      console.error('❌ [ADMIN] Failed to fetch rooms:', err.message || err);
    }
  }, []);

  const statusLoadingRef = useRef(false);

  const fetchRoomStatus = useCallback(async () => {
    if (statusLoadingRef.current) return;
    statusLoadingRef.current = true;
    setStatusLoading(true);
    try {
      const res = await getAllRoomsStatus();
      if (isMountedRef.current) {
        setStatusRooms(res.data || []);
        setStatusSummary(res.summary || null);
      }
    } catch (err) {
      console.error('❌ [ADMIN] Failed to fetch room status:', err.message || err);
    } finally {
      if (isMountedRef.current) {
        setStatusLoading(false);
        statusLoadingRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchRooms();
    getDepartments()
      .then((res) => {
        const list = (res?.data || []).map((d) => (typeof d === 'string' ? d : d.code || d.name));
        if (!list.includes('Common / Institute Level')) list.unshift('Common / Institute Level');
        if (isMountedRef.current) setDepartments(list);
      })
      .catch((err) => {
        console.error('❌ [ADMIN] Failed to load departments:', err.message || err);
      });

    const socket = getSocket();
    const handleRoomChange = () => { if (isMountedRef.current) { fetchRooms(); fetchRoomStatus(); } };
    if (socket) {
      socket.on('room-created', handleRoomChange);
      socket.on('room-updated', handleRoomChange);
      socket.on('room-deleted', handleRoomChange);
      socket.on('timetable-updated', handleRoomChange);
      socket.on('booking-created', handleRoomChange);
      socket.on('booking-cancelled', handleRoomChange);
    }
    return () => {
      isMountedRef.current = false;
      if (socket) {
        socket.off('room-created', handleRoomChange);
        socket.off('room-updated', handleRoomChange);
        socket.off('room-deleted', handleRoomChange);
        socket.off('timetable-updated', handleRoomChange);
        socket.off('booking-created', handleRoomChange);
        socket.off('booking-cancelled', handleRoomChange);
      }
    };
  }, [fetchRooms, fetchRoomStatus]);

  // Auto-refresh room status when tab is active
  useEffect(() => {
    if (activeTab === 'status') {
      fetchRoomStatus();
      const interval = setInterval(fetchRoomStatus, 15000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchRoomStatus]);

  // Filtered status rooms
  const filteredStatusRooms = useMemo(() => {
    return statusRooms.filter((r) => {
      if (statusFilter !== 'ALL' && r.currentStatus !== statusFilter) return false;
      if (statusDeptFilter !== 'ALL' && r.department !== statusDeptFilter) return false;
      if (statusSearch.trim()) {
        const q = statusSearch.trim().toLowerCase();
        const match =
          (r.name || '').toLowerCase().includes(q) ||
          (r.roomNumber || '').toLowerCase().includes(q) ||
          (r.building || '').toLowerCase().includes(q) ||
          (r.occupancy?.facultyName || '').toLowerCase().includes(q) ||
          (r.occupancy?.purpose || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [statusRooms, statusFilter, statusDeptFilter, statusSearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formLoading) return;
    setFormError('');

    const cleanName = (formData.name || '').trim();
    const cleanRoomNumber = (formData.roomNumber || '').trim().toUpperCase();

    if (!cleanName || cleanName.length < 2) {
      setFormError('Room name must be at least 2 characters long.');
      return;
    }
    if (cleanName.length > 100) {
      setFormError('Room name cannot exceed 100 characters.');
      return;
    }

    if (!cleanRoomNumber || cleanRoomNumber.length < 1) {
      setFormError('Room number is required.');
      return;
    }
    if (cleanRoomNumber.length > 20) {
      setFormError('Room number cannot exceed 20 characters.');
      return;
    }

    const capacityNum = parseInt(formData.capacity, 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      setFormError('Room capacity must be a positive integer greater than 0.');
      return;
    }
    if (capacityNum > 2000) {
      setFormError('Room capacity cannot exceed 2000 seats.');
      return;
    }

    // Duplicate check in selected department
    const isDuplicate = rooms.some((r) => {
      const isCurrentEditing = editingId && (r.id === editingId || r._id === editingId);
      if (isCurrentEditing) return false;

      return (
        r.department === formData.department &&
        (r.name.trim().toLowerCase() === cleanName.toLowerCase() ||
          r.roomNumber.trim().toUpperCase() === cleanRoomNumber)
      );
    });

    if (isDuplicate) {
      setFormError(
        `A room with the name "${cleanName}" or room number "${cleanRoomNumber}" already exists in "${formData.department}".`
      );
      return;
    }

    setFormLoading(true);
    const payload = {
      ...formData,
      name: cleanName,
      roomNumber: cleanRoomNumber,
      capacity: capacityNum,
    };

    try {
      if (editingId) {
        console.log(`🛠️  [ADMIN] Updating room: ${editingId}`, payload);
        await updateRoom(editingId, payload);
        console.log(`✅ [ADMIN] Room updated successfully`);
      } else {
        console.log(`🛠️  [ADMIN] Creating room: ${cleanRoomNumber} (${cleanName})`);
        await createRoom(payload);
        console.log(`✅ [ADMIN] Room created successfully`);
      }
      setFormData({
        name: '',
        roomNumber: '',
        capacity: '',
        type: 'Classroom',
        floor: '0',
        building: 'Main Building',
        department: 'Common / Institute Level',
        hasAC: false,
        hasProjector: false,
        hasSmartBoard: false,
        hasWiFi: false,
      });
      setEditingId(null);
      fetchRooms();
    } catch (err) {
      const errMsg = err.message || err.response?.data?.message || 'Error saving room configuration.';
      console.error('❌ [ADMIN] Save room error:', errMsg);
      setFormError(errMsg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClick = (room) => {
    setDeleteTarget(room);
  };

  const handleDeleteConfirm = async (adminPassword) => {
    try {
      const id = deleteTarget.id || deleteTarget._id;
      console.log(`🗑️  [ADMIN] Confirming delete for room: ${id}`);
      await deleteRoom(id, adminPassword);
      console.log(`✅ [ADMIN] Room deleted successfully`);
      setDeleteTarget(null);
      fetchRooms();
    } catch (err) {
      const errMsg = err.message || err.response?.data?.message || 'Failed to delete room.';
      console.error('❌ [ADMIN] Delete room error:', errMsg);
      throw err; // Re-throw so modal can display the error to user
    }
  };

  const handleEdit = (room) => {
    setEditingId(room.id || room._id);
    let normalizedFloor = room.floor;
    if (normalizedFloor === 'Ground Floor' || normalizedFloor === '0') normalizedFloor = '0';
    else if (normalizedFloor === 'First Floor' || normalizedFloor === '1') normalizedFloor = '1';
    else if (normalizedFloor === 'Second Floor' || normalizedFloor === '2') normalizedFloor = '2';
    else if (normalizedFloor === 'Third Floor' || normalizedFloor === '3') normalizedFloor = '3';
    else normalizedFloor = '0';

    let normalizedBuilding = room.building;
    if (!['Main Building', 'Architecture Building', 'CCC Room'].includes(normalizedBuilding)) {
      normalizedBuilding = 'Main Building';
    }

    setFormData({
      name: room.name,
      roomNumber: room.roomNumber,
      capacity: room.capacity,
      type: room.type,
      floor: normalizedFloor,
      building: normalizedBuilding,
      department: room.department,
      hasAC: Boolean(room.hasAC),
      hasProjector: Boolean(room.hasProjector),
      hasSmartBoard: Boolean(room.hasSmartBoard),
      hasWiFi: Boolean(room.hasWiFi),
    });
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormError('');
    setFormData({
      name: '',
      roomNumber: '',
      capacity: '',
      type: 'Classroom',
      floor: '0',
      building: 'Main Building',
      department: 'Common / Institute Level',
      hasAC: false,
      hasProjector: false,
      hasSmartBoard: false,
      hasWiFi: false,
    });
  };

  return (
    <>
      {deleteTarget && (
        <DeleteConfirmModal
          room={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-sans">

        {/* ── Tab Navigation ────────────────────────────────────── */}
        <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'rooms'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> Room Manager
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'status'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Live Room Status
          </button>
          <button
            onClick={() => setActiveTab('timetable')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'timetable'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Master Timetables
          </button>
        </div>

        {/* ── Live Room Status Panel ──────────────────────────── */}
        {activeTab === 'status' && (
          <div className="space-y-4">
            {/* Summary Cards */}
            {statusSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-slate-800">{statusSummary.total}</p>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">Total Rooms</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-emerald-700">{statusSummary.free}</p>
                  <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide mt-0.5">Free Now</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-rose-700">{statusSummary.occupied}</p>
                  <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wide mt-0.5">Occupied</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-center shadow-sm">
                  <p className="text-lg font-bold text-indigo-700">{statusSummary.asOf}</p>
                  <p className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wide mt-0.5">{statusSummary.day}, {statusSummary.date}</p>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                {/* Status Filter */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-0.5">
                  {[
                    { val: 'ALL', label: 'All', count: statusRooms.length },
                    { val: 'free', label: '🟢 Free', count: statusRooms.filter(r => r.currentStatus === 'free').length },
                    { val: 'occupied', label: '🔴 Occupied', count: statusRooms.filter(r => r.currentStatus === 'occupied').length },
                  ].map(({ val, label, count }) => (
                    <button
                      key={val}
                      onClick={() => setStatusFilter(val)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        statusFilter === val
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  ))}
                </div>

                {/* Department Filter */}
                <select
                  value={statusDeptFilter}
                  onChange={(e) => setStatusDeptFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {/* Search */}
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={statusSearch}
                    onChange={(e) => setStatusSearch(e.target.value)}
                    placeholder="Search room, faculty, purpose..."
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Refresh */}
                <button
                  onClick={fetchRoomStatus}
                  disabled={statusLoading}
                  className="p-1.5 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200 disabled:opacity-50"
                  title="Refresh status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Room Status List */}
            {statusLoading && statusRooms.length === 0 ? (
              <div className="p-10 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium">Loading live room status...</p>
              </div>
            ) : filteredStatusRooms.length === 0 ? (
              <div className="p-10 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium">No rooms match your filters.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStatusRooms.map((room) => (
                  <div
                    key={room.id}
                    className={`bg-white border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                      room.currentStatus === 'occupied'
                        ? 'border-rose-200 hover:border-rose-300'
                        : 'border-emerald-200 hover:border-emerald-300'
                    }`}
                  >
                    {/* Left: Room Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status Dot */}
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            room.currentStatus === 'occupied' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                          }`}
                        />
                        <h3 className="font-bold text-sm text-slate-900 truncate">{room.name}</h3>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-mono flex-shrink-0">
                          #{room.roomNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-semibold flex-shrink-0">
                          {room.department}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {room.building} • Floor {room.floor} • {room.type} • {room.capacity} seats
                      </p>
                    </div>

                    {/* Right: Status Details */}
                    <div className="flex-shrink-0 text-right min-w-[220px]">
                      {room.currentStatus === 'occupied' && room.occupancy ? (
                        <div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            room.occupancy.type === 'BOOKING'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-violet-100 text-violet-800 border border-violet-200'
                          }`}>
                            {room.occupancy.type === 'BOOKING' ? '📅 Booking' : '📚 Timetable'}
                          </span>
                          <p className="text-xs font-semibold text-slate-800 mt-1 truncate">
                            {room.occupancy.facultyName}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">{room.occupancy.purpose}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3" />
                            {room.occupancy.startTime} – {room.occupancy.endTime}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                            ✅ Available
                          </span>
                          {room.upcoming && (
                            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-end gap-1">
                              <Clock className="w-3 h-3" />
                              Next: {room.upcoming.startTime} – {room.upcoming.facultyName}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Auto-refresh indicator */}
            <p className="text-center text-[10px] text-slate-400 pt-1">
              Auto-refreshes every 15 seconds • {filteredStatusRooms.length} of {statusRooms.length} rooms shown
            </p>
          </div>
        )}

        {/* ── Room Manager Panel (existing) ──────────────────── */}
        {activeTab === 'rooms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Add / Edit Form */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3.5 sticky top-6">
              <div className="border-b border-slate-100 pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {editingId ? 'Update Room Configuration' : 'Allocate Room'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Room Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-medium"
                    placeholder="e.g. F-14"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Room Number</label>
                    <input
                      required
                      type="text"
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({...formData, roomNumber: e.target.value})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-medium uppercase"
                      placeholder="e.g. 101"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Capacity (Seats)</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={formData.capacity}
                      onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-medium"
                      placeholder="e.g. 60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Department Allocation</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-indigo-50/70 text-indigo-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Room Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white outline-none text-slate-800 font-medium"
                    >
                      <option value="Classroom">Classroom</option>
                      <option value="Lab">Lab</option>
                      <option value="Auditorium">Auditorium</option>
                      <option value="Lecture Hall">Lecture Hall</option>
                      <option value="Seminar Hall">Seminar Hall</option>
                      <option value="Conference Room">Conference Room</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Floor</label>
                    <select
                      required
                      value={formData.floor}
                      onChange={(e) => setFormData({...formData, floor: e.target.value})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white outline-none text-slate-800 font-medium"
                    >
                      <option value="0">0 — Ground Floor</option>
                      <option value="1">1 — First Floor</option>
                      <option value="2">2 — Second Floor</option>
                      <option value="3">3 — Third Floor</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Building</label>
                  <select
                    value={formData.building}
                    onChange={(e) => setFormData({...formData, building: e.target.value})}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white outline-none text-slate-800 font-medium"
                  >
                    <option value="Main Building">Main Building</option>
                    <option value="Architecture Building">Architecture Building</option>
                    <option value="CCC Room">CCC Room</option>
                  </select>
                </div>

                {/* Amenities Checkboxes */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-2">Amenities</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { key: 'hasAC', label: 'Air Conditioning', icon: '❄️' },
                      { key: 'hasProjector', label: 'Projector', icon: '📽️' },
                      { key: 'hasSmartBoard', label: 'Smart Board', icon: '🖥️' },
                      { key: 'hasWiFi', label: 'Wi-Fi Access', icon: '📶' },
                    ].map(({ key, label, icon }) => {
                      const checked = formData[key];
                      return (
                        <label
                          key={key}
                          className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                            checked
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-800 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setFormData({...formData, [key]: e.target.checked})}
                            className="hidden"
                          />
                          {checked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          )}
                          <span className="text-[11px] truncate">{icon} {label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {formError && (
                  <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {formError}
                  </p>
                )}

                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm shadow-indigo-100"
                  >
                    {formLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : editingId ? (
                      <><Edit2 className="w-3.5 h-3.5" /> Save Changes</>
                    ) : (
                      <><Plus className="w-3.5 h-3.5" /> Allocate Room</>
                    )}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3.5 bg-slate-100 text-slate-600 font-semibold rounded-xl text-xs hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Room Inventory List */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Configured Rooms ({rooms.length})
              </h2>
            </div>

            {rooms.length === 0 ? (
              <div className="p-10 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium">No rooms allocated yet.</p>
              </div>
            ) : (
              rooms.map(room => (
                <div
                  key={room.id || room._id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-indigo-200 hover:shadow-sm transition-all"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-900 truncate">{room.name}</h3>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-semibold flex-shrink-0">
                        {room.department}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium flex-shrink-0">
                        {room.type}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1">
                      {room.building} • Floor {room.floor} • #{room.roomNumber} • {room.capacity} seats
                    </p>

                    {/* Compact Amenities Indicators */}
                    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                      {room.hasAC && <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">❄️ AC</span>}
                      {room.hasProjector && <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">📽️ Projector</span>}
                      {room.hasSmartBoard && <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">🖥️ SmartBoard</span>}
                      {room.hasWiFi && <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">📶 Wi-Fi</span>}
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(room)}
                      title="Edit room"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(room)}
                      title="Delete room"
                      className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        {/* ── Master Timetables Panel ──────────────────────────── */}
        {activeTab === 'timetable' && (
          <TimetableManager user={{ role: 'ADMIN' }} isAdmin={true} />
        )}
      </div>
    </>
  );
}