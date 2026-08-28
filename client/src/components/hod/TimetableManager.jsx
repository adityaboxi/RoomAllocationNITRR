import React, { useState, useEffect, useRef } from 'react';
import {
  getRooms,
  getTimetable,
  updateTimetableEntry,
  deleteTimetableEntry,
} from '../../services/api';
import {
  Calendar,
  Download,
  Upload,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Building2,
  FileSpreadsheet,
  RefreshCw,
  X,
  FileText,
  HelpCircle,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper to validate 24-hour HH:mm time
const isValidTimeFormat = (time) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);

// Helper to convert HH:mm to minutes
const toMinutes = (timeStr) => {
  const [h, m] = String(timeStr).trim().split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Helper to check if two time ranges overlap
const isOverlapping = (s1, e1, s2, e2) => {
  return toMinutes(s1) < toMinutes(e2) && toMinutes(s2) < toMinutes(e1);
};

export default function TimetableManager({ user }) {
  const [rooms, setRooms] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  // File Upload State
  const [uploadSemester, setUploadSemester] = useState('5th');
  const [uploadSection, setUploadSection] = useState('A');
  const [uploadRoomId, setUploadRoomId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Schedule Multi-Criteria View Filters
  const [filterSemester, setFilterSemester] = useState('ALL');
  const [filterRoomId, setFilterRoomId] = useState('ALL');
  const [filterDay, setFilterDay] = useState('ALL');

  const [editingEntry, setEditingEntry] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fileInputRef = useRef(null);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchRooms();
  }, [user?.department]);

  useEffect(() => {
    fetchScheduleTable();
  }, [filterSemester, filterRoomId, filterDay, user?.department]);

  const fetchRooms = async () => {
    try {
      const data = await getRooms({ department: user?.department });
      const roomList = data.data || [];
      setRooms(roomList);
      if (roomList.length > 0 && !uploadRoomId) {
        setUploadRoomId(roomList[0].id || roomList[0]._id);
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

  // ----- Client-Side CSV Pre-Verification -----
  const verifyCSVContent = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split(/\r\n|\n/).filter((l) => l.trim() !== '');

          if (lines.length <= 1) {
            return reject(new Error('The spreadsheet file is empty or has no data rows.'));
          }

          const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s_-]/g, ''));
          const required = ['day', 'starttime', 'endtime', 'subject', 'faculty'];
          const missing = required.filter((r) => !headers.includes(r));

          if (missing.length > 0) {
            return reject(new Error(`Wrong format: Missing required columns [${missing.join(', ')}].\nExpected Header: Day, Start Time, End Time, Subject, Class Group, Faculty`));
          }

          const dayIdx = headers.indexOf('day');
          const startIdx = headers.indexOf('starttime');
          const endIdx = headers.indexOf('endtime');
          const subjIdx = headers.indexOf('subject');
          const facultyIdx = headers.indexOf('faculty');

          const parsedRows = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim());
            if (cols.length < 5) continue;

            const day = cols[dayIdx];
            const startTime = cols[startIdx];
            const endTime = cols[endIdx];
            const subject = cols[subjIdx];
            const faculty = cols[facultyIdx];

            if (!days.includes(day)) {
              return reject(new Error(`Row #${i}: Invalid Day "${day}". Must be one of ${days.join(', ')}.`));
            }
            if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
              return reject(new Error(`Row #${i} ("${subject}"): Invalid time format (${startTime} - ${endTime}). Must be 24-hour HH:mm.`));
            }
            if (toMinutes(startTime) >= toMinutes(endTime)) {
              return reject(new Error(`Row #${i} ("${subject}"): Start time (${startTime}) must be strictly before End time (${endTime}).`));
            }
            if (toMinutes(endTime) - toMinutes(startTime) < 30) {
              return reject(new Error(`Row #${i} ("${subject}"): Class duration must be at least 30 minutes.`));
            }

            parsedRows.push({ rowNumber: i, day, startTime, endTime, subject, faculty });
          }

          // Check for collision between rows in the uploaded file
          for (let i = 0; i < parsedRows.length; i++) {
            for (let j = i + 1; j < parsedRows.length; j++) {
              const a = parsedRows[i];
              const b = parsedRows[j];

              if (a.day === b.day && isOverlapping(a.startTime, a.endTime, b.startTime, b.endTime)) {
                return reject(
                  new Error(
                    `🚫 Timetable Collision in File:\n• Row #${a.rowNumber}: "${a.subject}" (${a.startTime} - ${a.endTime})\n• Row #${b.rowNumber}: "${b.subject}" (${b.startTime} - ${b.endTime})\nBoth classes are scheduled at overlapping times on ${a.day}.`
                  )
                );
              }
            }
          }

          resolve(true);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  };

  // ----- File Staging & Upload -----
  const handleFileSelect = async (e) => {
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
      setError(`Invalid format (${ext}). Only .csv, .xlsx, and .xls spreadsheets are permitted.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Client-side verification for CSV files
    if (ext === '.csv') {
      try {
        await verifyCSVContent(file);
      } catch (validationErr) {
        setError(validationErr.message);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setSelectedFile(file);
  };

  const handleSubmitFile = async () => {
    if (!selectedFile) {
      setError('Please choose a valid spreadsheet file first.');
      return;
    }
    if (!uploadRoomId) {
      setError('Please select a Target Room from the dropdown.');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('semester', uploadSemester);
    formData.append('section', uploadSection);
    formData.append('roomId', uploadRoomId);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/timetable/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'File upload failed.');
      }

      setSuccess(data.message || 'Timetable published successfully!');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setFilterSemester('ALL');
      setFilterRoomId(uploadRoomId);
      await fetchScheduleTable();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ----- Enhanced Download Template Function -----
  const downloadTemplate = () => {
    const group = `${uploadSemester} Sec ${uploadSection}`;
    const sampleRows = [
      `Monday,09:00,09:50,Database Management Systems,${group},Dr. A. Sharma`,
      `Monday,09:50,10:40,Algorithms & Data Structures,${group},Prof. R. Patel`,
      `Monday,10:40,11:30,Software Engineering,${group},Dr. S. Kumar`,
      `Tuesday,09:00,09:50,Database Management Systems,${group},Dr. A. Sharma`,
      `Tuesday,09:50,10:40,Software Engineering,${group},Dr. S. Kumar`,
      `Tuesday,10:40,11:30,Algorithms & Data Structures,${group},Prof. R. Patel`,
      `Wednesday,10:40,11:30,Algorithms & Data Structures,${group},Prof. R. Patel`,
      `Wednesday,11:30,12:20,Natural Language Processing,${group},Dr. N. Verma`,
      `Wednesday,12:20,13:10,Software Engineering,${group},Dr. S. Kumar`,
      `Wednesday,14:10,15:50,Data Science Lab,${group},Prof. M. Gupta`,
      `Thursday,09:00,10:40,Database Management Systems Lab,${group},Dr. A. Sharma`,
      `Thursday,10:40,12:20,Natural Language Processing,${group},Dr. N. Verma`,
      `Thursday,12:20,13:10,Software Engineering,${group},Dr. S. Kumar`,
      `Thursday,14:10,15:50,Computing Algorithms & IKS,${group},Prof. M. Gupta`,
      `Friday,09:00,10:40,Web Technologies Lab,${group},Prof. K. Singh`,
      `Friday,11:30,13:10,Summer Internship Mentorship,${group},Prof. Faculty Mentor`,
      `Saturday,10:00,12:00,Remedial & Project Guidance,${group},Department Faculty`,
    ];

    const csvContent = 'Day,Start Time,End Time,Subject,Class Group,Faculty\n' + sampleRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NITRR_Timetable_Template_${uploadSemester}_Sec${uploadSection}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ----- Single Slot Update & Delete -----
  const handleUpdateEntry = async (entryId, updatedData) => {
    if (!updatedData.startTime || !updatedData.endTime || !updatedData.subject || !updatedData.faculty) {
      setError('Start Time, End Time, Subject, and Faculty are all required.');
      return;
    }

    if (toMinutes(updatedData.startTime) >= toMinutes(updatedData.endTime)) {
      setError('Start time must be strictly before end time.');
      return;
    }

    if (toMinutes(updatedData.endTime) - toMinutes(updatedData.startTime) < 30) {
      setError('Class duration must be at least 30 minutes.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const cleanRoomId =
        updatedData.roomId && typeof updatedData.roomId === 'object'
          ? updatedData.roomId._id || updatedData.roomId.id
          : updatedData.roomId;

      await updateTimetableEntry(entryId, { ...updatedData, roomId: cleanRoomId });
      setSuccess('Timetable entry updated successfully.');
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

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start text-rose-800 text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 mr-2.5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 whitespace-pre-line font-medium">{error}</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dedicated CSV / Excel Upload Card & Template Section */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Upload Room Timetable</h3>
                <p className="text-xs text-slate-400">Department of {user?.department}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* 1. Target Room */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  1. Select Classroom / Lab *
                </label>
                <select
                  value={uploadRoomId}
                  onChange={(e) => setUploadRoomId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition-all"
                >
                  {rooms.map((r) => (
                    <option key={r.id || r._id} value={r.id || r._id}>
                      {r.name} — {r.roomNumber} ({r.floor}, {r.building})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Target Semester & Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    2. Semester *
                  </label>
                  <select
                    value={uploadSemester}
                    onChange={(e) => setUploadSemester(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-slate-50/50 font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600"
                  >
                    {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => (
                      <option key={s} value={s}>{s} Semester</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    3. Section *
                  </label>
                  <select
                    value={uploadSection}
                    onChange={(e) => setUploadSection(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-slate-50/50 font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600"
                  >
                    {['A', 'B', 'C', 'D'].map((sec) => (
                      <option key={sec} value={sec}>Section {sec}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Enhanced Download Template Banner */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Download Pre-Formatted Template</span>
                  </div>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.CSV Template</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 leading-relaxed">
                  Generates an editable spreadsheet pre-filled for <strong className="text-slate-700">{uploadSemester} Sem Sec {uploadSection}</strong> (Monday–Sunday slots in 24h format).
                </div>
              </div>

              {/* 4. File Input */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  4. Select Spreadsheet File (.csv, .xlsx, .xls) *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-xl p-1 bg-slate-50/50"
                />
              </div>

              {/* Staged File Card with Submit Button */}
              {selectedFile && (
                <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs text-indigo-950 font-medium">
                    <span className="truncate pr-2 font-semibold">
                      📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                    >
                      Remove
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmitFile}
                    disabled={uploading}
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? 'Validating & Publishing...' : 'Upload & Publish Timetable'}</span>
                  </button>
                </div>
              )}
            </div>
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
                    Published Schedule ({timetable.length} Active Slots)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={fetchScheduleTable}
                  className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
                  title="Refresh Schedule"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* View Filters */}
              <div className="grid grid-cols-3 gap-2 pt-1">
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
                <p className="text-xs text-slate-400 mt-1">Select "All Rooms" or "All Semesters" to see all classes.</p>
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
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Room</label>
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