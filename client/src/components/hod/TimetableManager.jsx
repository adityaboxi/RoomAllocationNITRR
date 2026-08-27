import React, { useState, useEffect } from 'react';
import { getRooms, getTimetable, replaceTimetable, updateTimetableEntry, deleteTimetableEntry } from '../../services/api';
import { Download, Copy } from 'lucide-react'; // make sure lucide-react is installed

// Use environment variable for API base, fallback to relative (proxied by Vite)
const API_BASE = import.meta.env.VITE_API_URL || '';

export default function TimetableManager({ user }) {
  const [rooms, setRooms] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [semester, setSemester] = useState('1st');
  const [section, setSection] = useState('A');
  const [entries, setEntries] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ---------- NEW: Room selection state ----------
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    fetchRooms();
    fetchTimetable();
  }, []);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const data = await getRooms({ department: user.department });
      setRooms(data.data || []);
      // Select all rooms by default
      setSelectedRoomIds(data.data.map(r => r.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchTimetable = async () => {
    try {
      const data = await getTimetable({ department: user.department, semester, section });
      setTimetable(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [semester, section]);

  // ----- Manual entries -----
  const handleAddEntry = () => {
    setEntries([...entries, { day: 'Monday', startTime: '09:00', endTime: '10:00', subject: '', roomId: '', classGroup: '', faculty: '' }]);
  };

  const handleEntryChange = (index, field, value) => {
    const updated = [...entries];
    updated[index][field] = value;
    setEntries(updated);
  };

  const handleRemoveEntry = (index) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleReplaceTimetable = async (e) => {
    e.preventDefault();
    if (!semester || !section || entries.length === 0) {
      setError('Please fill semester, section and at least one entry.');
      return;
    }
    for (let e of entries) {
      if (!e.day || !e.startTime || !e.endTime || !e.subject || !e.roomId || !e.classGroup || !e.faculty) {
        setError('All fields in each entry are required.');
        return;
      }
      if (e.startTime >= e.endTime) {
        setError('Start time must be before end time.');
        return;
      }
    }
    setLoading(true);
    try {
      const data = await replaceTimetable({
        department: user.department,
        semester,
        section,
        entries,
      });
      setSuccess(`Timetable replaced. ${data.data.bookingsCancelled} bookings cancelled.`);
      setEntries([]);
      fetchTimetable();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ----- File upload -----
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('semester', semester);
    formData.append('section', section);

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/timetable/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSuccess(data.message);
      setEntries([]);
      fetchTimetable();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ----- Update & Delete -----
  const handleUpdateEntry = async (entryId, updatedData) => {
    setLoading(true);
    try {
      await updateTimetableEntry(entryId, updatedData);
      setSuccess('Entry updated.');
      fetchTimetable();
      setEditingEntry(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Delete this timetable entry?')) return;
    try {
      await deleteTimetableEntry(entryId);
      setSuccess('Entry deleted.');
      fetchTimetable();
    } catch (err) {
      setError(err.message);
    }
  };

  // ---------- NEW: Download template with selected rooms ----------
  const downloadTemplate = () => {
    if (selectedRoomIds.length === 0) {
      alert('Please select at least one room.');
      return;
    }
    const selectedRooms = rooms.filter(r => selectedRoomIds.includes(r.id));
    const roomNames = selectedRooms.map(r => r.name);

    let csv = 'Day,Start Time,End Time,Subject,RoomId,Class Group,Faculty\n';
    roomNames.forEach(name => {
      csv += `,,,,${name},,\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable_template_${user.department}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- NEW: Copy room names to clipboard ----------
  const copyRoomNames = () => {
    const names = rooms
      .filter(r => selectedRoomIds.includes(r.id))
      .map(r => r.name)
      .join(', ');
    navigator.clipboard.writeText(names);
    alert('Room names copied to clipboard!');
  };

  return (
    <div>
      {error && <div className="bg-rose-50 text-rose-800 p-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-emerald-50 text-emerald-800 p-3 rounded mb-4">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Replace Timetable</h3>
          <form onSubmit={handleReplaceTimetable} className="space-y-3">
            {/* Semester & Section (unchanged) */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Semester</label>
              <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {['1st','2nd','3rd','4th','5th','6th','7th','8th'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Section</label>
              <select value={section} onChange={(e) => setSection(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {['A','B','C','D'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Manual entries (unchanged) */}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {entries.map((entry, idx) => (
                <div key={idx} className="border p-2 rounded-lg bg-slate-50 space-y-1">
                  <select value={entry.day} onChange={(e) => handleEntryChange(idx, 'day', e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <div className="flex gap-1">
                    <input type="time" value={entry.startTime} onChange={(e) => handleEntryChange(idx, 'startTime', e.target.value)} className="w-1/2 border border-slate-300 rounded px-2 py-1 text-sm" />
                    <input type="time" value={entry.endTime} onChange={(e) => handleEntryChange(idx, 'endTime', e.target.value)} className="w-1/2 border border-slate-300 rounded px-2 py-1 text-sm" />
                  </div>
                  <input type="text" placeholder="Subject" value={entry.subject} onChange={(e) => handleEntryChange(idx, 'subject', e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                  <select value={entry.roomId} onChange={(e) => handleEntryChange(idx, 'roomId', e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                    <option value="">Select Room</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.roomNumber})</option>)}
                  </select>
                  <input type="text" placeholder="Class Group (e.g. CS-3A)" value={entry.classGroup} onChange={(e) => handleEntryChange(idx, 'classGroup', e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                  <input type="text" placeholder="Faculty Name" value={entry.faculty} onChange={(e) => handleEntryChange(idx, 'faculty', e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                  <button type="button" onClick={() => handleRemoveEntry(idx)} className="text-rose-600 text-sm">Remove</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={handleAddEntry} className="w-full bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-semibold hover:bg-slate-300">
              + Add Entry
            </button>
            <button type="submit" disabled={loading || entries.length === 0} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Replacing...' : 'Replace Timetable'}
            </button>
          </form>

          {/* ---------- NEW: Room Selection & Template Download ---------- */}
          <div className="mt-6 border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Generate CSV Template</h4>
            {loadingRooms ? (
              <p className="text-sm text-slate-500">Loading rooms...</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
                  {rooms.map(room => (
                    <label key={room.id} className="inline-flex items-center gap-1.5 text-sm bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 hover:border-indigo-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRoomIds.includes(room.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoomIds([...selectedRoomIds, room.id]);
                          } else {
                            setSelectedRoomIds(selectedRoomIds.filter(id => id !== room.id));
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      {room.name}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </button>
                  <button
                    onClick={copyRoomNames}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-300"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Names
                  </button>
                  <button
                    onClick={() => setSelectedRoomIds(rooms.map(r => r.id))}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedRoomIds([])}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  <strong>Tip:</strong> The template uses room <strong>names</strong> in the <code>RoomId</code> column – these are accepted by the server.
                </p>
              </>
            )}
          </div>

          {/* File upload section (unchanged) */}
          <div className="mt-6 border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Or upload Excel/CSV</h4>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={uploading}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <p className="text-xs text-slate-400 mt-1">Expected columns: Day, Start Time, End Time, Subject, RoomId, Class Group, Faculty</p>
          </div>
        </div>

        {/* Timetable display (unchanged) */}
        <div className="lg:col-span-2">
          <h4 className="text-lg font-semibold mb-2">Current Timetable - {semester} {section}</h4>
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-2 text-sm font-semibold">Day</th>
                  <th className="text-left p-2 text-sm font-semibold">Time</th>
                  <th className="text-left p-2 text-sm font-semibold">Subject</th>
                  <th className="text-left p-2 text-sm font-semibold">Room</th>
                  <th className="text-left p-2 text-sm font-semibold">Class Group</th>
                  <th className="text-left p-2 text-sm font-semibold">Faculty</th>
                  <th className="text-left p-2 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {timetable.map((entry) => (
                  <tr key={entry.id} className="border-t">
                    <td className="p-2 text-sm">{entry.day}</td>
                    <td className="p-2 text-sm">{entry.startTime} - {entry.endTime}</td>
                    <td className="p-2 text-sm">{entry.subject}</td>
                    <td className="p-2 text-sm">{entry.roomId?.name}</td>
                    <td className="p-2 text-sm">{entry.classGroup}</td>
                    <td className="p-2 text-sm">{entry.faculty}</td>
                    <td className="p-2 text-sm space-x-1">
                      <button onClick={() => setEditingEntry(entry)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
                      <button onClick={() => handleDeleteEntry(entry.id)} className="text-rose-600 hover:text-rose-800 text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingEntry && (
            <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h4 className="text-lg font-semibold mb-2">Edit Entry</h4>
              <div className="grid grid-cols-2 gap-2">
                <input type="time" value={editingEntry.startTime} onChange={(e) => setEditingEntry({...editingEntry, startTime: e.target.value})} className="border border-slate-300 rounded px-2 py-1 text-sm" />
                <input type="time" value={editingEntry.endTime} onChange={(e) => setEditingEntry({...editingEntry, endTime: e.target.value})} className="border border-slate-300 rounded px-2 py-1 text-sm" />
                <input type="text" value={editingEntry.subject} onChange={(e) => setEditingEntry({...editingEntry, subject: e.target.value})} placeholder="Subject" className="border border-slate-300 rounded px-2 py-1 text-sm" />
                <select value={editingEntry.roomId?._id || editingEntry.roomId} onChange={(e) => setEditingEntry({...editingEntry, roomId: e.target.value})} className="border border-slate-300 rounded px-2 py-1 text-sm">
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <input type="text" value={editingEntry.classGroup} onChange={(e) => setEditingEntry({...editingEntry, classGroup: e.target.value})} placeholder="Class Group" className="border border-slate-300 rounded px-2 py-1 text-sm" />
                <input type="text" value={editingEntry.faculty} onChange={(e) => setEditingEntry({...editingEntry, faculty: e.target.value})} placeholder="Faculty" className="border border-slate-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => handleUpdateEntry(editingEntry.id, editingEntry)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700">Save</button>
                <button onClick={() => setEditingEntry(null)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-300">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}