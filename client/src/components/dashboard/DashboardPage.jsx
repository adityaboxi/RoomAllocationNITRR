import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { roomAPI, bookingAPI, timetableAPI } from '../../services/api';
import Navbar from '../common/Navbar';
import { Clock, AlertCircle, Plus, Loader, X, CheckCircle2, Edit2, Trash2 } from 'lucide-react';

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
  const [editingEntry, setEditingEntry] = useState(null);
  const [timetableForm, setTimetableForm] = useState({
    department: user?.department || '',
    semester: '3rd',
    section: 'A',
    entries: [{ day: 'Monday', startTime: '09:00', endTime: '10:00', subject: '', roomId: '', classGroup: '', faculty: '' }]
  });
  const [addingEntry, setAddingEntry] = useState(false);
  const [showSuccess, setShowSuccess] = useState(null);

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
      
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 7);
      const selectedDate = new Date(today);
      if (selectedDate > maxDate) {
        alert('Cannot book more than 7 days in advance');
        setLoading(false);
        return;
      }

      const startTime = prompt('Enter start time (HH:MM):', '14:00');
      if (!startTime) return;
      const endTime = prompt('Enter end time (HH:MM):', '15:00');
      if (!endTime) return;
      const purpose = prompt('Enter purpose:', 'Extra Class');
      if (!purpose) return;

      const [sH, sM] = startTime.split(':').map(Number);
      const [eH, eM] = endTime.split(':').map(Number);
      const durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);
      if (durationMinutes < 30) {
        alert('Booking must be at least 30 minutes');
        setLoading(false);
        return;
      }

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

  // ============================================
  // TIMETABLE MANAGEMENT
  // ============================================

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
    setError('');
    try {
      const filteredEntries = timetableForm.entries.filter(e => e.subject && e.roomId);
      
      if (filteredEntries.length === 0) {
        alert('Please add at least one valid entry with subject and room');
        setAddingEntry(false);
        return;
      }

      const response = await timetableAPI.create({
        department: timetableForm.department,
        semester: timetableForm.semester,
        section: timetableForm.section,
        entries: filteredEntries
      });

      if (response.data.success) {
        const msg = `✅ Timetable updated! ${response.data.data.entriesAdded} entries added, ${response.data.data.bookingsCancelled} bookings auto-cancelled due to conflicts.`;
        setShowSuccess(msg);
        setShowTimetableModal(false);
        setTimetableForm({
          department: user?.department || '',
          semester: '3rd',
          section: 'A',
          entries: [{ day: 'Monday', startTime: '09:00', endTime: '10:00', subject: '', roomId: '', classGroup: '', faculty: '' }]
        });
        setEditingEntry(null);
        await fetchData();
        setTimeout(() => setShowSuccess(null), 5000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update timetable');
    } finally {
      setAddingEntry(false);
    }
  };

  const handleDeleteTimetableEntry = async (entryId) => {
    if (!confirm('Are you sure you want to delete this timetable entry?')) return;
    try {
      setLoading(true);
      await timetableAPI.delete(entryId);
      await fetchData();
      alert('✅ Timetable entry deleted successfully!');
    } catch (err) {
      alert('❌ Failed to delete: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
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

        {showSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            {showSuccess}
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

        {/* Dashboard View */}
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

        {/* Bookings View */}
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

        {/* ============================================ */}
        {/* TIMETABLE VIEW - WITH ADD TIMETABLE BUTTON */}
        {/* ============================================ */}
        {view === 'timetable' && (
          <div className="bg-white rounded-2xl border p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">📅 Timetable Management</h3>
                <p className="text-sm text-slate-500">Manage all timetable entries for your department</p>
              </div>
              {user?.role === 'HOD' && (
                <button
                  onClick={() => {
                    setEditingEntry(null);
                    setTimetableForm({
                      department: user?.department || '',
                      semester: '3rd',
                      section: 'A',
                      entries: [{ day: 'Monday', startTime: '09:00', endTime: '10:00', subject: '', roomId: '', classGroup: '', faculty: '' }]
                    });
                    setShowTimetableModal(true);
                  }}
                  className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition shadow-sm hover:shadow"
                >
                  <Plus className="w-4 h-4" /> Add Timetable
                </button>
              )}
            </div>
            
            {timetable.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-slate-500 text-sm">No timetable entries found</p>
                {user?.role === 'HOD' && (
                  <button
                    onClick={() => {
                      setEditingEntry(null);
                      setTimetableForm({
                        department: user?.department || '',
                        semester: '3rd',
                        section: 'A',
                        entries: [{ day: 'Monday', startTime: '09:00', endTime: '10:00', subject: '', roomId: '', classGroup: '', faculty: '' }]
                      });
                      setShowTimetableModal(true);
                    }}
                    className="mt-4 text-sm bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add First Entry
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left py-2 px-3 font-semibold">#</th>
                      <th className="text-left py-2 px-3 font-semibold">Day</th>
                      <th className="text-left py-2 px-3 font-semibold">Time</th>
                      <th className="text-left py-2 px-3 font-semibold">Subject</th>
                      <th className="text-left py-2 px-3 font-semibold">Faculty</th>
                      <th className="text-left py-2 px-3 font-semibold">Room</th>
                      <th className="text-left py-2 px-3 font-semibold">Class</th>
                      {user?.role === 'HOD' && <th className="text-left py-2 px-3 font-semibold">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {timetable.map((entry, index) => (
                      <tr key={entry._id} className="border-b hover:bg-blue-50/30 transition">
                        <td className="py-2 px-3 text-slate-500">{index + 1}</td>
                        <td className="py-2 px-3 font-medium">{entry.day}</td>
                        <td className="py-2 px-3">{entry.startTime} - {entry.endTime}</td>
                        <td className="py-2 px-3 font-medium text-blue-700">{entry.subject}</td>
                        <td className="py-2 px-3">{entry.faculty}</td>
                        <td className="py-2 px-3">
                          <span className="bg-slate-100 px-2 py-1 rounded text-xs">
                            {entry.roomId?.name}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded">
                            {entry.classGroup}
                          </span>
                        </td>
                        {user?.role === 'HOD' && (
                          <td className="py-2 px-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingEntry(entry);
                                  setTimetableForm({
                                    department: entry.department,
                                    semester: entry.semester,
                                    section: entry.section,
                                    entries: [{
                                      day: entry.day,
                                      startTime: entry.startTime,
                                      endTime: entry.endTime,
                                      subject: entry.subject,
                                      roomId: entry.roomId,
                                      classGroup: entry.classGroup,
                                      faculty: entry.faculty
                                    }]
                                  });
                                  setShowTimetableModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50 transition"
                                title="Edit Entry"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTimetableEntry(entry._id)}
                                className="text-rose-600 hover:text-rose-800 p-1.5 rounded hover:bg-rose-50 transition"
                                title="Delete Entry"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 text-xs text-slate-500 flex justify-between items-center">
                  <span>Total: {timetable.length} entries</span>
                  <span className="text-slate-400">Showing all entries</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ============================================ */}
      {/* TIMETABLE MODAL - Add/Edit Entries */}
      {/* ============================================ */}
      {showTimetableModal && user?.role === 'HOD' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingEntry ? '✏️ Edit Timetable Entry' : '📅 Add New Timetable'}
                </h2>
                <p className="text-sm text-slate-500">
                  {editingEntry ? 'Update the selected timetable entry' : 'Add new entries to the timetable'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowTimetableModal(false);
                  setEditingEntry(null);
                }} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition"
              >
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
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50"
                    required
                    disabled={!!editingEntry}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                  <select
                    value={timetableForm.semester}
                    onChange={(e) => setTimetableForm({ ...timetableForm, semester: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50"
                    disabled={!!editingEntry}
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
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50"
                    disabled={!!editingEntry}
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
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-4 h-4" /> Add Row
                  </button>
                </div>

                <div className="space-y-3">
                  {timetableForm.entries.map((entry, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-slate-50 hover:bg-slate-100/50 transition">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600">Day</label>
                          <select
                            value={entry.day}
                            onChange={(e) => handleTimetableEntryChange(index, 'day', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs bg-white"
                            required
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
                            className="w-full px-2 py-1 border rounded text-xs bg-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600">End</label>
                          <input
                            type="time"
                            value={entry.endTime}
                            onChange={(e) => handleTimetableEntryChange(index, 'endTime', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs bg-white"
                            required
                          />
                        </div>
                        <div className="flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveTimetableEntry(index)}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition"
                            title="Remove Entry"
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
                            className="w-full px-2 py-1 border rounded text-xs bg-white"
                            placeholder="e.g., Data Structures"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600">Room</label>
                          <select
                            value={entry.roomId}
                            onChange={(e) => handleTimetableEntryChange(index, 'roomId', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs bg-white"
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
                            className="w-full px-2 py-1 border rounded text-xs bg-white"
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
                          className="w-full px-2 py-1 border rounded text-xs bg-white"
                          placeholder="e.g., CS-3A"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-sm text-slate-600 bg-amber-50 border border-amber-200 p-3 rounded-lg mb-4">
                <p className="font-medium flex items-center gap-1">⚠️ Note:</p>
                <p className="text-xs">Any existing bookings that conflict with this timetable will be automatically cancelled and affected professors will be notified via email.</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addingEntry}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addingEntry ? <><Loader className="w-4 h-4 animate-spin" /> Updating...</> : editingEntry ? 'Update Entry' : 'Add Timetable'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTimetableModal(false);
                    setEditingEntry(null);
                  }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2.5 px-4 rounded-lg transition"
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
