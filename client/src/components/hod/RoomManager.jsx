import React, { useState, useEffect } from 'react';
import {
  getRooms,
  getAvailableRooms,
  createRoom,
  updateRoom,
  toggleRoomAvailability,
  deleteRoom,
} from '../../services/api';
import { getSocket } from '../../services/socket';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Power,
  CheckCircle2,
  AlertCircle,
  Users,
  Layers,
  UserCheck,
  X,
  Loader2,
} from 'lucide-react';

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

const extractErrorMessage = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err.response?.data?.message || err.message || fallback;
};

export default function RoomManager({ user }) {
  const [rooms, setRooms] = useState([]);
  const [availableRoomIds, setAvailableRoomIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [editingRoom, setEditingRoom] = useState(null);

  const initialFormState = {
    name: '',
    roomNumber: '',
    capacity: '',
    type: 'Classroom',
    floor: '',
    building: 'Main Building',
    hasProjector: false,
    hasAC: false,
    hasSmartBoard: false,
    hasWiFi: false,
    isAvailable: true,
  };

  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentUserId = user?.id || user?._id;
  const isHOD = user?.role === 'HOD';

  useEffect(() => {
    fetchRooms();

    const socket = getSocket();
    if (!socket) return;

    const handleRoomLiveSync = () => {
      fetchRooms();
    };

    socket.on('room-created', handleRoomLiveSync);
    socket.on('room-updated', handleRoomLiveSync);
    socket.on('room-deleted', handleRoomLiveSync);
    socket.on('booking-created', handleRoomLiveSync);
    socket.on('booking-cancelled', handleRoomLiveSync);
    socket.on('room-locked', handleRoomLiveSync);
    socket.on('room-unlocked', handleRoomLiveSync);
    socket.on('timetable-updated', handleRoomLiveSync);

    return () => {
      socket.off('room-created', handleRoomLiveSync);
      socket.off('room-updated', handleRoomLiveSync);
      socket.off('room-deleted', handleRoomLiveSync);
      socket.off('booking-created', handleRoomLiveSync);
      socket.off('booking-cancelled', handleRoomLiveSync);
      socket.off('room-locked', handleRoomLiveSync);
      socket.off('room-unlocked', handleRoomLiveSync);
      socket.off('timetable-updated', handleRoomLiveSync);
    };
  }, [user?.department]);

  const fetchRooms = async () => {
    setFetchLoading(true);
    setError('');
    try {
      const date = getTodayDateString();
      const startTime = getCurrentTimeString();
      const [h, m] = startTime.split(':').map(Number);
      const endH = (h + 1) % 24;
      const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      const [data, availData] = await Promise.all([
        getRooms({ department: user?.department }),
        getAvailableRooms(date, startTime, endTime, { department: user?.department }),
      ]);

      setRooms(data?.data || []);
      const freeIds = (availData?.data || []).map((r) => r.id || r._id);
      setAvailableRoomIds(freeIds);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to load department rooms. Please check your connection.');
      console.error('❌ [ROOM MGR] Failed to load rooms:', errMsg);
      setError(errMsg);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
    setSuccess('');
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingRoom(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setSuccess('');

    const trimmedName = formData.name.trim();
    const trimmedNumber = formData.roomNumber.trim().toUpperCase();

    if (!trimmedName || !trimmedNumber) {
      setError('Please provide a valid room name and room number.');
      return;
    }

    // Instant duplicate check against department's existing room catalog
    const isDuplicate = rooms.some((r) => {
      const isCurrentEditing = editingRoom && (r.id === editingRoom.id || r._id === editingRoom._id);
      if (isCurrentEditing) return false;

      return (
        r.name.trim().toLowerCase() === trimmedName.toLowerCase() ||
        r.roomNumber.trim().toUpperCase() === trimmedNumber
      );
    });

    if (isDuplicate) {
      setError(
        `This room is already present! A room with the name "${trimmedName}" or room number "${trimmedNumber}" already exists in the ${user?.department} department.`
      );
      return;
    }

    const capacityNum = parseInt(formData.capacity, 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      setError('Room capacity must be a positive number greater than 0.');
      return;
    }

    setLoading(true);

    const payload = {
      ...formData,
      name: trimmedName,
      roomNumber: trimmedNumber,
      capacity: capacityNum,
      floor: formData.floor.trim(),
      building: formData.building.trim(),
      department: user?.department,
    };

    console.log(`🏫 [ROOM MGR] Saving room: ${payload.name} (${payload.roomNumber})`);

    try {
      if (editingRoom) {
        const roomId = editingRoom.id || editingRoom._id;
        await updateRoom(roomId, payload);
        console.log(`✅ [ROOM MGR] Room ${payload.name} updated`);
        setSuccess(`Room "${payload.name}" (${payload.roomNumber}) updated successfully.`);
      } else {
        await createRoom(payload);
        console.log(`✅ [ROOM MGR] Room ${payload.name} created`);
        setSuccess(`Room "${payload.name}" (${payload.roomNumber}) added to ${user?.department} inventory.`);
      }

      resetForm();
      await fetchRooms();
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to save room details. Please try again.');
      console.error('❌ [ROOM MGR] Save failed:', errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (room) => {
    const isOwner = room.createdBy && room.createdBy.toString() === currentUserId?.toString();
    if (!isOwner && !isHOD) {
      setError(`Permission denied: Only Prof. ${room.createdByName || 'the creator'} or the HOD can edit "${room.name}".`);
      return;
    }

    setEditingRoom(room);
    setFormData({
      name: room.name || '',
      roomNumber: room.roomNumber || '',
      capacity: room.capacity || '',
      type: room.type || 'Classroom',
      floor: room.floor || '',
      building: room.building || 'Main Building',
      hasProjector: !!room.hasProjector,
      hasAC: !!room.hasAC,
      hasSmartBoard: !!room.hasSmartBoard,
      hasWiFi: !!room.hasWiFi,
      isAvailable: room.isAvailable !== undefined ? room.isAvailable : true,
    });
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggle = async (room) => {
    if (actionLoadingId) return;
    const isOwner = room.createdBy && room.createdBy.toString() === currentUserId?.toString();
    if (!isOwner && !isHOD) {
      setError(`Permission denied: Only Prof. ${room.createdByName || 'the creator'} or the HOD can toggle "${room.name}".`);
      return;
    }

    const roomId = room.id || room._id;
    setActionLoadingId(roomId);
    setError('');
    setSuccess('');
    console.log(`🔄 [ROOM MGR] Toggling availability for room: ${room.name}`);

    try {
      await toggleRoomAvailability(roomId);
      console.log(`✅ [ROOM MGR] Availability toggled for ${room.name}`);
      await fetchRooms();
      setSuccess(`Room "${room.name}" availability toggled successfully.`);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to toggle room status.');
      console.error('❌ [ROOM MGR] Toggle failed:', errMsg);
      setError(errMsg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (room) => {
    if (actionLoadingId) return;
    const isOwner = room.createdBy && room.createdBy.toString() === currentUserId?.toString();
    if (!isOwner && !isHOD) {
      setError(`Permission denied: Only Prof. ${room.createdByName || 'the creator'} or the HOD can delete "${room.name}".`);
      return;
    }

    const roomId = room.id || room._id;
    const confirmDelete = window.confirm(
      `Are you sure you want to remove "${room.name}" (${room.roomNumber})?\n\nThis will remove the room and cascade-cancel any scheduled slots and active bookings.`
    );
    if (!confirmDelete) return;

    setActionLoadingId(roomId);
    setError('');
    setSuccess('');
    console.log(`🗑️  [ROOM MGR] Deleting room: ${room.name} (${roomId})`);

    try {
      await deleteRoom(roomId);
      console.log(`✅ [ROOM MGR] Room ${room.name} deleted successfully`);
      await fetchRooms();
      setSuccess(`Room "${room.name}" removed successfully.`);
      if (editingRoom && (editingRoom.id === roomId || editingRoom._id === roomId)) {
        resetForm();
      }
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to delete room.');
      console.error('❌ [ROOM MGR] Delete failed:', errMsg);
      setError(errMsg);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start text-rose-800 text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 mr-2.5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 whitespace-pre-line">{error}</div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start text-emerald-800 text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 mr-2.5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{success}</div>
          <button type="button" onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                {editingRoom ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {editingRoom ? 'Edit Room' : 'Add Department Room'}
              </h3>
            </div>
            {editingRoom && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Name / Title *
              </label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Alan Turing Lab"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Room Number *
                </label>
                <input
                  name="roomNumber"
                  value={formData.roomNumber}
                  onChange={handleChange}
                  placeholder="CS-101"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm uppercase bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Capacity *
                </label>
                <input
                  name="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={handleChange}
                  placeholder="60"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Room Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Floor *</label>
                <input
                  name="floor"
                  value={formData.floor}
                  onChange={handleChange}
                  placeholder="Ground Floor"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Building *</label>
              <input
                name="building"
                value={formData.building}
                onChange={handleChange}
                placeholder="Main Campus / CSE Block"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                required
              />
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-2">Amenities</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <label className="flex items-center text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="hasProjector"
                    checked={formData.hasProjector}
                    onChange={handleChange}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  Projector
                </label>
                <label className="flex items-center text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="hasAC"
                    checked={formData.hasAC}
                    onChange={handleChange}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  Air Conditioning
                </label>
                <label className="flex items-center text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="hasSmartBoard"
                    checked={formData.hasSmartBoard}
                    onChange={handleChange}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  SmartBoard
                </label>
                <label className="flex items-center text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="hasWiFi"
                    checked={formData.hasWiFi}
                    onChange={handleChange}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  WiFi
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{loading ? 'Saving...' : editingRoom ? 'Update Room' : 'Add Room'}</span>
              </button>
              {editingRoom && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: Rooms List Table with Live Occupancy */}
        <div className="lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {user?.department} Room Catalog ({rooms.length})
                </h3>
              </div>
            </div>

            {fetchLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Loading rooms...</div>
            ) : rooms.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium">No rooms added to this department yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Room & Creator
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Location / Type
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Capacity
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Live Status
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rooms.map((room) => {
                      const roomId = room.id || room._id;
                      const isOwner = room.createdBy && room.createdBy.toString() === currentUserId?.toString();
                      const canModify = isOwner || isHOD;
                      const isFreeNow = availableRoomIds.includes(roomId);
                      const isActionBusy = actionLoadingId === roomId;

                      return (
                        <tr key={roomId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5 text-sm">
                            <div className="font-bold text-slate-900">{room.name}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              {room.roomNumber}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                              <UserCheck className="w-3 h-3 text-indigo-500" />
                              <span>Added by: <strong className="text-slate-600">{room.createdByName || 'Faculty'}</strong></span>
                              {isOwner && (
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold ml-1">
                                  You
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-sm">
                            <div className="text-slate-800 font-medium">{room.type}</div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              <span>{room.floor}, {room.building}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-sm text-slate-700 font-semibold">
                            <div className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span>{room.capacity}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-sm">
                            {!room.isAvailable ? (
                              <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-600">
                                ⚪ Deactivated
                              </span>
                            ) : isFreeNow ? (
                              <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                                🟢 Free Now
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800">
                                🔴 Class / Booked
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-sm text-right space-x-1.5 whitespace-nowrap">
                            {canModify ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(room)}
                                  disabled={isActionBusy}
                                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-40"
                                  title="Edit Room"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggle(room)}
                                  disabled={isActionBusy}
                                  className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                                    room.isAvailable ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={room.isAvailable ? 'Deactivate room' : 'Activate room'}
                                >
                                  {isActionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(room)}
                                  disabled={isActionBusy}
                                  className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                                  title="Delete Room"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic px-2">
                                Read Only
                              </span>
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
        </div>
      </div>
    </div>
  );
}