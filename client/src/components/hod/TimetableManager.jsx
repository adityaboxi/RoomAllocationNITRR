import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const normalizeFloor = (floorVal) => {
  if (!floorVal) return '';
  const s = String(floorVal).trim().toLowerCase();
  if (s === '0' || s.startsWith('ground')) return 'Ground Floor';
  const m = s.match(/^(\d+)/);
  if (m) {
    if (m[1] === '1') return '1st Floor';
    if (m[1] === '2') return '2nd Floor';
    if (m[1] === '3') return '3rd Floor';
    return m[1] + 'th Floor';
  }
  return String(floorVal).trim();
};

import api, {
  getRooms,
  getTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
} from '../../services/api';
import { getSocket } from '../../services/socket';
import {
  Calendar,
  Download,
  Upload,
  Trash2,
  Edit2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Building2,
  FileSpreadsheet,
  RefreshCw,
  X,
  FileText,
  Loader2,
  Search,
  Filter,
  RotateCcw,
  LayoutGrid,
  List,
  Lock,
} from 'lucide-react';

// ============================================================================
// STRICT INSTITUTIONAL TIME GRID
// ============================================================================
const VALID_TIMETABLE_SLOTS = [
  '08:10-09:00',
  '09:00-09:50',
  '09:50-10:40',
  '10:40-11:30',
  '11:30-12:20',
  '12:20-13:10',
  '13:10-14:10', // LUNCH BREAK
  '14:10-15:00',
  '15:00-15:50',
  '15:50-16:40',
  '16:40-17:30',
  '17:30-18:20'
];

// Helper to safely extract error messages
const extractErrorMessage = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err.response?.data?.message || err.message || fallback;
};

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

export default function TimetableManager({ user, isAdmin = false }) {
  const [rooms, setRooms] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [departments, setDepartments] = useState([]); // for admin

  // File Upload State
  const [uploadSemester, setUploadSemester] = useState('5th');
  const [uploadSection, setUploadSection] = useState('A');
  const [uploadRoomId, setUploadRoomId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Schedule Multi-Criteria View Filters
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterRoomId, setFilterRoomId] = useState('ALL');
  const [filterDay, setFilterDay] = useState('ALL');
  const [filterSlot, setFilterSlot] = useState('ALL');
  const [viewMode, setViewMode] = useState('GRID');
  const [filterSearch, setFilterSearch] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Interactive Direct Slot Edit & Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('EDIT'); // 'EDIT' or 'CREATE'
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [slotFormData, setSlotFormData] = useState({
    id: '',
    roomId: '',
    day: 'Monday',
    timeSlot: '08:10-09:00',
    subject: '',
    faculty: '',
    facultyEmail: '',
    semester: '5th',
    section: 'A',
  });

  const fileInputRef = useRef(null);
  const reqSeqRef = useRef(0);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const getEffectiveDepartment = useCallback(() => {
    if (isAdmin) return filterDepartment;
    return user?.department;
  }, [isAdmin, filterDepartment, user?.department]);

  useEffect(() => {
    if (isAdmin) {
      api.get('/api/auth/departments')
        .then((res) => setDepartments((res?.data || []).map(d => typeof d === 'string' ? d : d.code || d.name)))
        .catch(console.error);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchRooms();

    const socket = getSocket();
    if (!socket) return;

    const handleTimetableLiveSync = () => {
      fetchScheduleTable();
    };
    const handleRoomLiveSync = () => {
      fetchRooms();
    };

    socket.on('timetable-updated', handleTimetableLiveSync);
    socket.on('room-created', handleRoomLiveSync);
    socket.on('room-updated', handleRoomLiveSync);
    socket.on('room-deleted', handleRoomLiveSync);

    return () => {
      socket.off('timetable-updated', handleTimetableLiveSync);
      socket.off('room-created', handleRoomLiveSync);
      socket.off('room-updated', handleRoomLiveSync);
      socket.off('room-deleted', handleRoomLiveSync);
    };
  }, [getEffectiveDepartment]);

  useEffect(() => {
    fetchScheduleTable();
  }, [filterSemester, filterSection, filterRoomId, filterDay, filterDepartment, getEffectiveDepartment]);

  const fetchRooms = async () => {
    try {
      const dep = getEffectiveDepartment();
      const data = await getRooms(dep !== 'ALL' ? { department: dep } : {});
      const roomList = data?.data || [];
      setRooms(roomList);
      if (roomList.length > 0 && !uploadRoomId) {
        setUploadRoomId(roomList[0].id || roomList[0]._id);
      }
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch rooms list.');
      console.error('❌ [TIMETABLE] Failed to fetch rooms list:', errMsg);
      setError(errMsg);
    }
  };

  const fetchScheduleTable = async () => {
    const seq = ++reqSeqRef.current;
    setTableLoading(true);
    try {
      const dep = getEffectiveDepartment();
      const params = {};
      if (dep && dep !== 'ALL') params.department = dep;
      
      if (filterSemester !== 'ALL') params.semester = filterSemester;
      if (filterSection !== 'ALL') params.section = filterSection;
      if (filterRoomId !== 'ALL') params.roomId = filterRoomId;
      if (filterDay !== 'ALL') params.day = filterDay;
      if (filterSearch.trim()) params.search = filterSearch.trim();

      const data = await getTimetable(params);
      if (seq === reqSeqRef.current) {
        setTimetable(data?.data || []);
      }
    } catch (err) {
      if (seq === reqSeqRef.current) {
        const errMsg = extractErrorMessage(err, 'Failed to load timetable schedule.');
        console.error('❌ [TIMETABLE] Failed to load timetable schedule:', errMsg);
        setError(errMsg);
      }
    } finally {
      if (seq === reqSeqRef.current) {
        setTableLoading(false);
      }
    }
  };

  // Instant client-side multi-layer filter ensuring 100% responsiveness & accuracy
  const displayedTimetable = useMemo(() => {
    return (timetable || []).filter((entry) => {
      // 1. Room filter (robust check across id and _id)
      if (filterRoomId !== 'ALL') {
        const entryRoomId = String(entry.roomId?._id || entry.roomId?.id || entry.roomId || '');
        if (entryRoomId !== String(filterRoomId)) return false;
      }

      // 2. Semester filter (flexible digit check so "5th", "5th Sem", "5" all match correctly)
      if (filterSemester !== 'ALL') {
        const targetDigit = filterSemester.match(/\d+/)?.[0];
        const entrySemStr = String(entry.semester || entry.classGroup || '');
        const entryDigit = entrySemStr.match(/\d+/)?.[0];
        if (targetDigit && entryDigit && targetDigit !== entryDigit) return false;
        if (!targetDigit && !entrySemStr.toLowerCase().includes(filterSemester.toLowerCase())) return false;
      }

      // 3. Section filter
      if (filterSection !== 'ALL') {
        const sec = String(entry.section || '').trim().toUpperCase();
        const classGroup = String(entry.classGroup || '').toUpperCase();
        const targetSec = filterSection.toUpperCase();
        const matchSec =
          sec === targetSec ||
          classGroup.includes(`SEC ${targetSec}`) ||
          classGroup.includes(`SECTION ${targetSec}`) ||
          classGroup.endsWith(` ${targetSec}`);
        if (!matchSec) return false;
      }

      // 4. Day filter
      if (filterDay !== 'ALL') {
        if (String(entry.day || '').trim().toLowerCase() !== filterDay.trim().toLowerCase()) return false;
      }

      // 5. Search text (Subject, Faculty, Faculty Email, Class Group, Room Name/Number)
      if (filterSearch.trim()) {
        const q = filterSearch.trim().toLowerCase();
        const corpus = [
          entry.subject || '',
          entry.faculty || '',
          entry.facultyEmail || '',
          entry.classGroup || '',
          entry.roomId?.name || '',
          
          entry.roomId?.building || '',
        ].join(' ').toLowerCase();
        if (!corpus.includes(q)) return false;
      }


      // Slot filter
      if (filterSlot !== 'ALL') {
        const slotKey = `${entry.startTime}-${entry.endTime}`;
        if (slotKey !== filterSlot) return false;
      }

      return true;
    });
  }, [timetable, filterRoomId, filterSemester, filterSection, filterDay, filterSearch, filterSlot]);

  const hasActiveFilters =
    filterRoomId !== 'ALL' ||
    filterSemester !== 'ALL' ||
    filterSection !== 'ALL' ||
    filterDay !== 'ALL' ||
    filterSlot !== 'ALL' ||
    Boolean(filterSearch.trim());

  const resetFilters = () => {
    setFilterRoomId('ALL');
    setFilterSemester('ALL');
    setFilterSection('ALL');
    setFilterDay('ALL');
    setFilterSearch('');
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
            return reject(new Error('The spreadsheet file is empty or contains no data rows.'));
          }

          const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s_-]/g, ''));
          const required = ['day', 'starttime', 'endtime', 'subject', 'faculty'];
          const missing = required.filter((r) => !headers.includes(r));

          if (missing.length > 0) {
            return reject(
              new Error(
                `Wrong format: Missing required columns [${missing.join(', ')}].\nExpected Header: Day, Start Time, End Time, Subject, Faculty`
              )
            );
          }

          const dayIdx = headers.indexOf('day');
          const startIdx = headers.indexOf('starttime');
          const endIdx = headers.indexOf('endtime');
          const subjIdx = headers.indexOf('subject');
          const facultyIdx = headers.indexOf('faculty');
          const emailIdx = headers.findIndex((h) => ['facultyemail', 'email', 'professoremail'].includes(h));

          const parsedRows = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim());
            if (cols.length < 5) continue;

            const day = cols[dayIdx];
            const startTime = cols[startIdx];
            const endTime = cols[endIdx];
            const subject = cols[subjIdx] || '';
            const faculty = cols[facultyIdx] || '';
            const facultyEmail = emailIdx !== -1 ? (cols[emailIdx] || '') : '';

            const isSubjectEmpty = subject === '';
            const isFacultyEmpty = faculty === '';

            if (isSubjectEmpty !== isFacultyEmpty) {
              return reject(new Error(`Row #${i}: Both Subject and Faculty must be provided together, or both must be empty to indicate a free slot.`));
            }

            if (!days.includes(day)) {
              return reject(new Error(`Row #${i}: Invalid Day "${day}". Must be one of ${days.join(', ')}.`));
            }
            if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
              return reject(new Error(`Row #${i}: Invalid time format (${startTime} - ${endTime}). Must be 24-hour HH:mm.`));
            }

            const slotKey = `${startTime}-${endTime}`;
            
            if (!VALID_TIMETABLE_SLOTS.includes(slotKey)) {
              return reject(new Error(`Row #${i}: Invalid time slot ${slotKey}. You must use the exact 50-minute institutional slots.`));
            }

            if (slotKey === '13:10-14:10' && (!isSubjectEmpty || !isFacultyEmpty)) {
              return reject(new Error(`Row #${i}: The 13:10-14:10 slot is reserved for lunch break. You must leave Subject and Faculty blank.`));
            }

            if (isSubjectEmpty && isFacultyEmpty) {
              continue;
            }

            parsedRows.push({ rowNumber: i, day, startTime, endTime, subject, faculty, facultyEmail });
          }

          for (let i = 0; i < parsedRows.length; i++) {
            for (let j = i + 1; j < parsedRows.length; j++) {
              const a = parsedRows[i];
              const b = parsedRows[j];

              if (a.day === b.day && isOverlapping(a.startTime, a.endTime, b.startTime, b.endTime)) {
                if (a.faculty.toLowerCase() === b.faculty.toLowerCase()) {
                  if (a.facultyEmail && b.facultyEmail && a.facultyEmail.toLowerCase() !== b.facultyEmail.toLowerCase()) {
                    // Distinct professors with identical names
                  } else {
                    return reject(
                      new Error(
                        `🚫 Faculty Collision in File:\n• Row #${a.rowNumber}: "${a.faculty}" (${a.startTime} - ${a.endTime})\n• Row #${b.rowNumber}: "${b.faculty}" (${b.startTime} - ${b.endTime})\nBoth classes are assigned to the same faculty at overlapping times on ${a.day}.`
                      )
                    );
                  }
                }
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

    if (ext === '.csv') {
      try {
        await verifyCSVContent(file);
      } catch (validationErr) {
        setError(extractErrorMessage(validationErr, 'Spreadsheet format verification failed.'));
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setSelectedFile(file);
  };

  const handleSubmitFile = async () => {
    if (uploading) return;
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
    console.log(`📊 [TIMETABLE] Uploading schedule: sem=${uploadSemester} sec=${uploadSection} room=${uploadRoomId}`);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('semester', uploadSemester);
    formData.append('section', uploadSection);
    formData.append('roomId', uploadRoomId);

    try {
      const data = await api.post('/api/timetable/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log(`✅ [TIMETABLE] Upload succeeded`);
      setSuccess(data.data?.message || 'Timetable published successfully!');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setFilterSemester('ALL');
      setFilterRoomId(uploadRoomId);
      await fetchScheduleTable();
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to upload timetable file.');
      console.error('❌ [TIMETABLE] Upload failed:', errMsg);
      setError(errMsg);
    } finally {
      setUploading(false);
    }
  };

  // ----- DYNAMIC FULL-WEEK DOWNLOAD TEMPLATE -----
  const downloadTemplate = () => {
    const group = `${uploadSemester} Sem Sec ${uploadSection}`;
    const templateDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const timeSlots = [
      { s: '08:10', e: '09:00' },
      { s: '09:00', e: '09:50' },
      { s: '09:50', e: '10:40' },
      { s: '10:40', e: '11:30' },
      { s: '11:30', e: '12:20' },
      { s: '12:20', e: '13:10' },
      { s: '13:10', e: '14:10', isBreak: true }, 
      { s: '14:10', e: '15:00' },
      { s: '15:00', e: '15:50' },
      { s: '15:50', e: '16:40' },
      { s: '16:40', e: '17:30' },
      { s: '17:30', e: '18:20' } 
    ];

    let csvContent = 'Day,Start Time,End Time,Subject,Faculty\n';

    templateDays.forEach((day) => {
      timeSlots.forEach((slot) => {
        if (slot.isBreak) {
          // Break row
          csvContent += `${day},${slot.s},${slot.e},,\n`;
        } else if (day === 'Monday' && slot.s === '08:10') {
          csvContent += `${day},${slot.s},${slot.e},Data Structures,Dr. Rajesh Kumar\n`;
        } else {
          csvContent += `${day},${slot.s},${slot.e},,\n`;
        }
      });
    });

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


  const handleDeleteEntry = async (entryId) => {
    if (actionLoadingId) return;
    if (!window.confirm('Are you sure you want to delete this schedule slot?')) return;
    setActionLoadingId(entryId);
    setError('');
    setSuccess('');
    console.log(`🗑️  [TIMETABLE] Deleting entry: ${entryId}`);

    try {
      await deleteTimetableEntry(entryId);
      console.log(`✅ [TIMETABLE] Entry ${entryId} deleted`);
      setSuccess('Slot removed from timetable.');
      if (isModalOpen && slotFormData.id === entryId) {
        setIsModalOpen(false);
      }
      await fetchScheduleTable();
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to delete timetable entry.');
      console.error('❌ [TIMETABLE] Delete entry failed:', errMsg);
      setError(errMsg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Direct Slot Edit Modal
  const handleOpenEditModal = (entry) => {
    setError('');
    setSuccess('');
    setModalError('');
    setModalMode('EDIT');
    const slotKey = `${entry.startTime}-${entry.endTime}`;
    setSlotFormData({
      id: entry.id || entry._id,
      roomId: entry.roomId?._id || entry.roomId?.id || entry.roomId || '',
      day: entry.day || 'Monday',
      timeSlot: VALID_TIMETABLE_SLOTS.includes(slotKey) ? slotKey : VALID_TIMETABLE_SLOTS[0],
      subject: entry.subject || '',
      faculty: entry.faculty || '',
      facultyEmail: entry.facultyEmail || '',
      semester: entry.semester || '5th',
      section: entry.section || 'A',
    });
    setIsModalOpen(true);
  };

  // Open Direct Slot Create Modal (e.g. clicking empty slot in grid)
  const handleOpenCreateModal = (room, day, slot) => {
    setError('');
    setSuccess('');
    setModalError('');
    setModalMode('CREATE');
    setSlotFormData({
      id: '',
      roomId: room?._id || room?.id || (rooms[0]?._id || rooms[0]?.id) || '',
      day: day || 'Monday',
      timeSlot: slot || '08:10-09:00',
      subject: '',
      faculty: '',
      facultyEmail: '',
      semester: uploadSemester || '5th',
      section: uploadSection || 'A',
    });
    setIsModalOpen(true);
  };

  // Save changes from Slot Modal
  const handleSaveModal = async (e) => {
    if (e) e.preventDefault();
    setModalError('');

    if (!slotFormData.subject.trim()) {
      setModalError('Subject name is required.');
      return;
    }
    if (!slotFormData.faculty.trim()) {
      setModalError('Faculty name is required.');
      return;
    }
    if (!slotFormData.roomId) {
      setModalError('Please select a classroom / lab.');
      return;
    }
    if (slotFormData.timeSlot === '13:10-14:10') {
      setModalError('13:10-14:10 is the institutional break and cannot be assigned a class.');
      return;
    }

    const [startTime, endTime] = slotFormData.timeSlot.split('-');
    if (!startTime || !endTime) {
      setModalError('Invalid time slot selected.');
      return;
    }

    setModalSaving(true);
    try {
      const payload = {
        roomId: slotFormData.roomId,
        day: slotFormData.day,
        startTime,
        endTime,
        subject: slotFormData.subject.trim(),
        faculty: slotFormData.faculty.trim(),
        facultyEmail: slotFormData.facultyEmail.trim(),
        semester: slotFormData.semester,
        section: slotFormData.section,
        classGroup: `${slotFormData.semester} Sec ${slotFormData.section}`,
      };

      if (modalMode === 'EDIT') {
        await updateTimetableEntry(slotFormData.id, payload);
        setSuccess(`Updated slot: ${slotFormData.subject} (${slotFormData.day} ${slotFormData.timeSlot})`);
      } else {
        await createTimetableEntry(payload);
        setSuccess(`Class slot added: ${slotFormData.subject} on ${slotFormData.day} (${slotFormData.timeSlot})`);
      }

      setIsModalOpen(false);
      await fetchScheduleTable();
    } catch (err) {
      const errMsg = extractErrorMessage(err, `Failed to ${modalMode === 'EDIT' ? 'update' : 'create'} slot.`);
      setModalError(errMsg);
    } finally {
      setModalSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {error && (
        <div className="px-5 py-3 bg-white border border-mac-border rounded-lg flex items-start text-rose-800 text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 mr-2.5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 whitespace-pre-line font-medium">{error}</div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="px-5 py-3 bg-white border border-mac-border rounded-lg flex items-start text-emerald-800 text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 mr-2.5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{success}</div>
          <button type="button" onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dedicated CSV / Excel Upload Card & Template Section */}
        {!isAdmin && (
          <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg px-8 py-5 sm:px-8 py-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-mac-bg text-mac-blue flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-mac-text">Upload Room Timetable</h3>
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
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 font-bold text-mac-text outline-none focus:bg-white focus:ring-2 focus:ring-mac-blue transition-all"
                >
                  {rooms.map((r) => (
                    <option key={r.id || r._id} value={r.id || r._id}>
                      {r.name} ({normalizeFloor(r.floor)}, {r.building})
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
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm bg-slate-50/50 font-semibold text-mac-text outline-none focus:bg-white focus:ring-2 focus:ring-mac-blue"
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
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm bg-slate-50/50 font-semibold text-mac-text outline-none focus:bg-white focus:ring-2 focus:ring-mac-blue"
                  >
                    {['A', 'B', 'C', 'D'].map((sec) => (
                      <option key={sec} value={sec}>Section {sec}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Enhanced Download Template Banner */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <FileText className="w-4 h-4 text-mac-blue" />
                    <span>Download Pre-Formatted Template</span>
                  </div>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="px-3 py-1 bg-mac-blue hover:bg-mac-blue-hover text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.CSV Template</span>
                  </button>
                </div>

                <div className="text-[11px] text-mac-subtext leading-relaxed">
                  Generates an editable spreadsheet pre-filled for <strong className="text-slate-700">{uploadSemester} Sem Sec {uploadSection}</strong> (Monday–Saturday slots in 24h format).
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
                  className="block w-full text-xs text-mac-subtext file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-mac-bg file:text-mac-blue-dark hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-lg p-1 bg-slate-50/50"
                />
              </div>

              {/* Staged File Card with Submit Button */}
              {selectedFile && (
                <div className="bg-mac-bg/60 border border-slate-200 rounded-lg px-5 py-3 space-y-3 animate-fadeIn">
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
                    className="w-full bg-mac-blue text-white py-2.5 rounded-lg text-xs sm:text-sm font-bold hover:bg-mac-blue-hover disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>{uploading ? 'Validating & Publishing...' : 'Upload & Publish Timetable'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {/* Right Column: Published Timetable Table with View Filters */}
        <div className={isAdmin ? "lg:col-span-12 space-y-4" : "lg:col-span-7 space-y-4"}>
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
            {/* Filter Bar Header */}
            <div className="px-5 py-3 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-mac-blue" />
                  <h3 className="text-base font-bold text-mac-text">
                    Published Schedule ({displayedTimetable.length}{displayedTimetable.length !== timetable.length ? ` of ${timetable.length}` : ''} Slots)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                  <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setViewMode('GRID')}
                      className={`p-1.5 rounded-md transition-all ${viewMode === 'GRID' ? 'bg-white shadow-sm text-mac-blue' : 'text-slate-500 hover:text-slate-700'}`}
                      title="Grid View"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('LIST')}
                      className={`p-1.5 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white shadow-sm text-mac-blue' : 'text-slate-500 hover:text-slate-700'}`}
                      title="List View"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={fetchScheduleTable}
                    className="p-1.5 text-mac-subtext hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
                    title="Refresh Schedule"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Search by subject, professor, or group..."
                  className="w-full border border-slate-200 rounded-lg pl-8 pr-8 py-1.5 text-xs bg-white text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-mac-blue"
                />
                {filterSearch && (
                  <button
                    type="button"
                    onClick={() => setFilterSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Multi-Criteria View Filters */}
              <div className={`grid grid-cols-2 ${isAdmin ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-2 pt-1`}>
                {isAdmin && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-mac-subtext mb-1">
                      Department
                    </label>
                    <select
                      value={filterDepartment}
                      onChange={(e) => {
                        setFilterDepartment(e.target.value);
                        setFilterRoomId('ALL');
                      }}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white font-medium text-slate-800 outline-none"
                    >
                      <option value="ALL">All Branches</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-mac-subtext mb-1">
                    Room
                  </label>
                  <select
                    value={filterRoomId}
                    onChange={(e) => setFilterRoomId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white font-medium text-slate-800 outline-none"
                  >
                    <option value="ALL">All Rooms</option>
                    {rooms.map((r) => (
                      <option key={r.id || r._id} value={r.id || r._id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-mac-subtext mb-1">
                    Semester
                  </label>
                  <select
                    value={filterSemester}
                    onChange={(e) => setFilterSemester(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white font-medium text-slate-800 outline-none"
                  >
                    <option value="ALL">All Semesters</option>
                    {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => (
                      <option key={s} value={s}>{s} Sem</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-mac-subtext mb-1">
                    Section
                  </label>
                  <select
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white font-medium text-slate-800 outline-none"
                  >
                    <option value="ALL">All Sections</option>
                    {['A', 'B', 'C', 'D'].map((sec) => (
                      <option key={sec} value={sec}>Section {sec}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-mac-subtext mb-1">
                    Day
                  </label>
                  <select
                    value={filterDay}
                    onChange={(e) => setFilterDay(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white font-medium text-slate-800 outline-none"
                  >
                    <option value="ALL">All Days</option>
                    {days.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-mac-subtext mb-1">
                    Time Slot
                  </label>
                  <select
                    value={filterSlot}
                    onChange={(e) => setFilterSlot(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white font-medium text-slate-800 outline-none"
                  >
                    <option value="ALL">All Slots</option>
                    {VALID_TIMETABLE_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {tableLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Loading timetable slots...</div>
            ) : displayedTimetable.length === 0 ? (
              <div className="p-12 text-center text-mac-subtext">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium">No published slots match your filter selection.</p>
                <p className="text-xs text-slate-400 mt-1">
                  {hasActiveFilters ? 'Try resetting your filters or adjusting your search keyword.' : 'Upload a timetable spreadsheet to get started.'}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-mac-blue bg-mac-bg hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear All Filters</span>
                  </button>
                )}
              </div>
            ) : viewMode === 'GRID' ? (() => {
              const groupedByRoom = displayedTimetable.reduce((acc, entry) => {
                const roomId = entry.roomId?._id || entry.roomId?.id || 'unknown';
                if (!acc[roomId]) acc[roomId] = { room: entry.roomId, entries: [] };
                acc[roomId].entries.push(entry);
                return acc;
              }, {});

              const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const slots = VALID_TIMETABLE_SLOTS;

              return (
                <div className="space-y-6 overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                  {Object.values(groupedByRoom).map(({ room, entries }) => (
                    <div key={room?._id || room?.id || 'unknown'} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-mac-blue" />
                          <h4 className="font-bold text-mac-text">{room?.name || 'Classroom'} <span className="text-mac-subtext text-sm font-medium">()</span></h4>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 table-fixed">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-3 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-center border-r border-slate-200 bg-slate-100 w-[80px]">Day / Time</th>
                              {slots.map(slot => (
                                <th key={slot} className="px-1 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-center border-r border-slate-200 w-[120px]">
                                  {slot}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {days.map(day => (
                              <tr key={day}>
                                <td className="px-2 py-3 text-[11px] font-bold text-slate-700 border-r border-slate-200 bg-slate-50 text-center">
                                  {day.substring(0, 3)}
                                </td>
                                {slots.map(slot => {
                                  const entry = entries.find(e => e.day === day && `${e.startTime}-${e.endTime}` === slot);
                                  return (
                                    <td key={slot} className="p-1 border-r border-slate-100 align-top relative group h-[75px]">
                                      {entry ? (
                                        <div
                                          onClick={() => handleOpenEditModal(entry)}
                                          className="h-full w-full bg-indigo-50/70 hover:bg-indigo-100/90 rounded p-1.5 border border-indigo-100 hover:border-indigo-300 flex flex-col justify-between transition-all cursor-pointer shadow-sm hover:shadow"
                                          title={`Click to edit ${entry.subject}`}
                                        >
                                          <div>
                                            <div className="text-[10px] font-bold text-slate-800 leading-tight line-clamp-2" title={entry.subject}>{entry.subject}</div>
                                            <div className="text-[9px] font-medium text-slate-600 truncate mt-0.5">{entry.faculty}</div>
                                          </div>
                                          <div className="flex justify-between items-end mt-1">
                                            {entry.semester && (
                                              <span className="text-[8px] font-bold text-mac-blue bg-blue-100/50 px-1 rounded truncate">
                                                {String(entry.semester).replace(/[^0-9]/g, '')}S {entry.section}
                                              </span>
                                            )}
                                          </div>
                                          <div
                                            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 bg-white/95 shadow-sm rounded border border-slate-200 p-0.5 z-10"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <button
                                              type="button"
                                              onClick={() => handleOpenEditModal(entry)}
                                              title="Edit Slot"
                                              className="p-1 text-slate-500 hover:text-mac-blue rounded bg-white hover:bg-indigo-50 transition-colors"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteEntry(entry.id || entry._id)}
                                              title="Delete Slot"
                                              className="p-1 text-slate-400 hover:text-rose-600 rounded bg-white hover:bg-rose-50 transition-colors"
                                            >
                                              <Trash2 className="w-3 h-3"/>
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div
                                          onClick={() => handleOpenCreateModal(room, day, slot)}
                                          className="h-full w-full rounded border border-transparent hover:border-dashed hover:border-indigo-300 hover:bg-indigo-50/40 transition-all cursor-pointer flex items-center justify-center group/free"
                                          title={`Click to add class on ${day} (${slot})`}
                                        >
                                          <span className="text-[10px] font-semibold text-slate-300 group-hover/free:text-mac-blue group-hover/free:font-bold transition-colors flex items-center gap-0.5">
                                            <Plus className="w-2.5 h-2.5 opacity-0 group-hover/free:opacity-100 transition-opacity" />
                                            <span className="opacity-0 group-hover/free:opacity-100 transition-opacity">Add</span>
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })() : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
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
                        Faculty
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {displayedTimetable.map((entry) => {
                      const entryId = entry.id || entry._id;
                      const isRowBusy = actionLoadingId === entryId;

                      return (
                        <tr key={entryId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5 text-sm">
                            <div className="font-bold text-mac-text">{entry.day}</div>
                            <div className="text-xs text-mac-subtext flex items-center gap-1 font-mono mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{entry.startTime} - {entry.endTime}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">
                            {entry.subject}
                          </td>

                          <td className="px-4 py-3.5 text-sm">
                            <div className="font-medium text-indigo-900 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-mac-blue" />
                              <span>{entry.roomId?.name || 'Room'}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-sm">
                            <div className="text-slate-800 font-medium">{entry.faculty}</div>
                            <div className="text-[11px] text-mac-subtext flex items-center flex-wrap gap-1 mt-1">
                              {entry.semester && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                  {String(entry.semester).toLowerCase().includes('sem') ? entry.semester : `${entry.semester} Sem`}
                                </span>
                              )}
                              {entry.section && (
                                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                  Sec {entry.section}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-sm text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(entry)}
                              disabled={isRowBusy}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-40"
                              title="Edit Timetable Slot"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entryId)}
                              disabled={isRowBusy}
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                              title="Delete Entry"
                            >
                              {isRowBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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

        </div>
      </div>

      {/* ── Interactive Direct Timetable Slot Edit / Create Modal ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${modalMode === 'EDIT' ? 'bg-indigo-50 text-mac-blue' : 'bg-emerald-50 text-emerald-600'}`}>
                  {modalMode === 'EDIT' ? <Edit2 className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {modalMode === 'EDIT' ? 'Update Class & Teacher' : 'Add Class to Timetable'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {modalMode === 'EDIT' ? 'Change course subject or assigned professor. Slot timing, classroom, and semester are fixed.' : 'Directly schedule a class without spreadsheet upload.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveModal} className="p-6 space-y-4">
              {modalError && (
                <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start text-rose-800 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 mr-2 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 whitespace-pre-line">{modalError}</div>
                </div>
              )}

              {/* In EDIT mode: Fixed Slot Context Card (Read-Only) */}
              {modalMode === 'EDIT' && (() => {
                const currentRoom = rooms.find(r => String(r.id || r._id) === String(slotFormData.roomId));
                const roomName = currentRoom?.name || 'Classroom';
                const roomBldg = currentRoom?.building ? `(${currentRoom.building})` : '';

                return (
                  <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <span>Slot Context (Fixed)</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 lowercase">
                        <Lock className="w-3 h-3 text-slate-400" /> cannot be changed
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white border border-slate-200/80 rounded-lg p-2 shadow-xs">
                        <div className="text-[10px] font-medium text-slate-400">Classroom</div>
                        <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1 mt-0.5" title={`${roomName} ${roomBldg}`}>
                          <Building2 className="w-3 h-3 text-mac-blue flex-shrink-0" />
                          <span className="truncate">{roomName}</span>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-lg p-2 shadow-xs">
                        <div className="text-[10px] font-medium text-slate-400">Day & Slot</div>
                        <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1 mt-0.5 font-mono">
                          <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                          <span className="truncate">{slotFormData.day.substring(0, 3)} {slotFormData.timeSlot}</span>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-lg p-2 shadow-xs">
                        <div className="text-[10px] font-medium text-slate-400">Target Group</div>
                        <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1 mt-0.5">
                          <BookOpen className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                          <span className="truncate">{slotFormData.semester} • Sec {slotFormData.section}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Subject (Editable) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Subject / Course Name *
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={slotFormData.subject}
                    onChange={(e) => setSlotFormData({ ...slotFormData, subject: e.target.value })}
                    placeholder="e.g. Operating Systems, Data Structures & Algorithms"
                    className="w-full border border-slate-200 rounded-lg pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50/40 text-slate-800 font-semibold placeholder:text-slate-400 placeholder:font-normal outline-none focus:bg-white focus:ring-2 focus:ring-mac-blue transition-all"
                  />
                </div>
              </div>

              {/* Faculty & Email (Editable) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Faculty / Teacher Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={slotFormData.faculty}
                    onChange={(e) => setSlotFormData({ ...slotFormData, faculty: e.target.value })}
                    placeholder="e.g. Dr. Dilip Singh Sisodia"
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs sm:text-sm bg-slate-50/40 text-slate-800 font-semibold placeholder:text-slate-400 placeholder:font-normal outline-none focus:bg-white focus:ring-2 focus:ring-mac-blue transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Teacher Email <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={slotFormData.facultyEmail}
                    onChange={(e) => setSlotFormData({ ...slotFormData, facultyEmail: e.target.value })}
                    placeholder="e.g. drsisodia@cse.nitrr.ac.in"
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs sm:text-sm bg-slate-50/40 text-slate-800 font-medium placeholder:text-slate-400 placeholder:font-normal outline-none focus:bg-white focus:ring-2 focus:ring-mac-blue transition-all"
                  />
                </div>
              </div>

              {/* In CREATE mode only: Semester, Section, Room, Day, and Time Slot are selectable */}
              {modalMode === 'CREATE' && (
                <>
                  {/* Semester & Section */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Semester *
                      </label>
                      <select
                        value={slotFormData.semester}
                        onChange={(e) => setSlotFormData({ ...slotFormData, semester: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm bg-slate-50/40 font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-mac-blue"
                      >
                        {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => (
                          <option key={s} value={s}>{s} Semester</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Section *
                      </label>
                      <select
                        value={slotFormData.section}
                        onChange={(e) => setSlotFormData({ ...slotFormData, section: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm bg-slate-50/40 font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-mac-blue"
                      >
                        {['A', 'B', 'C', 'D'].map((sec) => (
                          <option key={sec} value={sec}>Section {sec}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Room & Day */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Classroom / Lab *
                      </label>
                      <select
                        value={slotFormData.roomId}
                        onChange={(e) => setSlotFormData({ ...slotFormData, roomId: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm bg-slate-50/40 font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-mac-blue"
                      >
                        {rooms.map((r) => (
                          <option key={r.id || r._id} value={r.id || r._id}>
                            {r.name} ({r.department ? r.department.substring(0, 15) : ''})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Day of Week *
                      </label>
                      <select
                        value={slotFormData.day}
                        onChange={(e) => setSlotFormData({ ...slotFormData, day: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm bg-slate-50/40 font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-mac-blue"
                      >
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Time Slot */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Institutional Time Slot *</span>
                      <span className="text-[11px] text-slate-400 font-normal">50-min academic grid</span>
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={slotFormData.timeSlot}
                        onChange={(e) => setSlotFormData({ ...slotFormData, timeSlot: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50/40 font-mono font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-mac-blue"
                      >
                        {VALID_TIMETABLE_SLOTS.map((slot) => (
                          <option key={slot} value={slot} disabled={slot === '13:10-14:10'}>
                            {slot} {slot === '13:10-14:10' ? '(Break - No Classes)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Modal Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {modalMode === 'EDIT' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(slotFormData.id)}
                    className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Slot</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={modalSaving}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSaving}
                    className="px-5 py-2 bg-mac-blue hover:bg-mac-blue-hover text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {modalSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{modalMode === 'EDIT' ? 'Save Changes' : 'Create Slot'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
