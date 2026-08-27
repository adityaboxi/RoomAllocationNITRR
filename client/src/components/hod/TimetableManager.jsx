import React, { useState, useEffect, useRef } from 'react';
import {
  getRooms,
  getTimetable,
  replaceTimetable,
  updateTimetableEntry,
  deleteTimetableEntry,
} from '../../services/api';
import {
  Calendar,
  Download,
  Copy,
  Upload,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  UserCheck,
  Building,
  Sparkles,
  X,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function TimetableManager({ user }) {
  const [rooms, setRooms] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [semester, setSemester] = useState('1st');
  const [section, setSection] = useState('A');
  const [entries, setEntries] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const fileInputRef = useRef(null);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    fetchRooms();
  }, [user?.department]);

  useEffect(() => {
    fetchTimetable();
  }, [semester, section, user?.department]);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const data = await getRooms({ department: user?.department });
      const roomList = data.data || [];
      setRooms(roomList);
      // Select all department rooms by default for CSV template generator
      setSelectedRoomIds(roomList.map((r) => r.id || r._id));
    } catch (err) {
      console.error('Fetch rooms error:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchTimetable = async () => {
    setTableLoading(true);
    setError('');
    try {
      const data = await getTimetable({
        department: user?.department,
        semester,
        section,
      });
      setTimetable(data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load timetable for selected semester/section');
    } finally {
      setTableLoading(false);
    }
  };

  // ----- Manual Entries Management -----
  const handleAddEntry = () => {
    const defaultRoomId = rooms.length > 0 ? (rooms[0].id || rooms[0]._id) : '';
    setEntries((prev) => [
      ...prev,
      {
        day: 'Monday',
        startTime: '09:00',
        endTime: '10:00',
        subject: '',
        roomId: defaultRoomId,
        classGroup: `${semester} Sec ${section}`,
        faculty: '',
      },
    ]);
  };

  const handleEntryChange = (index, field, value) => {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setError('');
  };

  const handleRemoveEntry = (index) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReplaceTimetable = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!semester || !section || entries.length === 0) {
      setError('Please provide a semester, section, and at least one timetable entry.');
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      if (
        !item.day ||
        !item.startTime ||
        !item.endTime ||
        !item.subject.trim() ||
        !item.roomId ||
        !item.classGroup.trim() ||
        !item.faculty.trim()
      ) {
        setError(`Entry #${i + 1}: All fields are required.`);
        return;
      }

      if (item.startTime >= item.endTime) {
        setError(`Entry #${i + 1}: Start time (${item.startTime}) must be before end time (${item.endTime}).`);
        return;
      }

      const [sH, sM] = item.startTime.split(':').map(Number);
      const [eH, eM] = item.endTime.split(':').map(Number);
      const duration = (eH * 60 + eM) - (sH * 60 + sM);
      if (duration < 30) {
        setError(`Entry #${i + 1}: Class slot must be at least 30 minutes long.`);
        return;
      }
    }

    setLoading(true);
    try {
      const data = await replaceTimetable({
        department: user?.department,
        semester,
        section,
        entries,
      });

      const cancelledCount = data.data?.bookingsCancelled || 0;
      setSuccess(
        `Timetable for ${semester} Sec ${section} updated successfully! ${
          cancelledCount > 0 ? `(${cancelledCount} conflicting ad-hoc bookings cancelled).` : ''
        }`
      );
      setEntries([]);
      await fetchTimetable();
    } catch (err) {
      setError(err.message || 'Failed to replace timetable');
    } finally {
      setLoading(false);
    }
  };

  // ----- File Upload Handler -----
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('semester', semester);
    formData.append('section', section);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/timetable/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to parse and upload timetable file');
      }

      setSuccess(data.message || 'Timetable uploaded and synchronized successfully!');
      setEntries([]);
      await fetchTimetable();
    } catch (err) {
      setError(err.message || 'File upload error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ----- Update Single Entry -----
  const handleUpdateEntry = async (entryId, updatedData) => {
    setLoading(true);
    setError('');
    try {
      const cleanRoomId =
        updatedData.roomId && typeof updatedData.roomId === 'object'
          ? updatedData.roomId._id || updatedData.roomId.id
          : updatedData.roomId;

      await updateTimetableEntry(entryId, {
        ...updatedData,
        roomId: cleanRoomId,
      });

      setSuccess('Timetable entry updated successfully.');
      setEditingEntry(null);
      await fetchTimetable();
    } catch (err) {
      setError(err.message || 'Failed to update timetable entry');
    } finally {
      setLoading(false);
    }
  };

  // ----- Delete Single Entry -----
  const handleDeleteEntry = async (entryId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this timetable slot?');
    if (!confirmDelete) return;

    try {
      await deleteTimetableEntry(entryId);
      setSuccess('Timetable entry deleted.');
      await fetchTimetable();
    } catch (err) {
      setError(err.message || 'Failed to delete timetable entry');
    }
  };

  // ----- CSV Template Download -----
  const downloadTemplate = () => {
    if (selectedRoomIds.length === 0) {
      alert('Please select at least one room to include in the template.');
      return;
    }

    const selectedRooms = rooms.filter((r) =>
      selectedRoomIds.includes(r.id || r._id)
    );

    let csv = 'Day,Start Time,End Time,Subject,RoomId,Class Group,Faculty\n';
    selectedRooms.forEach((r, idx) => {
      csv += `${days[idx % 6]},09:00,10:00,Sample Subject,${r.name},${semester} Sec ${section},Dr. Faculty Name\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable_template_${user?.department}_${semester}_Sec${section}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ----- Copy Room Names to Clipboard -----
  const copyRoomNames = () => {
    const names = rooms
      .filter((r) => selectedRoomIds.includes(r.id || r._id))
      .map((r) => r.name)
      .join(', ');

    if (!names) {
      alert('No rooms selected.');
      return;
    }

    navigator.clipboard.writeText(names);
    alert('Room names copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start text-rose-800 text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 mr-2 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start text-emerald-800 text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{success}</div>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Management & Creation Panel */}
        <div className="lg:col-span-5 space-y-6">
          {/* Form Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Define Master Timetable</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                >
                  {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => (
                    <option key={s} value={s}>
                      {s} Semester
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Section
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                >
                  {['A', 'B', 'C', 'D'].map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Manual Entries List */}
            <form onSubmit={handleReplaceTimetable} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Manual Slots ({entries.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddEntry}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Slot
                </button>
              </div>

              {entries.length === 0 ? (
                <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 bg-slate-50/50">
                  No manual slots added yet. Click <strong>+ Add Slot</strong> or upload a CSV below.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                  {entries.map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500">Slot #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEntry(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={entry.day}
                          onChange={(e) => handleEntryChange(idx, 'day', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                          {days.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={entry.startTime}
                          onChange={(e) => handleEntryChange(idx, 'startTime', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                          required
                        />
                        <input
                          type="time"
                          value={entry.endTime}
                          onChange={(e) => handleEntryChange(idx, 'endTime', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Subject Name"
                          value={entry.subject}
                          onChange={(e) => handleEntryChange(idx, 'subject', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                          required
                        />
                        <select
                          value={entry.roomId}
                          onChange={(e) => handleEntryChange(idx, 'roomId', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                          required
                        >
                          <option value="">Select Room</option>
                          {rooms.map((r) => (
                            <option key={r.id || r._id} value={r.id || r._id}>
                              {r.name} ({r.roomNumber})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Class Group (e.g. CS-3A)"
                          value={entry.classGroup}
                          onChange={(e) => handleEntryChange(idx, 'classGroup', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Faculty Name"
                          value={entry.faculty}
                          onChange={(e) => handleEntryChange(idx, 'faculty', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || entries.length === 0}
                className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? 'Publishing...' : `Publish Master Timetable (${semester} Sec ${section})`}
              </button>
            </form>

            {/* Template Generation Section */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Generate Template File
              </h4>

              {loadingRooms ? (
                <p className="text-xs text-slate-400">Loading department rooms...</p>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-100">
                    {rooms.map((room) => {
                      const rId = room.id || room._id;
                      return (
                        <label
                          key={rId}
                          className="inline-flex items-center gap-1 text-[11px] bg-white px-2 py-1 rounded-md border border-slate-200 cursor-pointer hover:border-indigo-400"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRoomIds.includes(rId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRoomIds([...selectedRoomIds, rId]);
                              } else {
                                setSelectedRoomIds(selectedRoomIds.filter((id) => id !== rId));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                          />
                          <span className="truncate max-w-[120px]">{room.name}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download CSV Template
                    </button>
                    <button
                      type="button"
                      onClick={copyRoomNames}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Names
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Excel / CSV File Upload */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Import Spreadsheet
              </h4>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Columns: <code>Day, Start Time, End Time, Subject, RoomId, Class Group, Faculty</code>
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Published Timetable View */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-slate-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {user?.department} — {semester} Semester Sec {section} ({timetable.length} Slots)
                </h3>
              </div>
            </div>

            {tableLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Loading schedule...</div>
            ) : timetable.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium">No published timetable slots for this section.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Add slots manually or import an Excel/CSV spreadsheet to publish.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Day & Time
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Room
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Faculty / Group
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {timetable.map((entry) => {
                      const entryId = entry.id || entry._id;
                      return (
                        <tr key={entryId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5 text-sm">
                            <div className="font-bold text-slate-900">{entry.day}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 font-mono mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>
                                {entry.startTime} - {entry.endTime}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-sm">
                            <div className="font-semibold text-slate-800">{entry.subject}</div>
                          </td>

                          <td className="px-4 py-3.5 text-sm">
                            <div className="font-medium text-indigo-900 flex items-center gap-1">
                              <Building className="w-3.5 h-3.5 text-indigo-500" />
                              <span>{entry.roomId?.name || 'Classroom'}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {entry.roomId?.roomNumber || ''}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-sm">
                            <div className="text-slate-800 font-medium">{entry.faculty}</div>
                            <div className="text-[11px] text-slate-400">{entry.classGroup}</div>
                          </td>

                          <td className="px-4 py-3.5 text-sm text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setEditingEntry({
                                  ...entry,
                                  id: entryId,
                                  roomId: entry.roomId?._id || entry.roomId?.id || entry.roomId,
                                });
                              }}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit Entry"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteEntry(entryId)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Edit Entry Inline Modal/Form */}
          {editingEntry && (
            <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 shadow-lg animate-fadeIn">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-indigo-600" />
                  Edit Schedule Slot ({editingEntry.day})
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={editingEntry.startTime}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, startTime: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">End Time</label>
                  <input
                    type="time"
                    value={editingEntry.endTime}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, endTime: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Assigned Room</label>
                  <select
                    value={
                      editingEntry.roomId && typeof editingEntry.roomId === 'object'
                        ? editingEntry.roomId._id || editingEntry.roomId.id
                        : editingEntry.roomId
                    }
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, roomId: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    {rooms.map((r) => (
                      <option key={r.id || r._id} value={r.id || r._id}>
                        {r.name} ({r.roomNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Subject</label>
                  <input
                    type="text"
                    value={editingEntry.subject}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, subject: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Class Group</label>
                  <input
                    type="text"
                    value={editingEntry.classGroup}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, classGroup: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Faculty</label>
                  <input
                    type="text"
                    value={editingEntry.faculty}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, faculty: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="bg-slate-100 text-slate-700 px-4 py-1.5 rounded-xl text-xs font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateEntry(editingEntry.id, editingEntry)}
                  disabled={loading}
                  className="bg-indigo-600 text-white px-5 py-1.5 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}