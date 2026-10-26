import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Activity } from 'lucide-react';
import { getAllRoomsStatus } from '../services/api';

export default function ReportGenerator({ departments }) {
  const [adminRoomsList, setAdminRoomsList] = useState([]);

  // Fetch rooms once when component mounts
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await getAllRoomsStatus();
        setAdminRoomsList(res.data?.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchRooms();
  }, []);

  return (
    <div className="space-y-6">
      {/* Timetable Report Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" /> Historical Timetable Blueprint
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Generate CSV reports of the official timetable plan exactly as it existed on any past date.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const params = new URLSearchParams();
            if (fd.get('targetDate')) params.append('targetDate', fd.get('targetDate'));
            if (fd.get('department')) params.append('department', fd.get('department'));
            if (fd.get('roomId')) params.append('roomId', fd.get('roomId'));
            if (fd.get('semester')) params.append('semester', fd.get('semester'));
            const token = localStorage.getItem('token');
            fetch(`/api/timetable/report/csv?${params.toString()}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((res) => {
                if (!res.ok) throw new Error('Failed to generate report');
                return res.blob();
              })
              .then((blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `timetable_blueprint_${fd.get('targetDate') || 'current'}.csv`;
                a.click();
              })
              .catch((err) => alert(err.message));
          }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Snapshot Date</label>
              <input
                type="date"
                name="targetDate"
                defaultValue={new Date().toISOString().split('T')[0]}
                max={new Date().toISOString().split('T')[0]}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-mac-blue/20 outline-none transition-all bg-slate-50"
              />
              <p className="text-[10px] text-slate-400 mt-1">See timetable as it existed on this day</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department Filter</label>
              <select name="department" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-mac-blue/20 outline-none bg-slate-50">
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
              <select name="semester" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-mac-blue/20 outline-none bg-slate-50">
                <option value="ALL">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    {s}th Semester
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Room Filter</label>
              <select name="roomId" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-mac-blue/20 outline-none bg-slate-50">
                <option value="ALL">All Rooms</option>
                {adminRoomsList.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Download Blueprint CSV
            </button>
          </div>
        </form>
      </div>

      {/* Actual Room Usage Report Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" /> Actual Room Usage (Bookings)
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Generate CSV reports of completed and active room bookings. This explicitly filters out cancelled or rejected reservations to show who actually used the rooms.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const params = new URLSearchParams();
            if (fd.get('startDate')) params.append('startDate', fd.get('startDate'));
            if (fd.get('endDate')) params.append('endDate', fd.get('endDate'));
            if (fd.get('department')) params.append('department', fd.get('department'));
            const token = localStorage.getItem('token');
            fetch(`/api/bookings/report/csv?${params.toString()}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((res) => {
                if (!res.ok) throw new Error('Failed to generate report');
                return res.blob();
              })
              .then((blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `room_usage_${fd.get('startDate')}_to_${fd.get('endDate')}.csv`;
                a.click();
              })
              .catch((err) => alert(err.message));
          }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date Range (Start)</label>
              <input
                type="date"
                required
                name="startDate"
                defaultValue={new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date Range (End)</label>
              <input
                type="date"
                required
                name="endDate"
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department Filter</label>
              <select name="department" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none bg-slate-50">
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Download Usage CSV
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
