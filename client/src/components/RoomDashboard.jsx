import React, { useState, useEffect } from 'react';
import { getRooms, getAvailableRooms } from '../services/api';
import { getSocket } from '../services/socket';

export default function RoomDashboard({ user }) {
  const [rooms, setRooms] = useState([]);
  const [availableRoomIds, setAvailableRoomIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Helper to get current time string in HH:MM format
  const getCurrentTimeString = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };

  // Helper to get today's date as YYYY-MM-DD
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const date = getTodayDate();
      // We'll use current time as start, and +1 hour as end for checking availability
      const startTime = getCurrentTimeString();
      const [h, m] = startTime.split(':').map(Number);
      const endH = h + 1;
      const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      // Fetch all rooms (department-specific if user is HOD)
      const dept = user.role === 'HOD' ? user.department : user.department;
      const roomsData = await getRooms({ department: dept });
      setRooms(roomsData.data || []);

      // Fetch available rooms for current time slot
      const availData = await getAvailableRooms(date, startTime, endTime, { department: dept });
      const ids = (availData.data || []).map(r => r.id);
      setAvailableRoomIds(ids);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds to keep time updated
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Socket listeners for real-time updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleBookingCreated = () => {
      fetchData();
    };
    const handleBookingCancelled = () => {
      fetchData();
    };

    socket.on('booking-created', handleBookingCreated);
    socket.on('booking-cancelled', handleBookingCancelled);

    return () => {
      socket.off('booking-created', handleBookingCreated);
      socket.off('booking-cancelled', handleBookingCancelled);
    };
  }, []);

  const isRoomAvailable = (roomId) => availableRoomIds.includes(roomId);

  if (loading && rooms.length === 0) {
    return <div className="text-slate-500">Loading rooms...</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Live Room Status</h2>
        <span className="text-sm text-slate-500">
          Updated at {currentTime.toLocaleTimeString()}
        </span>
      </div>
      {error && <div className="bg-rose-50 text-rose-800 p-3 rounded mb-4">{error}</div>}

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
              <div className="mt-4 text-xs text-slate-400">
                {available ? 'Free now' : 'Currently booked'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}