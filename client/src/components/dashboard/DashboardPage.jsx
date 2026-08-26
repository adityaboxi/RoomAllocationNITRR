import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { roomAPI, bookingAPI, timetableAPI } from '../../services/api';
import Navbar from '../common/Navbar';
import { Clock, AlertCircle, Plus, Loader, X, CheckCircle2 } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [stats, setStats] = useState({ totalRooms: 0, available: 0, myBookings: 0, totalBookings: 0 });
  const [activeDay] = useState('Wednesday');
  const [activeTime, setActiveTime] = useState('10:30');
  const [view, setView] = useState('dashboard');
  const [error, setError] = useState('');
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [timetableForm, setTimetableForm] = useState({
    department: user?.department || '',
    semester: '3rd',
    section: 'A',
    entries: [{ day: 'Monday', startTime: '09:00', endTime: '10:00', subject: '', roomId: '', classGroup: '', faculty: '' }]
  });
  const [addingEntry, setAddingEntry] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [roomsRes, bookingsRes, timetableRes] = await Promise.all([
        roomAPI.getAll(),
        bookingAPI.getMyBookings(),
        timetableAPI.getAll(),
      ]);

      const allRooms = roomsRes.data.data || [];
      const allBookings = bookingsRes.data.data || [];
      const allTimetable = timetableRes.data.data || [];

      setRooms(allRooms);
      setBookings(allBookings);
      setTimetable(allTimetable);

      setStats({
        totalRooms: allRooms.length,
        available: allRooms.filter(r => r.isAvailable).length,
        myBookings: allBookings.filter(b => b.status === 'active').length,
        totalBookings: allBookings.length,
      });
    } catch (err) {
      setError('Failed to fetch data. Please refresh.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkRoomStatus = (roomId) => {
    const ttClash = timetable.find(
      (t) => t.roomId === roomId && 
      t.day === activeDay && 
      t.startTime <= activeTime && 
      activeTime < t.endTime
    );
    if (ttClash) {
      return { 
        status: 'occupied', 
        label: `Class: ${ttClash.subject}`, 
        sub: `${ttClash.classGroup} (${ttClash.faculty})`, 
        until: ttClash.endTime 
      };
    }

    const bookingClash = bookings.find(
      (b) => b.roomId === roomId && 
      b.startTime <= activeTime && 
      activeTime < b.endTime
    );
    if (bookingClash) {
      return { 
        status: 'occupied', 
        label: `Reserved: ${bookingClash.purpose}`, 
        sub: bookingClash.facultyName, 
        until: bookingClash.endTime 
      };
    }

    return { status: 'available', label: 'Available', sub: 'Ready for booking' };
  };

  const handleBookRoom = async (roomId) => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const startTime = prompt('Enter start time (HH:MM):', '14:00');
      if (!startTime) return;
      const endTime = prompt('Enter end time (HH:MM):', '15:00');
      if (!endTime) return;
      const purpose = prompt('Enter purpose:', 'Extra Class');
      if (!purpose) return;

      await bookingAPI.create({
        roomId,
        date: today,
        startTime,
        endTime,
        purpose,
      });

      alert('✅ Room booked successfully!');
      await fetchData();
    } catch (err) {
      alert('❌ Booking failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      setLoading(true);
      await bookingAPI.cancel(bookingId);
      await fetchData();
      alert('✅ Booking cancelled successfully!');
    } catch (err) {
      alert('❌ Failed to cancel: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddTimetableEntry = () => {
    setTimetableForm({
      ...timetableForm,
      entries: [
        ...timetableForm.entries,
        { day: 'Monday', startTime: '09:00', endTime: '10:00', subject: '', roomId: '', classGroup: '', faculty: '' }
      ]
    });
  };

  const handleTimetableEntryChange = (index, field, value) => {
    const updatedEntries = [...timetableForm.entries];
    updatedEntries[index][field] = value;
    setTimetableForm({ ...timetableForm, entries: updatedEntries });
  };

  const handleRemoveTimetableEntry = (index) => {
    if (timetableForm.entries.length === 1) {
      alert('You need at least one entry');
      return;
    }
    const updatedEntries = timetableForm.entries.filter((_, i) => i !== index);
    setTimetableForm({ ...timetableForm, entries: updatedEntries });
  };

  const handleSubmitTimetable = async (e) => {
    e.preventDefault();
    setAddingEntry(true);
    try {
      const response = await timetableAPI.create({
        department: timetableForm.department,
        semester: timetableForm.semester,
        section: timetableForm.section,
        entries: timetableForm.entries.filter(e => e.subject && e.roomId)
      });

      if (response.data.success) {
        alert(`✅ Timetable updated! ${response.data.data.entriesAdded} entries added, ${response.data.data.bookingsCancelled} bookings auto-cancelled due to conflicts.`);
        setShowTimetableModal(false);
        await fetchData();
      }
    } catch (err) {
      alert('❌ Failed to update timetable: ' + (err.response?.data?.message || err.message));
    } finally {
      setAddingEntry(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome, {user?.name}
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              {user?.role === 'HOD' 
                ? 'Department Master Schedule & Allocation Dashboard'
                : 'Check live room availability and claim an open slot instantly.'}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
            <Clock className="w-5 h-5 text-indigo-600" />
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Simulated Time</div>
              <div className="text-sm font-bold text-slate-800">{activeDay} at {activeTime}</div>
            </div>
            <input
              type="time"
              value={activeTime}
              onChange={(e) => setActiveTime(e.target.value)}
              className="ml-2 border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white font-medium outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-slate-500">Total Rooms</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalRooms}</p>
          </div>
          <div className="bg-white rounded-xl border p-4 border-green-200">
            <p className="text-sm text-slate-500">Available</p>
            <p className="text-2xl font-bold text-green-600">{stats.available}</p>
          </div>
          <div className="bg-white rounded-xl border p-4 border-blue-200">
            <p className="text-sm text-slate-500">My Active Bookings</p>
            <p className="text-2xl font-bold text-blue-600">{stats.myBookings}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-slate-500">Total Bookings</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalBookings}</p>
          </div>
        </div>

        <div className="flex gap-1 mb-6 bg-white rounded-xl border p-1">
          {['dashboard', 'rooms', 'bookings', 'timetable'].map(tab => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                view === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'dashboard' && '📊 Dashboard'}
              {tab === 'rooms' && '🏢 Rooms'}
              {tab === 'bookings' && '📋 My Bookings'}
              {tab === 'timetable' && '📅 Timetable'}
            </button>
          ))}
        </div>

        {view === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {rooms.map((room) => {
              const info = checkRoomStatus(room._id);
              const isAvailable = info.status === 'available';

              return (
                <div
                  key={room._id}
                  className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col justify-between transition-all ${
                    isAvailable ? 'border-emerald-300 ring-1 ring-emerald-400/20' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-base text-slate-900">{room.name}</h3>
                        <p className="text-xs text-slate-500">{room.floor} • Cap: {room.capacity}</p>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                          isAvailable
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {isAvailable ? 'Available' : 'Occupied'}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 my-3">
                      <div className="text-xs font-semibold text-slate-800">{info.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{info.sub}</div>
                      {info.until && (
                        <div className="text-[11px] text-slate-400 mt-1">Busy until: {info.until}</div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleBookRoom(room._id)}
                    disabled={!isAvailable}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                      isAvailable
                        ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    }`}
                  >
                    {isAvailable ? '⚡ Quick Book Now' : 'Room Busy'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {view === 'bookings' && (
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-bold text-slate-900 mb-4">My Bookings</h3>
            {bookings.length === 0 ? (
              <p className="text-slate-500 text-sm">No bookings found</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <div key={booking._id} className={`border rounded-xl p-4 border-l-4 ${
                    booking.status === 'cancelled' ? 'border-l-rose-500 bg-rose-50/30' : 
                    booking.status === 'active' ? 'border-l-blue-500' : 'border-l-green-500'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-900">{booking.purpose}</p>
                        <p className="text-sm text-slate-600">
                          {booking.roomId?.name} • {booking.date} • {booking.startTime}-{booking.endTime}
                        </p>
                        <p className={`text-xs font-medium ${
                          booking.status === 'cancelled' ? 'text-rose-600' : 
                          booking.status === 'active' ? 'text-blue-600' : 'text-green-600'
                        }`}>
                          Status: {booking.status}
                          {booking.conflictMessage && (
                            <span className="text-rose-600 ml-2">⚠️ {booking.conflictMessage}</span>
                          )}
                        </p>
                      </div>
                      {booking.status === 'active' && (
                        <button
                          onClick={() => handleCancelBooking(booking._id)}
                          className="text-sm text-rose-600 hover:text-rose-700 font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'timetable' && (
          <div className="bg-white rounded-2xl border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900">Timetable</h3>
              {user?.role === 'HOD' && (
                <button
                  onClick={() => setShowTimetableModal(true)}
                  className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" /> Update Timetable
                </button>
              )}
            </div>
            {timetable.length === 0 ? (
              <p className="text-slate-500 text-sm">No timetable entries found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Day</th>
                      <th className="text-left py-2">Time</th>
                      <th className="text-left py-2">Subject</th>
                      <th className="text-left py-2">Faculty</th>
                      <th className="text-left py-2">Room</th>
                      <th className="text-left py-2">Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timetable.map((entry) => (
                      <tr key={entry._id} className="border-b hover:bg-slate-50">
                        <td className="py-2">{entry.day}</td>
                        <td className="py-2">{entry.startTime}-{entry.endTime}</td>
                        <td className="py-2 font-medium">{entry.subject}</td>
                        <td className="py-2">{entry.faculty}</td>
                        <td className="py-2">{entry.roomId?.name}</td>
                        <td className="py-2 text-xs">{entry.classGroup}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Timetable Modal - Only for HOD */}
      {showTimetableModal && user?.role === 'HOD' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900">Update Timetable</h2>
              <button onClick={() => setShowTimetableModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitTimetable}>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={timetableForm.department}
                    onChange={(e) => setTimetableForm({ ...timetableForm, department: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                  <select
                    value={timetableForm.semester}
                    onChange={(e) => setTimetableForm({ ...timetableForm, semester: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="3rd">3rd</option>
                    <option value="4th">4th</option>
                    <option value="5th">5th</option>
                    <option value="6th">6th</option>
                    <option value="7th">7th</option>
                    <option value="8th">8th</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
                  <select
                    value={timetableForm.section}
                    onChange={(e) => setTimetableForm({ ...timetableForm, section: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-sm">Timetable Entries</h4>
                  <button
                    type="button"
                    onClick={handleAddTimetableEntry}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Entry
                  </button>
                </div>

                <div className="space-y-3">
                  {timetableForm.entries.map((entry, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-slate-50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600">Day</label>
                          <select
                            value={entry.day}
                            onChange={(e) => handleTimetableEntryChange(index, 'day', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                          >
                            <option value="Monday">Monday</option>
                            <option value="Tuesday">Tuesday</option>
                            <option value="Wednesday">Wednesday</option>
                            <option value="Thursday">Thursday</option>
                            <option value="Friday">Friday</option>
                            <option value="Saturday">Saturday</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600">Start</label>
                          <input
                            type="time"
                            value={entry.startTime}
                            onChange={(e) => handleTimetableEntryChange(index, 'startTime', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600">End</label>
                          <input
                            type="time"
                            value={entry.endTime}
                            onChange={(e) => handleTimetableEntryChange(index, 'endTime', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                            required
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveTimetableEntry(index)}
                            className="text-rose-500 hover:text-rose-700 text-sm px-2 py-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-semibold text-slate-600">Subject</label>
                          <input
                            type="text"
                            value={entry.subject}
                            onChange={(e) => handleTimetableEntryChange(index, 'subject', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                            placeholder="e.g., Data Structures"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600">Room</label>
                          <select
                            value={entry.roomId}
                            onChange={(e) => handleTimetableEntryChange(index, 'roomId', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                            required
                          >
                            <option value="">Select Room</option>
                            {rooms.map(room => (
                              <option key={room._id} value={room._id}>{room.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600">Faculty</label>
                          <input
                            type="text"
                            value={entry.faculty}
                            onChange={(e) => handleTimetableEntryChange(index, 'faculty', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                            placeholder="Dr. Name"
                            required
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="block text-[10px] font-semibold text-slate-600">Class Group</label>
                        <input
                          type="text"
                          value={entry.classGroup}
                          onChange={(e) => handleTimetableEntryChange(index, 'classGroup', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-xs"
                          placeholder="e.g., CS-3A"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-sm text-slate-600 bg-amber-50 border border-amber-200 p-3 rounded-lg mb-4">
                <p className="font-medium">⚠️ Note:</p>
                <p>Any existing bookings that conflict with this timetable will be automatically cancelled and affected professors will be notified.</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addingEntry}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addingEntry ? <><Loader className="w-4 h-4 animate-spin" /> Updating...</> : 'Update Timetable'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTimetableModal(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
