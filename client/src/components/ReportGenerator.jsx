import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Activity,
  BarChart3,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  Download,
  Filter,
  User,
  Sparkles,
  ChevronRight,
  RotateCcw,
  Database,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { getAllRoomsStatus, getDepartments, getAllUsers, getReportDbStatus, syncReportDb } from '../services/api';
import ReportTableVisualizer from './ReportTableVisualizer';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Robust RFC 4180 CSV Parser
function parseCSV(text) {
  if (!text || typeof text !== 'string') return { headers: [], rows: [], rawCsv: '' };
  const lines = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        // ignore carriage return
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((c) => c !== '')) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((c) => c !== '')) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) return { headers: [], rows: [], rawCsv: text };

  const headers = lines[0].map((h) => h.trim());
  const rows = lines.slice(1).map((row, rowIdx) => {
    const obj = { _rowId: rowIdx + 1 };
    headers.forEach((h, colIdx) => {
      obj[h] = row[colIdx] !== undefined ? row[colIdx].trim() : '';
    });
    return obj;
  });

  return { headers, rows, rawCsv: text };
}

export default function ReportGenerator({ departments: initialDepartments }) {
  const [departments, setDepartments] = useState(initialDepartments || []);
  const [roomsList, setRoomsList] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);

  // Selected Report Configuration Tab: 'AUDIT' | 'BLUEPRINT' | 'UTILIZATION' | 'USAGE'
  const [activeReportTab, setActiveReportTab] = useState('AUDIT');

  // Active Report Visualizer State
  const [visualizerData, setVisualizerData] = useState(null);
  const [visualizingType, setVisualizingType] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Status & Loading States
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditStatus, setAuditStatus] = useState(null);
  const [auditMode, setAuditMode] = useState('date'); // 'date' | 'year' | 'range'

  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [blueprintStatus, setBlueprintStatus] = useState(null);

  const [utilizationLoading, setUtilizationLoading] = useState(false);
  const [utilizationStatus, setUtilizationStatus] = useState(null);

  const [usageLoading, setUsageLoading] = useState(false);
  const [usageStatus, setUsageStatus] = useState(null);

  useEffect(() => {
    if (initialDepartments && initialDepartments.length > 0) {
      setDepartments(initialDepartments);
    } else {
      getDepartments()
        .then((res) => {
          const list = (res?.data || []).map((d) => (typeof d === 'string' ? d : d.code || d.name));
          setDepartments(list);
        })
        .catch((err) => {
          console.error('Failed to load departments in ReportGenerator:', err);
        });
    }
  }, [initialDepartments]);

  useEffect(() => {
    let isMounted = true;
    const fetchRooms = async () => {
      setRoomsLoading(true);
      try {
        const res = await getAllRoomsStatus();
        if (isMounted) {
          setRoomsList(res.data?.data || res.data || []);
        }
      } catch (err) {
        console.error('Failed to load rooms for reports:', err);
      } finally {
        if (isMounted) setRoomsLoading(false);
      }
    };

    const fetchUsers = async () => {
      try {
        const res = await getAllUsers();
        const list = res?.data || res?.users || res || [];
        if (isMounted && Array.isArray(list)) {
          const sorted = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setUsersList(sorted);
        }
      } catch (err) {
        console.warn('Failed to load users for report filters:', err);
      }
    };

    fetchRooms();
    fetchUsers();

    // Fetch Isolated Report Database status
    const fetchDbStatus = async () => {
      try {
        const res = await getReportDbStatus();
        if (isMounted && res?.data) {
          setReportDbInfo(res.data);
        }
      } catch (e) {
        console.warn('Could not fetch report DB status:', e);
      }
    };
    fetchDbStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const [reportDbInfo, setReportDbInfo] = useState(null);
  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  const handleManualSync = async () => {
    setIsSyncingDb(true);
    setSyncFeedback(null);
    try {
      const res = await syncReportDb();
      setSyncFeedback({
        type: 'success',
        message: 'Report database synchronized! Zero records pruned from operational database.',
      });
      const updated = await getReportDbStatus();
      if (updated?.data) setReportDbInfo(updated.data);
    } catch (err) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Failed to sync report database.',
      });
    } finally {
      setIsSyncingDb(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  // Generic CSV file downloader helper
  const triggerDownload = (blobOrText, filename) => {
    const blob =
      typeof blobOrText === 'string'
        ? new Blob([blobOrText], { type: 'text/csv;charset=utf-8;' })
        : blobOrText;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // ── 1. AUDIT REPORT HANDLER ──
  const handleAuditAction = async (formElement, isVisualize = false) => {
    setAuditStatus(null);
    if (isVisualize) {
      setVisualizingType('AUDIT');
    } else {
      setAuditLoading(true);
    }

    try {
      const fd = new FormData(formElement);
      const params = new URLSearchParams();

      const roomId = fd.get('roomId');
      const department = fd.get('department');
      const facultyEmail = fd.get('facultyEmail');

      if (roomId && roomId !== 'ALL') params.append('roomId', roomId);
      if (department && department !== 'ALL') params.append('department', department);
      if (facultyEmail && facultyEmail !== 'ALL') params.append('facultyEmail', facultyEmail);

      let dateSummary = '';
      if (auditMode === 'date') {
        const targetDate = fd.get('targetDate');
        if (targetDate) {
          params.append('targetDate', targetDate);
          dateSummary = `Date: ${targetDate}`;
        }
      } else if (auditMode === 'year') {
        const year = fd.get('year');
        if (year) {
          params.append('year', year);
          dateSummary = `Year: ${year}`;
        }
      } else {
        const startDate = fd.get('startDate');
        const endDate = fd.get('endDate');
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        dateSummary = `${startDate || 'Start'} to ${endDate || 'End'}`;
      }

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/timetable/report/room-audit/csv?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let errMsg = 'Failed to generate room schedule audit report.';
        try {
          const json = await res.json();
          if (json?.message) errMsg = json.message;
        } catch {}
        throw new Error(errMsg);
      }

      const filename = `room_schedule_audit_${roomId || 'all'}.csv`;

      if (isVisualize) {
        const csvText = await res.text();
        const parsed = parseCSV(csvText);

        const filterSummary = [
          dateSummary,
          department && department !== 'ALL' ? `Dept: ${department}` : 'All Departments',
          roomId && roomId !== 'ALL'
            ? `Room: ${roomsList.find((r) => (r.id || r._id) === roomId)?.name || roomId}`
            : 'All Rooms',
        ];
        if (facultyEmail && facultyEmail !== 'ALL') {
          const u = usersList.find((usr) => usr.email === facultyEmail);
          filterSummary.push(`User: ${u ? u.name : facultyEmail}`);
        }

        setVisualizerData({
          title: 'Room Schedule & Booking Audit (Out-of-Timetable vs Scheduled)',
          type: 'AUDIT',
          headers: parsed.headers,
          rows: parsed.rows,
          rawCsv: csvText,
          filename,
          filterSummary,
        });

        setAuditStatus({
          type: 'success',
          message: `Report visualized! Found ${parsed.rows.length} records.`,
        });
      } else {
        const blob = await res.blob();
        triggerDownload(blob, filename);
        setAuditStatus({
          type: 'success',
          message: 'Room Schedule & Booking Audit CSV downloaded successfully.',
        });
      }
    } catch (err) {
      setAuditStatus({
        type: 'error',
        message: err.message || 'An error occurred while generating audit report.',
      });
    } finally {
      setAuditLoading(false);
      setVisualizingType(null);
    }
  };

  // ── 2. BLUEPRINT REPORT HANDLER ──
  const handleBlueprintAction = async (formElement, isVisualize = false) => {
    setBlueprintStatus(null);
    if (isVisualize) {
      setVisualizingType('BLUEPRINT');
    } else {
      setBlueprintLoading(true);
    }

    try {
      const fd = new FormData(formElement);
      const params = new URLSearchParams();

      const targetDate = fd.get('targetDate');
      const department = fd.get('department');
      const roomId = fd.get('roomId');
      const semester = fd.get('semester');
      const facultyEmail = fd.get('facultyEmail');

      if (targetDate) params.append('targetDate', targetDate);
      if (department && department !== 'ALL') params.append('department', department);
      if (roomId && roomId !== 'ALL') params.append('roomId', roomId);
      if (semester && semester !== 'ALL') params.append('semester', semester);
      if (facultyEmail && facultyEmail !== 'ALL') params.append('facultyEmail', facultyEmail);

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/timetable/report/csv?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let errMsg = 'Failed to generate timetable blueprint report.';
        try {
          const json = await res.json();
          if (json?.message) errMsg = json.message;
        } catch {}
        throw new Error(errMsg);
      }

      const filename = `timetable_blueprint_${targetDate || 'current'}.csv`;

      if (isVisualize) {
        const csvText = await res.text();
        const parsed = parseCSV(csvText);

        const filterSummary = [
          `Snapshot: ${targetDate || 'Today'}`,
          department && department !== 'ALL' ? `Dept: ${department}` : 'All Departments',
          semester && semester !== 'ALL' ? `Semester: ${semester}` : 'All Semesters',
          roomId && roomId !== 'ALL'
            ? `Room: ${roomsList.find((r) => (r.id || r._id) === roomId)?.name || roomId}`
            : 'All Rooms',
        ];
        if (facultyEmail && facultyEmail !== 'ALL') {
          const u = usersList.find((usr) => usr.email === facultyEmail);
          filterSummary.push(`User: ${u ? u.name : facultyEmail}`);
        }

        setVisualizerData({
          title: 'Historical Timetable Blueprint (Master Schedule State)',
          type: 'BLUEPRINT',
          headers: parsed.headers,
          rows: parsed.rows,
          rawCsv: csvText,
          filename,
          filterSummary,
        });

        setBlueprintStatus({
          type: 'success',
          message: `Blueprint visualized! Found ${parsed.rows.length} timetable slots.`,
        });
      } else {
        const blob = await res.blob();
        triggerDownload(blob, filename);
        setBlueprintStatus({
          type: 'success',
          message: 'Blueprint CSV downloaded successfully.',
        });
      }
    } catch (err) {
      setBlueprintStatus({
        type: 'error',
        message: err.message || 'An error occurred while downloading report.',
      });
    } finally {
      setBlueprintLoading(false);
      setVisualizingType(null);
    }
  };

  // ── 3. UTILIZATION REPORT HANDLER ──
  const handleUtilizationAction = async (formElement, isVisualize = false) => {
    setUtilizationStatus(null);
    if (isVisualize) {
      setVisualizingType('UTILIZATION');
    } else {
      setUtilizationLoading(true);
    }

    try {
      const fd = new FormData(formElement);
      const params = new URLSearchParams();

      const startDate = fd.get('startDate');
      const endDate = fd.get('endDate');
      const department = fd.get('department');
      const roomId = fd.get('roomId');
      const facultyEmail = fd.get('facultyEmail');

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (department && department !== 'ALL') params.append('department', department);
      if (roomId && roomId !== 'ALL') params.append('roomId', roomId);
      if (facultyEmail && facultyEmail !== 'ALL') params.append('facultyEmail', facultyEmail);

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/bookings/report/utilization/csv?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let errMsg = 'Failed to generate utilization summary report.';
        try {
          const json = await res.json();
          if (json?.message) errMsg = json.message;
        } catch {}
        throw new Error(errMsg);
      }

      const filename = `room_utilization_${startDate || 'all'}_to_${endDate || 'all'}.csv`;

      if (isVisualize) {
        const csvText = await res.text();
        const parsed = parseCSV(csvText);

        const filterSummary = [
          `${startDate || 'Start'} to ${endDate || 'End'}`,
          department && department !== 'ALL' ? `Dept: ${department}` : 'All Departments',
          roomId && roomId !== 'ALL'
            ? `Room: ${roomsList.find((r) => (r.id || r._id) === roomId)?.name || roomId}`
            : 'All Rooms',
        ];
        if (facultyEmail && facultyEmail !== 'ALL') {
          const u = usersList.find((usr) => usr.email === facultyEmail);
          filterSummary.push(`User: ${u ? u.name : facultyEmail}`);
        }

        setVisualizerData({
          title: 'Room Utilization Summary (Long-Term Analytics)',
          type: 'UTILIZATION',
          headers: parsed.headers,
          rows: parsed.rows,
          rawCsv: csvText,
          filename,
          filterSummary,
        });

        setUtilizationStatus({
          type: 'success',
          message: `Utilization visualized! Found ${parsed.rows.length} classroom summaries.`,
        });
      } else {
        const blob = await res.blob();
        triggerDownload(blob, filename);
        setUtilizationStatus({
          type: 'success',
          message: 'Room Utilization Summary CSV downloaded successfully.',
        });
      }
    } catch (err) {
      setUtilizationStatus({
        type: 'error',
        message: err.message || 'An error occurred while downloading utilization report.',
      });
    } finally {
      setUtilizationLoading(false);
      setVisualizingType(null);
    }
  };

  // ── 4. DETAILED BOOKING LOG HANDLER ──
  const handleUsageAction = async (formElement, isVisualize = false) => {
    setUsageStatus(null);
    if (isVisualize) {
      setVisualizingType('USAGE');
    } else {
      setUsageLoading(true);
    }

    try {
      const fd = new FormData(formElement);
      const params = new URLSearchParams();

      const startDate = fd.get('startDate');
      const endDate = fd.get('endDate');
      const department = fd.get('department');
      const roomId = fd.get('roomId');
      const facultyEmail = fd.get('facultyEmail');

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (department && department !== 'ALL') params.append('department', department);
      if (roomId && roomId !== 'ALL') params.append('roomId', roomId);
      if (facultyEmail && facultyEmail !== 'ALL') params.append('facultyEmail', facultyEmail);

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/bookings/report/csv?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let errMsg = 'Failed to generate room usage report.';
        try {
          const json = await res.json();
          if (json?.message) errMsg = json.message;
        } catch {}
        throw new Error(errMsg);
      }

      const filename = `room_usage_${startDate || 'all'}_to_${endDate || 'all'}.csv`;

      if (isVisualize) {
        const csvText = await res.text();
        const parsed = parseCSV(csvText);

        const filterSummary = [
          `${startDate || 'Start'} to ${endDate || 'End'}`,
          department && department !== 'ALL' ? `Dept: ${department}` : 'All Departments',
          roomId && roomId !== 'ALL'
            ? `Room: ${roomsList.find((r) => (r.id || r._id) === roomId)?.name || roomId}`
            : 'All Rooms',
        ];
        if (facultyEmail && facultyEmail !== 'ALL') {
          const u = usersList.find((usr) => usr.email === facultyEmail);
          filterSummary.push(`User: ${u ? u.name : facultyEmail}`);
        }

        setVisualizerData({
          title: 'Actual Room Usage (Detailed Booking Log)',
          type: 'USAGE',
          headers: parsed.headers,
          rows: parsed.rows,
          rawCsv: csvText,
          filename,
          filterSummary,
        });

        setUsageStatus({
          type: 'success',
          message: `Detailed booking log visualized! Found ${parsed.rows.length} reservations.`,
        });
      } else {
        const blob = await res.blob();
        triggerDownload(blob, filename);
        setUsageStatus({
          type: 'success',
          message: 'Detailed Usage CSV downloaded successfully.',
        });
      }
    } catch (err) {
      setUsageStatus({
        type: 'error',
        message: err.message || 'An error occurred while downloading report.',
      });
    } finally {
      setUsageLoading(false);
      setVisualizingType(null);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  const oneYearAgoStr = new Date(new Date().setFullYear(currentYear - 1)).toISOString().split('T')[0];
  const fiveYearsAgoStr = new Date(new Date().setFullYear(currentYear - 5)).toISOString().split('T')[0];

  const REPORT_TABS = [
    {
      id: 'AUDIT',
      title: 'Schedule Audit',
      subtitle: 'Out-of-Timetable vs Scheduled',
      icon: Clock,
      color: 'text-indigo-600',
      activeBg: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    },
    {
      id: 'BLUEPRINT',
      title: 'Timetable Blueprint',
      subtitle: 'Historical Master Schedule',
      icon: FileSpreadsheet,
      color: 'text-indigo-600',
      activeBg: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    },
    {
      id: 'UTILIZATION',
      title: 'Room Utilization',
      subtitle: 'Multi-Year Analytics',
      icon: BarChart3,
      color: 'text-blue-600',
      activeBg: 'bg-blue-50 border-blue-200 text-blue-900',
    },
    {
      id: 'USAGE',
      title: 'Booking Usage Log',
      subtitle: 'Line-Item Completed & Active',
      icon: Activity,
      color: 'text-emerald-600',
      activeBg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── ISOLATED REPORT DATABASE BADGE & HEALTH INDICATOR ── */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 border border-indigo-500/30 rounded-2xl p-3.5 sm:p-4 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white tracking-tight">
                Isolated Analytics Database Engine
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3" /> Operational DB Protected
              </span>
            </div>
            <p className="text-xs text-indigo-200/80 mt-0.5">
              Historical reports are processed in <code className="bg-black/30 px-1 py-0.5 rounded text-indigo-300 font-mono text-[11px]">roomallocation_reports</code>. Primary database remains fast and zero records are pruned.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncingDb}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm shadow-indigo-500/20"
            title="Synchronize records older than 30 days to Report DB"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDb ? 'animate-spin' : ''}`} />
            {isSyncingDb ? 'Syncing...' : 'Sync Report DB'}
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
          syncFeedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {syncFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{syncFeedback.message}</span>
        </div>
      )}

      {/* ── SIDE-BY-SIDE CONTAINER ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN: Report Selection & Filter Controls ── */}
        {!isExpanded && (
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            {/* Report Type Selector Switcher */}
            <div className="bg-slate-100/90 border border-slate-200 p-1.5 rounded-2xl shadow-sm space-y-1">
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Select Report Type
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {REPORT_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeReportTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveReportTab(tab.id)}
                      className={`p-2.5 rounded-xl text-left transition-all border cursor-pointer flex flex-col justify-between ${
                        isActive
                          ? `${tab.activeBg} shadow-sm font-bold`
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-4 h-4 ${isActive ? tab.color : 'text-slate-500'}`} />
                        <span className="text-xs font-bold truncate">{tab.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium truncate mt-1">
                        {tab.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── ACTIVE CONFIGURATION CARD ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 space-y-5">
              {/* 1. SCHEDULE AUDIT FORM */}
              {activeReportTab === 'AUDIT' && (
                <>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      Room Schedule & Booking Audit
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Audit bookings vs timetable classes. Flags scheduled lectures, authorized free slots, and out-of-schedule reservations.
                    </p>
                  </div>

                  {auditStatus && (
                    <div
                      className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                        auditStatus.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {auditStatus.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <span>{auditStatus.message}</span>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAuditAction(e.target, false);
                    }}
                    className="space-y-4"
                  >
                    {/* Mode pills */}
                    <div className="flex items-center gap-1 text-[11px] font-semibold bg-slate-100 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setAuditMode('date')}
                        className={`flex-1 py-1 text-center rounded-md transition ${
                          auditMode === 'date' ? 'bg-white shadow-xs text-indigo-600 font-bold' : 'text-slate-600'
                        }`}
                      >
                        Specific Date
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuditMode('year')}
                        className={`flex-1 py-1 text-center rounded-md transition ${
                          auditMode === 'year' ? 'bg-white shadow-xs text-indigo-600 font-bold' : 'text-slate-600'
                        }`}
                      >
                        Full Year
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuditMode('range')}
                        className={`flex-1 py-1 text-center rounded-md transition ${
                          auditMode === 'range' ? 'bg-white shadow-xs text-indigo-600 font-bold' : 'text-slate-600'
                        }`}
                      >
                        Date Range
                      </button>
                    </div>

                    {/* Filters */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Room Name
                        </label>
                        <select
                          name="roomId"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Rooms</option>
                          {roomsList.map((r) => (
                            <option key={r._id || r.id} value={r._id || r.id}>
                              {r.name} {r.building ? `(${r.building})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Department / Branch
                        </label>
                        <select
                          name="department"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Departments</option>
                          {departments.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Faculty / Professor
                        </label>
                        <select
                          name="facultyEmail"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Faculty Members</option>
                          {usersList.map((u) => (
                            <option key={u.id || u._id} value={u.email}>
                              {u.name} {u.department ? `(${u.department})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {auditMode === 'date' && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Audit Date
                          </label>
                          <input
                            type="date"
                            required
                            name="targetDate"
                            defaultValue={todayStr}
                            max={todayStr}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                          />
                        </div>
                      )}

                      {auditMode === 'year' && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Academic Year
                          </label>
                          <select
                            name="year"
                            defaultValue={currentYear}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((offset) => {
                              const y = currentYear - offset;
                              return (
                                <option key={y} value={y}>
                                  Year {y}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                      {auditMode === 'range' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              From Date
                            </label>
                            <input
                              type="date"
                              required
                              name="startDate"
                              defaultValue={fiveYearsAgoStr}
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              To Date
                            </label>
                            <input
                              type="date"
                              required
                              name="endDate"
                              defaultValue={todayStr}
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dual Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={auditLoading || visualizingType === 'AUDIT'}
                        onClick={(e) => {
                          const form = e.currentTarget.closest('form');
                          handleAuditAction(form, true);
                        }}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {visualizingType === 'AUDIT' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Visualizing...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visualize Table</span>
                          </>
                        )}
                      </button>

                      <button
                        type="submit"
                        disabled={auditLoading || visualizingType === 'AUDIT'}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Download CSV file directly"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* 2. TIMETABLE BLUEPRINT FORM */}
              {activeReportTab === 'BLUEPRINT' && (
                <>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                      Historical Timetable Blueprint
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Visualizes the timetable plan exactly as published for any past date or semester.
                    </p>
                  </div>

                  {blueprintStatus && (
                    <div
                      className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                        blueprintStatus.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {blueprintStatus.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <span>{blueprintStatus.message}</span>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleBlueprintAction(e.target, false);
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Snapshot Date
                        </label>
                        <input
                          type="date"
                          name="targetDate"
                          defaultValue={todayStr}
                          max={todayStr}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Department
                        </label>
                        <select
                          name="department"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Departments</option>
                          {departments.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Semester
                        </label>
                        <select
                          name="semester"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Semesters</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                            <option key={s} value={s}>
                              Semester {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Room Name
                        </label>
                        <select
                          name="roomId"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Rooms</option>
                          {roomsList.map((r) => (
                            <option key={r._id || r.id} value={r._id || r.id}>
                              {r.name} {r.building ? `(${r.building})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Faculty / Professor
                        </label>
                        <select
                          name="facultyEmail"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Faculty Members</option>
                          {usersList.map((u) => (
                            <option key={u.id || u._id} value={u.email}>
                              {u.name} {u.department ? `(${u.department})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={blueprintLoading || visualizingType === 'BLUEPRINT'}
                        onClick={(e) => {
                          const form = e.currentTarget.closest('form');
                          handleBlueprintAction(form, true);
                        }}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {visualizingType === 'BLUEPRINT' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Visualizing...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visualize Table</span>
                          </>
                        )}
                      </button>

                      <button
                        type="submit"
                        disabled={blueprintLoading || visualizingType === 'BLUEPRINT'}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* 3. ROOM UTILIZATION FORM */}
              {activeReportTab === 'UTILIZATION' && (
                <>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      Room Utilization Summary
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Aggregated hours utilized, booking counts, unique days, and duration metrics over 1–5+ years.
                    </p>
                  </div>

                  {utilizationStatus && (
                    <div
                      className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                        utilizationStatus.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {utilizationStatus.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <span>{utilizationStatus.message}</span>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUtilizationAction(e.target, false);
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            From Date
                          </label>
                          <input
                            type="date"
                            required
                            name="startDate"
                            defaultValue={fiveYearsAgoStr}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            To Date
                          </label>
                          <input
                            type="date"
                            required
                            name="endDate"
                            defaultValue={todayStr}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Department
                        </label>
                        <select
                          name="department"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Departments</option>
                          {departments.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Room Name
                        </label>
                        <select
                          name="roomId"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Rooms</option>
                          {roomsList.map((r) => (
                            <option key={r._id || r.id} value={r._id || r.id}>
                              {r.name} {r.building ? `(${r.building})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Faculty / Professor
                        </label>
                        <select
                          name="facultyEmail"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Faculty Members</option>
                          {usersList.map((u) => (
                            <option key={u.id || u._id} value={u.email}>
                              {u.name} {u.department ? `(${u.department})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={utilizationLoading || visualizingType === 'UTILIZATION'}
                        onClick={(e) => {
                          const form = e.currentTarget.closest('form');
                          handleUtilizationAction(form, true);
                        }}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {visualizingType === 'UTILIZATION' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Visualizing...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visualize Table</span>
                          </>
                        )}
                      </button>

                      <button
                        type="submit"
                        disabled={utilizationLoading || visualizingType === 'UTILIZATION'}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* 4. BOOKING USAGE LOG FORM */}
              {activeReportTab === 'USAGE' && (
                <>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      Detailed Room Usage Log
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Line-item active and completed reservations log with booking timestamps and purposes.
                    </p>
                  </div>

                  {usageStatus && (
                    <div
                      className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                        usageStatus.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {usageStatus.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <span>{usageStatus.message}</span>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUsageAction(e.target, false);
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            From Date
                          </label>
                          <input
                            type="date"
                            required
                            name="startDate"
                            defaultValue={oneYearAgoStr}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            To Date
                          </label>
                          <input
                            type="date"
                            required
                            name="endDate"
                            defaultValue={todayStr}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Department
                        </label>
                        <select
                          name="department"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Departments</option>
                          {departments.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Room Name
                        </label>
                        <select
                          name="roomId"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Rooms</option>
                          {roomsList.map((r) => (
                            <option key={r._id || r.id} value={r._id || r.id}>
                              {r.name} {r.building ? `(${r.building})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Faculty / Professor
                        </label>
                        <select
                          name="facultyEmail"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white outline-none"
                        >
                          <option value="ALL">All Faculty Members</option>
                          {usersList.map((u) => (
                            <option key={u.id || u._id} value={u.email}>
                              {u.name} {u.department ? `(${u.department})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={usageLoading || visualizingType === 'USAGE'}
                        onClick={(e) => {
                          const form = e.currentTarget.closest('form');
                          handleUsageAction(form, true);
                        }}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {visualizingType === 'USAGE' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Visualizing...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visualize Table</span>
                          </>
                        )}
                      </button>

                      <button
                        type="submit"
                        disabled={usageLoading || visualizingType === 'USAGE'}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── RIGHT COLUMN: Interactive Visualizer Table Panel ── */}
        <div
          className={`${
            isExpanded ? 'lg:col-span-12' : 'lg:col-span-7 xl:col-span-8'
          } transition-all duration-300`}
        >
          {visualizerData ? (
            <ReportTableVisualizer
              reportData={visualizerData}
              onClose={() => setVisualizerData(null)}
              onDownload={() => triggerDownload(visualizerData.rawCsv, visualizerData.filename)}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
            />
          ) : (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[460px] shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3.5 text-indigo-600 shadow-inner">
                <FileSpreadsheet className="w-7 h-7 stroke-[1.5]" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Side-by-Side Report Visualization
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5 leading-relaxed">
                Configure your filters on the left and click <strong>"Visualize Table"</strong> to preview data right here side-by-side with instant search, sorting, and timetable matrix mode.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    const form = document.querySelector('form');
                    if (form) handleAuditAction(form, true);
                  }}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Visualize Today's Schedule</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveReportTab('BLUEPRINT');
                    setTimeout(() => {
                      const form = document.querySelector('form');
                      if (form) handleBlueprintAction(form, true);
                    }, 50);
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Visualize Master Timetable</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
