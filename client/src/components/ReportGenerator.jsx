import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Activity, BarChart3, Clock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getAllRoomsStatus, getDepartments } from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function ReportGenerator({ departments: initialDepartments }) {
  const [departments, setDepartments] = useState(initialDepartments || []);
  const [roomsList, setRoomsList] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // Card 1: Timetable Blueprint
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [blueprintStatus, setBlueprintStatus] = useState(null);

  // Card 2: Room Schedule & Booking Audit (Out-of-Timetable vs Scheduled)
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditStatus, setAuditStatus] = useState(null);
  const [auditMode, setAuditMode] = useState('date'); // 'date' | 'year' | 'range'

  // Card 3: Room Utilization Analytics
  const [utilizationLoading, setUtilizationLoading] = useState(false);
  const [utilizationStatus, setUtilizationStatus] = useState(null);

  // Card 4: Detailed Room Usage Log
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
    fetchRooms();
    return () => {
      isMounted = false;
    };
  }, []);

  // Generic CSV file downloader helper
  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // 1. Download Blueprint CSV
  const handleDownloadBlueprint = async (e) => {
    e.preventDefault();
    setBlueprintStatus(null);
    setBlueprintLoading(true);

    try {
      const fd = new FormData(e.target);
      const params = new URLSearchParams();

      const targetDate = fd.get('targetDate');
      const department = fd.get('department');
      const roomId = fd.get('roomId');
      const semester = fd.get('semester');

      if (targetDate) params.append('targetDate', targetDate);
      if (department && department !== 'ALL') params.append('department', department);
      if (roomId && roomId !== 'ALL') params.append('roomId', roomId);
      if (semester && semester !== 'ALL') params.append('semester', semester);

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/timetable/report/csv?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let errMsg = 'Failed to generate timetable report.';
        try {
          const json = await res.json();
          if (json?.message) errMsg = json.message;
        } catch {}
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      triggerDownload(blob, `timetable_blueprint_${targetDate || 'current'}.csv`);
      setBlueprintStatus({ type: 'success', message: 'Blueprint CSV downloaded successfully.' });
    } catch (err) {
      setBlueprintStatus({ type: 'error', message: err.message || 'An error occurred while downloading report.' });
    } finally {
      setBlueprintLoading(false);
    }
  };

  // 2. Download Room Schedule & Booking Audit CSV (Out-of-Schedule vs Timetable Analysis)
  const handleDownloadAudit = async (e) => {
    e.preventDefault();
    setAuditStatus(null);
    setAuditLoading(true);

    try {
      const fd = new FormData(e.target);
      const params = new URLSearchParams();

      const roomId = fd.get('roomId');
      const department = fd.get('department');

      if (roomId && roomId !== 'ALL') params.append('roomId', roomId);
      if (department && department !== 'ALL') params.append('department', department);

      if (auditMode === 'date') {
        const targetDate = fd.get('targetDate');
        if (targetDate) params.append('targetDate', targetDate);
      } else if (auditMode === 'year') {
        const year = fd.get('year');
        if (year) params.append('year', year);
      } else {
        const startDate = fd.get('startDate');
        const endDate = fd.get('endDate');
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
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

      const blob = await res.blob();
      const filename = `room_schedule_audit_${roomId || 'all'}.csv`;
      triggerDownload(blob, filename);
      setAuditStatus({ type: 'success', message: 'Room Schedule & Booking Audit CSV downloaded successfully.' });
    } catch (err) {
      setAuditStatus({ type: 'error', message: err.message || 'An error occurred while downloading audit report.' });
    } finally {
      setAuditLoading(false);
    }
  };

  // 3. Download Room Utilization Summary CSV
  const handleDownloadUtilization = async (e) => {
    e.preventDefault();
    setUtilizationStatus(null);
    setUtilizationLoading(true);

    try {
      const fd = new FormData(e.target);
      const params = new URLSearchParams();

      const startDate = fd.get('startDate');
      const endDate = fd.get('endDate');
      const department = fd.get('department');
      const roomId = fd.get('roomId');

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (department && department !== 'ALL') params.append('department', department);
      if (roomId && roomId !== 'ALL') params.append('roomId', roomId);

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

      const blob = await res.blob();
      triggerDownload(blob, `room_utilization_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
      setUtilizationStatus({ type: 'success', message: 'Room Utilization Summary CSV downloaded successfully.' });
    } catch (err) {
      setUtilizationStatus({ type: 'error', message: err.message || 'An error occurred while downloading utilization report.' });
    } finally {
      setUtilizationLoading(false);
    }
  };

  // 4. Download Detailed Booking Log CSV
  const handleDownloadUsage = async (e) => {
    e.preventDefault();
    setUsageStatus(null);
    setUsageLoading(true);

    try {
      const fd = new FormData(e.target);
      const params = new URLSearchParams();

      const startDate = fd.get('startDate');
      const endDate = fd.get('endDate');
      const department = fd.get('department');
      const roomId = fd.get('roomId');

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (department && department !== 'ALL') params.append('department', department);
      if (roomId && roomId !== 'ALL') params.append('roomId', roomId);

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

      const blob = await res.blob();
      triggerDownload(blob, `room_usage_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
      setUsageStatus({ type: 'success', message: 'Detailed Usage CSV downloaded successfully.' });
    } catch (err) {
      setUsageStatus({ type: 'error', message: err.message || 'An error occurred while downloading report.' });
    } finally {
      setUsageLoading(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  const oneYearAgoStr = new Date(new Date().setFullYear(currentYear - 1)).toISOString().split('T')[0];
  const fiveYearsAgoStr = new Date(new Date().setFullYear(currentYear - 5)).toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* ── CARD 1: Room Schedule & Booking Audit (Out-of-Timetable vs Scheduled Analysis) ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8 max-w-4xl mx-auto ring-1 ring-indigo-500/10">
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Room Schedule & Booking Audit (Out-of-Timetable vs Scheduled Analysis)
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              ⚡ High-Speed O(1) Stream
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Audit room bookings and timetable schedules for any specific room and previous date, year, or 5-year span. Verifies who booked the room, the professor’s branch/department, and automatically flags whether the session was a scheduled class, an authorized free-slot booking, or an out-of-schedule (lunch/after-hours) reservation.
          </p>
        </div>

        {auditStatus && (
          <div
            className={`mb-5 p-3 rounded-lg text-xs flex items-center gap-2 border ${
              auditStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {auditStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{auditStatus.message}</span>
          </div>
        )}

        <form onSubmit={handleDownloadAudit} className="space-y-6">
          {/* Audit Mode Switcher */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 pb-2 border-b border-slate-100">
            <span className="text-slate-400">Filter By:</span>
            <button
              type="button"
              onClick={() => setAuditMode('date')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                auditMode === 'date'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Specific Past Date
            </button>
            <button
              type="button"
              onClick={() => setAuditMode('year')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                auditMode === 'year'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Academic Year (5+ Years)
            </button>
            <button
              type="button"
              onClick={() => setAuditMode('range')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                auditMode === 'range'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Custom Date Range
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Room Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Room Name {roomsLoading && <span className="text-slate-400 font-normal">(Loading...)</span>}
              </label>
              <select
                name="roomId"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-slate-50"
              >
                <option value="ALL">All Rooms</option>
                {roomsList.map((r) => {
                  const id = r._id || r.id;
                  return (
                    <option key={id} value={id}>
                      {r.name} {r.building ? `(${r.building})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department / Branch</label>
              <select
                name="department"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-slate-50"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Date / Year Pickers based on mode */}
            {auditMode === 'date' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Snapshot / Audit Date</label>
                <input
                  type="date"
                  required
                  name="targetDate"
                  defaultValue={todayStr}
                  max={todayStr}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all bg-slate-50"
                />
                <p className="text-[10px] text-slate-400 mt-1">Audit timetable and bookings for this exact day</p>
              </div>
            )}

            {auditMode === 'year' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Academic Year</label>
                <select
                  name="year"
                  defaultValue={currentYear}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-slate-50"
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
                <p className="text-[10px] text-slate-400 mt-1">Full year audit (Jan 01 - Dec 31)</p>
              </div>
            )}

            {auditMode === 'range' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">From Date</label>
                  <input
                    type="date"
                    required
                    name="startDate"
                    defaultValue={fiveYearsAgoStr}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">To Date</label>
                  <input
                    type="date"
                    required
                    name="endDate"
                    defaultValue={todayStr}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all bg-slate-50"
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={auditLoading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              {auditLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Audit Stream...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  Download Room Schedule & Booking Audit CSV
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── CARD 2: Historical Timetable Blueprint ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Historical Timetable Blueprint
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Generate CSV reports of the official timetable plan exactly as it existed on any past date, preserved even if updated later by HODs.
          </p>
        </div>

        {blueprintStatus && (
          <div
            className={`mb-5 p-3 rounded-lg text-xs flex items-center gap-2 border ${
              blueprintStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {blueprintStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{blueprintStatus.message}</span>
          </div>
        )}

        <form onSubmit={handleDownloadBlueprint} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Snapshot Date</label>
              <input
                type="date"
                name="targetDate"
                defaultValue={todayStr}
                max={todayStr}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all bg-slate-50"
              />
              <p className="text-[10px] text-slate-400 mt-1">Timetable state on this day</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department Filter</label>
              <select
                name="department"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-slate-50"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Semester Filter</label>
              <select
                name="semester"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-slate-50"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Room Filter {roomsLoading && <span className="text-slate-400 font-normal">(Loading...)</span>}
              </label>
              <select
                name="roomId"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-slate-50"
              >
                <option value="ALL">All Rooms</option>
                {roomsList.map((r) => {
                  const id = r._id || r.id;
                  return (
                    <option key={id} value={id}>
                      {r.name} {r.building ? `(${r.building})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={blueprintLoading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              {blueprintLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  Download Blueprint CSV
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── CARD 3: Room Utilization Summary (Long-Term Analytics) ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Room Utilization Summary (Long-Term / Multi-Year Analytics)
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              ⚡ Streams 5+ Years Safely
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Aggregated room-by-room utilization analytics over any past period (e.g. 1 year, 5 years, or entire history). Computes total hours utilized, booking counts, average durations, and primary purposes.
          </p>
        </div>

        {utilizationStatus && (
          <div
            className={`mb-5 p-3 rounded-lg text-xs flex items-center gap-2 border ${
              utilizationStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {utilizationStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{utilizationStatus.message}</span>
          </div>
        )}

        <form onSubmit={handleDownloadUtilization} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date Range (Start)</label>
              <input
                type="date"
                required
                name="startDate"
                defaultValue={fiveYearsAgoStr}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-slate-50"
              />
              <p className="text-[10px] text-slate-400 mt-1">Supports any back date (5+ yrs)</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date Range (End)</label>
              <input
                type="date"
                required
                name="endDate"
                defaultValue={todayStr}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department Filter</label>
              <select
                name="department"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none bg-slate-50"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Room Filter {roomsLoading && <span className="text-slate-400 font-normal">(Loading...)</span>}
              </label>
              <select
                name="roomId"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none bg-slate-50"
              >
                <option value="ALL">All Rooms</option>
                {roomsList.map((r) => {
                  const id = r._id || r.id;
                  return (
                    <option key={id} value={id}>
                      {r.name} {r.building ? `(${r.building})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={utilizationLoading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              {utilizationLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Utilization...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  Download Room Utilization CSV
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── CARD 4: Detailed Room Usage Log ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            Actual Room Usage (Detailed Booking Log)
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Generate CSV line-item records of completed and active room bookings. Explicitly filters out cancelled or rejected reservations.
          </p>
        </div>

        {usageStatus && (
          <div
            className={`mb-5 p-3 rounded-lg text-xs flex items-center gap-2 border ${
              usageStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {usageStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{usageStatus.message}</span>
          </div>
        )}

        <form onSubmit={handleDownloadUsage} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date Range (Start)</label>
              <input
                type="date"
                required
                name="startDate"
                defaultValue={oneYearAgoStr}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date Range (End)</label>
              <input
                type="date"
                required
                name="endDate"
                defaultValue={todayStr}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department Filter</label>
              <select
                name="department"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none bg-slate-50"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Room Filter {roomsLoading && <span className="text-slate-400 font-normal">(Loading...)</span>}
              </label>
              <select
                name="roomId"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none bg-slate-50"
              >
                <option value="ALL">All Rooms</option>
                {roomsList.map((r) => {
                  const id = r._id || r.id;
                  return (
                    <option key={id} value={id}>
                      {r.name} {r.building ? `(${r.building})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={usageLoading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              {usageLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  Download Usage CSV
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
