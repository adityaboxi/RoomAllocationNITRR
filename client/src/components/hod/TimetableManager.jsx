import React, { useState, useEffect, useRef } from 'react';
import {
  getRooms,
  getTimetable,
  replaceTimetable,
  updateRoomDayTimetable,
  updateTimetableEntry,
  deleteTimetableEntry,
  getTimetableByRoom,
} from '../../services/api';
import {
  Calendar,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Building2,
  Sparkles,
  FileSpreadsheet,
  Layers,
  Filter,
  X,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function TimetableManager({ user }) {
  const [managerMode, setManagerMode] = useState('semester'); // 'semester' | 'roomDay'
  const [rooms, setRooms] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Manual Semester Form State
  const [semester, setSemester] = useState('5th');
  const [section, setSection] = useState('A');
  const [entries, setEntries] = useState([]);

  // File Upload Specific Target State
  const [uploadSemester, setUploadSemester] = useState('5th');
  const [uploadSection, setUploadSection] = useState('A');
  const [selectedFile, setSelectedFile] = useState(null);

  // Room-Day Mode State (Strict Single Room Selection)
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [roomDayEntries, setRoomDayEntries] = useState([]);

  // Right-side Table View Filter
  const [filterSemester, setFilterSemester] = useState('ALL');
  const [filterRoomId, setFilterRoomId] = useState('ALL');
  const [filterDay, setFilterDay] = useState('ALL');

  const [editingEntry, setEditingEntry] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fileInputRef = useRef(null);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    fetchRooms();
  }, [user?.department]);

  useEffect(() => {
    fetchScheduleTable();
  }, [filterSemester, filterRoomId, filterDay, user?.department]);

  useEffect(() => {
    if (managerMode === 'roomDay' && selectedRoomId) {
      fetchRoomDayTimetable();
    }
  }, [managerMode, selectedRoomId, selectedDay]);

  const fetchRooms = async () => {
    try {
      const data = await getRooms({ department: user?.department });
      const roomList = data.data || [];
      setRooms(roomList);
      if (roomList.length > 0 && !selectedRoomId) {
        setSelectedRoomId(roomList[0].id || roomList[0]._id);
      }
    } catch (err) {
      console.error('Fetch rooms error:', err);
    }
  };

  const fetchScheduleTable = async () => {
    setTableLoading(true);
    try {
      const params = { department: user?.department };
      if (filterSemester !== 'ALL') params.semester = filterSemester;
      if (filterRoomId !== 'ALL') params.roomId = filterRoomId;
      if (filterDay !== 'ALL') params.day = filterDay;

      const data = await getTimetable(params);
      setTimetable(data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load timetable');
    } finally {
      setTableLoading(false);
    }
  };

  const fetchRoomDayTimetable = async () => {
    if (!selectedRoomId) return;
    try {
      const data = await getTimetableByRoom(selectedRoomId, { day: selectedDay });
      const list = data.data || [];
      setRoomDayEntries(
        list.map((e) => ({
          startTime: e.startTime,
          endTime: e.endTime,
          subject: e.subject,
          faculty: e.faculty,
          semester: e.semester,
          section: e.section,
          classGroup: e.classGroup,
        }))
      );
    } catch (err) {
      console.error('Failed to load room schedule:', err);
    }
  };

  // ----- Semester Mode Handlers -----
  const handleAddSemesterEntry = () => {
    const defaultRoomId = rooms.length > 0 ? (rooms[0].id || rooms[0]._id) : '';
    setEntries((prev) => [
      ...prev,
      {
        day: 'Monday',
        startTime: '09:00',
        endTime: '09:50',
        subject: '',
        roomId: defaultRoomId,
        classGroup: `${semester} Sec ${section}`,
        faculty: '',
      },
    ]);
  };

  const handleSemesterEntryChange = (index, field, value) => {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setError('');
  };

  const handleRemoveSemesterEntry = (index) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveSemesterTimetable = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!semester || !section || entries.length === 0) {
      setError('Please add at least one timetable entry before publishing.');
      return;
    }

    setLoading(true);
    try {
      await replaceTimetable({
        department: user?.department,
        semester,
        section,
        entries,
      });

      setSuccess(`Master Timetable for ${semester} Sec ${section} published successfully!`);
      setEntries([]);
      setFilterSemester(semester);
      await fetchScheduleTable();
    } catch (err) {
      setError(err.message || 'Failed to save timetable');
    } finally {
      setLoading(false);
    }
  };

  // ----- Room-Day Mode Handlers -----
  const handleAddRoomDaySlot = () => {
    setRoomDayEntries((prev) => [
      ...prev,
      {
        startTime: '09:00',
        endTime: '09:50',
        subject: '',
        faculty: '',
        semester: '5th',
        section: 'A',
        classGroup: '5th Sec A',
      },
    ]);
  };

  const handleRoomDaySlotChange = (index, field, value) => {
    setRoomDayEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'semester' || field === 'section') {
        const sem = field === 'semester' ? value : updated[index].semester;
        const sec = field === 'section' ? value : updated[index].section;
        updated[index].classGroup = `${sem} Sec ${sec}`;
      }
      return updated;
    });
    setError('');
  };

  const handleRemoveRoomDaySlot = (index) => {
    setRoomDayEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveRoomDayTimetable = async (e) => {
    e.preventDefault();
    if (!selectedRoomId || !selectedDay) {
      setError('Please select a specific room and day.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await updateRoomDayTimetable({
        roomId: selectedRoomId,
        day: selectedDay,
        entries: roomDayEntries,
      });

      const selectedRoomObj = rooms.find((r) => (r.id || r._id) === selectedRoomId);
      setSuccess(`Schedule for ${selectedRoomObj?.name || 'Room'} on ${selectedDay} updated!`);
      setFilterRoomId(selectedRoomId);
      await fetchScheduleTable();
    } catch (err) {
      setError(err.message || 'Failed to save room day schedule');
    } finally {
      setLoading(false);
    }
  };

  // ----- File Staging & Upload -----
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    setError('');
    setSuccess('');

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(ext)) {
      setError(`Invalid format (${ext}). Only .csv and .xlsx spreadsheets are permitted.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmitFile = async () => {
    if (!selectedFile) {
      setError('Please choose a valid spreadsheet file first.');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('semester', uploadSemester);
    formData.append('section', uploadSection);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/timetable/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'File validation failed.');
      }

      setSuccess(data.message || 'Timetable spreadsheet processed and published!');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Auto-set view filter to show all schedule
      setFilterSemester('ALL');
      setFilterRoomId('ALL');
      await fetchScheduleTable();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ----- Single Slot Update & Delete -----
  const handleUpdateEntry = async (entryId, updatedData) => {
    setLoading(true);
    try {
      const cleanRoomId =
        updatedData.roomId && typeof updatedData.roomId === 'object'
          ? updatedData.roomId._id || updatedData.roomId.id
          : updatedData.roomId;

      await updateTimetableEntry(entryId, { ...updatedData, roomId: cleanRoomId });
      setSuccess('Timetable entry modified.');
      setEditingEntry(null);
      await fetchScheduleTable();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this schedule slot?')) return;
    try {
      await deleteTimetableEntry(entryId);
      setSuccess('Slot removed from timetable.');
      await fetchScheduleTable();
    } catch (err) {
      setError(err.message);
    }
  };

  const downloadTemplate = () => {
    const selectedRoomObj = rooms.find((r) => (r.id || r._id) === selectedRoomId) || rooms[0];
    const roomIdentifier = selectedRoomObj ? selectedRoomObj.name : 'F-42';

    let csv = 'Day,Start Time,End Time,Subject,RoomId,Class Group,Faculty\n';
    days.forEach((day, idx) => {
      csv += `${day},09:00,09:50,Core Subject ${idx + 1},${roomIdentifier},${uploadSemester} Sec ${uploadSection},Prof. Faculty Name\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NITRR_Timetable_Template_${uploadSemester}_Sec${uploadSection}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start text-rose-800 text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 mr-2.5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 whitespace-pre-line">{error}</div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start text-emerald-800 text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 mr-2.5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{success}</div>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl max-w-md">
        <button
          type="button"
          onClick={() => setManagerMode('semester')}
          className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            managerMode === 'semester'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-indigo-600" />
          <span>Semester Timetable</span>
        </button>

        <button
          type="button"
          onClick={() => setManagerMode('roomDay')}
          className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            managerMode === 'roomDay'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-600" />
          <span>Single Room & Day View</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Editor & Upload Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
            {managerMode === 'semester' ? (
              // ----- SEMESTER MODE -----
              <>
                <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Manage Semester Timetable</h3>
                    <p className="text-xs text-slate-400">Department of {user?.department}</p>
                  </div>
                </div>

                {/* Spreadsheet Upload Box with Target Semester & Section */}
                <div className="mb-6 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                      <span>Upload Timetable File (CSV / Excel)</span>
                    </h4>
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Template
                    </button>
                  </div>

                  {/* Target Class Selection for Upload */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Target Semester</label>
                      <select
                        value={uploadSemester}
                        onChange={(e) => setUploadSemester(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
                      >
                        {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => (
                          <option key={s} value={s}>{s} Semester</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Target Section</label>
                      <select
                        value={uploadSection}
                        onChange={(e) => setUploadSection(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
                      >
                        {['A', 'B', 'C', 'D'].map((sec) => (
                          <option key={sec} value={sec}>Section {sec}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                  />

                  {selectedFile && (
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-indigo-200 animate-fadeIn">
                      <div className="text-xs text-slate-700 truncate pr-2">
                        <strong>Ready:</strong> {selectedFile.name}
                      </div>
                      <button
                        type="button"
                        onClick={handleSubmitFile}
                        disabled={uploading}
                        className="bg-indigo-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-1 flex-shrink-0 shadow-sm"
                      >
                        <Upload className="w-3 h-3" />
                        <span>{uploading ? 'Processing...' : 'Submit File'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Manual Add Slots */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                      <select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/50 outline-none"
                      >
                        {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => (
                          <option key={s} value={s}>{s} Semester</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
                      <select
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50/50 outline-none"
                      >
                        {['A', 'B', 'C', 'D'].map((sec) => (
                          <option key={sec} value={sec}>Section {sec}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <form onSubmit={handleSaveSemesterTimetable} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Manual Slots ({entries.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleAddSemesterEntry}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Class Slot
                      </button>
                    </div>

                    {entries.length === 0 ? (
                      <div className="p-3 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 bg-slate-50/50">
                        Upload CSV above or click <strong>+ Add Class Slot</strong>.
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                        {entries.map((entry, idx) => (
                          <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 relative">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-500">Slot #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSemesterEntry(idx)}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <select
                                value={entry.day}
                                onChange={(e) => handleSemesterEntryChange(idx, 'day', e.target.value)}
                                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                              >
                                {days.map((d) => <option key={d} value={d}>{d}</option>)}
                              </select>
                              <input
                                type="time"
                                value={entry.startTime}
                                onChange={(e) => handleSemesterEntryChange(idx, 'startTime', e.target.value)}
                                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                                required
                              />
                              <input
                                type="time"
                                value={entry.endTime}
                                onChange={(e) => handleSemesterEntryChange(idx, 'endTime', e.target.value)}
                                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                                required
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Subject"
                                value={entry.subject}
                                onChange={(e) => handleSemesterEntryChange(idx, 'subject', e.target.value)}
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                                required
                              />
                              <select
                                value={entry.roomId}
                                onChange={(e) => handleSemesterEntryChange(idx, 'roomId', e.target.value)}
                                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white"
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
                                placeholder="Class Group"
                                value={entry.classGroup}
                                onChange={(e) => handleSemesterEntryChange(idx, 'classGroup', e.target.value)}
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                                required
                              />
                              <input
                                type="text"
                                placeholder="Faculty Name"
                                value={entry.faculty}
                                onChange={(e) => handleSemesterEntryChange(idx, 'faculty', e.target.value)}
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
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
                      className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50 shadow-sm"
                    >
                      {loading ? 'Publishing...' : `Publish Master Timetable (${semester} Sec ${section})`}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              // ----- SINGLE ROOM & DAY VIEW -----
              <>
                <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Single Room Schedule</h3>
                    <p className="text-xs text-slate-400">Configure schedule for one room</p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Choose Room *
                    </label>
                    <select
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm bg-slate-50/50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 font-semibold text-slate-900"
                    >
                      {rooms.map((r) => (
                        <option key={r.id || r._id} value={r.id || r._id}>
                          {r.name} — {r.roomNumber} ({r.floor}, {r.building})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Choose Day of Week *
                    </label>
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-slate-50/50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 font-semibold text-slate-900"
                    >
                      {days.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <form onSubmit={handleSaveRoomDayTimetable} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Day Slots ({roomDayEntries.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddRoomDaySlot}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Slot
                    </button>
                  </div>

                  {roomDayEntries.length === 0 ? (
                    <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 bg-slate-50/50">
                      No classes scheduled for this room on {selectedDay}.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                      {roomDayEntries.map((slot, idx) => (
                        <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 relative">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500">Slot #{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveRoomDaySlot(idx)}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => handleRoomDaySlotChange(idx, 'startTime', e.target.value)}
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                              required
                            />
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => handleRoomDaySlotChange(idx, 'endTime', e.target.value)}
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Subject"
                              value={slot.subject}
                              onChange={(e) => handleRoomDaySlotChange(idx, 'subject', e.target.value)}
                              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                              required
                            />
                            <input
                              type="text"
                              placeholder="Faculty"
                              value={slot.faculty}
                              onChange={(e) => handleRoomDaySlotChange(idx, 'faculty', e.target.value)}
                              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={slot.semester}
                              onChange={(e) => handleRoomDaySlotChange(idx, 'semester', e.target.value)}
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                            >
                              {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => (
                                <option key={s} value={s}>{s} Sem</option>
                              ))}
                            </select>
                            <select
                              value={slot.section}
                              onChange={(e) => handleRoomDaySlotChange(idx, 'section', e.target.value)}
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                            >
                              {['A', 'B', 'C', 'D'].map((sec) => (
                                <option key={sec} value={sec}>Sec {sec}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-sm"
                  >
                    {loading ? 'Saving...' : `Save ${selectedDay} Schedule`}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Published Timetable Table with View Filters */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {/* Filter Bar Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Published Timetable ({timetable.length} Active Slots)
                  </h3>
                </div>
              </div>

              {/* Multi-Criteria View Filters */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Semester
                  </label>
                  <select
                    value={filterSemester}
                    onChange={(e) => setFilterSemester(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white font-medium outline-none"
                  >
                    <option value="ALL">All Semesters</option>
                    {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => (
                      <option key={s} value={s}>{s} Sem</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Room
                  </label>
                  <select
                    value={filterRoomId}
                    onChange={(e) => setFilterRoomId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white font-medium outline-none"
                  >
                    <option value="ALL">All Rooms</option>
                    {rooms.map((r) => (
                      <option key={r.id || r._id} value={r.id || r._id}>
                        {r.name} ({r.roomNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Day
                  </label>
                  <select
                    value={filterDay}
                    onChange={(e) => setFilterDay(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white font-medium outline-none"
                  >
                    <option value="ALL">All Days</option>
                    {days.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {tableLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Loading timetable slots...</div>
            ) : timetable.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium">No published slots match your filter selection.</p>
                <p className="text-xs text-slate-400 mt-1">Select "All Semesters" or "All Rooms" to see full schedule.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
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
                              <span>{entry.startTime} - {entry.endTime}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">
                            {entry.subject}
                          </td>

                          <td className="px-4 py-3.5 text-sm">
                            <div className="font-medium text-indigo-900 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                              <span>{entry.roomId?.name || 'Room'}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {entry.roomId?.roomNumber || ''}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-sm">
                            <div className="text-slate-800 font-medium">{entry.faculty}</div>
                            <div className="text-[11px] text-slate-400">{entry.classGroup}</div>
                          </td>

                          <td className="px-4 py-3.5 text-sm text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setEditingEntry({
                                ...entry,
                                id: entryId,
                                roomId: entry.roomId?._id || entry.roomId?.id || entry.roomId,
                              })}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit Entry"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
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

          {/* Inline Edit Form */}
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
                    onChange={(e) => setEditingEntry({ ...editingEntry, startTime: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">End Time</label>
                  <input
                    type="time"
                    value={editingEntry.endTime}
                    onChange={(e) => setEditingEntry({ ...editingEntry, endTime: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Room (Single Room)</label>
                  <select
                    value={
                      editingEntry.roomId && typeof editingEntry.roomId === 'object'
                        ? editingEntry.roomId._id || editingEntry.roomId.id
                        : editingEntry.roomId
                    }
                    onChange={(e) => setEditingEntry({ ...editingEntry, roomId: e.target.value })}
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
                    onChange={(e) => setEditingEntry({ ...editingEntry, subject: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Class Group</label>
                  <input
                    type="text"
                    value={editingEntry.classGroup}
                    onChange={(e) => setEditingEntry({ ...editingEntry, classGroup: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Faculty</label>
                  <input
                    type="text"
                    value={editingEntry.faculty}
                    onChange={(e) => setEditingEntry({ ...editingEntry, faculty: e.target.value })}
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