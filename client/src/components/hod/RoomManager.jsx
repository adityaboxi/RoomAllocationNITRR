import React, { useState, useEffect } from 'react';
import { getRooms, createRoom, updateRoom, toggleRoomAvailability, deleteRoom } from '../../services/api';

export default function RoomManager({ user }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    roomNumber: '',
    capacity: '',
    type: 'Classroom',
    floor: '',
    building: '',
    hasProjector: false,
    hasAC: false,
    hasSmartBoard: false,
    hasWiFi: false,
    isAvailable: true,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const data = await getRooms({ department: user.department });
      setRooms(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, formData);
        setSuccess('Room updated.');
      } else {
        await createRoom(formData);
        setSuccess('Room created.');
      }
      setFormData({
        name: '',
        roomNumber: '',
        capacity: '',
        type: 'Classroom',
        floor: '',
        building: '',
        hasProjector: false,
        hasAC: false,
        hasSmartBoard: false,
        hasWiFi: false,
        isAvailable: true,
      });
      setEditingRoom(null);
      fetchRooms();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      roomNumber: room.roomNumber,
      capacity: room.capacity,
      type: room.type,
      floor: room.floor,
      building: room.building,
      hasProjector: room.hasProjector || false,
      hasAC: room.hasAC || false,
      hasSmartBoard: room.hasSmartBoard || false,
      hasWiFi: room.hasWiFi || false,
      isAvailable: room.isAvailable,
    });
  };

  const handleToggle = async (roomId) => {
    try {
      await toggleRoomAvailability(roomId);
      fetchRooms();
      setSuccess('Room availability toggled.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (roomId) => {
    if (!window.confirm('Delete this room?')) return;
    try {
      await deleteRoom(roomId);
      fetchRooms();
      setSuccess('Room deleted.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      {error && <div className="bg-rose-50 text-rose-800 p-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-emerald-50 text-emerald-800 p-3 rounded mb-4">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">{editingRoom ? 'Edit Room' : 'Add Room'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Room Name"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              name="roomNumber"
              value={formData.roomNumber}
              onChange={handleChange}
              placeholder="Room Number"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              name="capacity"
              type="number"
              value={formData.capacity}
              onChange={handleChange}
              placeholder="Capacity"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Classroom">Classroom</option>
              <option value="Lab">Lab</option>
              <option value="Auditorium">Auditorium</option>
              <option value="Lecture Hall">Lecture Hall</option>
              <option value="Seminar Hall">Seminar Hall</option>
              <option value="Conference Room">Conference Room</option>
            </select>
            <input
              name="floor"
              value={formData.floor}
              onChange={handleChange}
              placeholder="Floor"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              name="building"
              value={formData.building}
              onChange={handleChange}
              placeholder="Building"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center text-sm">
                <input type="checkbox" name="hasProjector" checked={formData.hasProjector} onChange={handleChange} className="mr-2" />
                Projector
              </label>
              <label className="flex items-center text-sm">
                <input type="checkbox" name="hasAC" checked={formData.hasAC} onChange={handleChange} className="mr-2" />
                AC
              </label>
              <label className="flex items-center text-sm">
                <input type="checkbox" name="hasSmartBoard" checked={formData.hasSmartBoard} onChange={handleChange} className="mr-2" />
                SmartBoard
              </label>
              <label className="flex items-center text-sm">
                <input type="checkbox" name="hasWiFi" checked={formData.hasWiFi} onChange={handleChange} className="mr-2" />
                WiFi
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                {loading ? 'Saving...' : editingRoom ? 'Update' : 'Add'}
              </button>
              {editingRoom && (
                <button type="button" onClick={() => { setEditingRoom(null); setFormData({ name: '', roomNumber: '', capacity: '', type: 'Classroom', floor: '', building: '', hasProjector: false, hasAC: false, hasSmartBoard: false, hasWiFi: false, isAvailable: true }); }} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-300">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold">Name</th>
                  <th className="text-left p-3 text-sm font-semibold">Number</th>
                  <th className="text-left p-3 text-sm font-semibold">Capacity</th>
                  <th className="text-left p-3 text-sm font-semibold">Status</th>
                  <th className="text-left p-3 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-t">
                    <td className="p-3 text-sm">{room.name}</td>
                    <td className="p-3 text-sm">{room.roomNumber}</td>
                    <td className="p-3 text-sm">{room.capacity}</td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${room.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {room.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="p-3 text-sm space-x-2">
                      <button onClick={() => handleEdit(room)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
                      <button onClick={() => handleToggle(room.id)} className="text-amber-600 hover:text-amber-800 text-sm">Toggle</button>
                      <button onClick={() => handleDelete(room.id)} className="text-rose-600 hover:text-rose-800 text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}