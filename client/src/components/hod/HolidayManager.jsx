import React, { useState, useEffect } from 'react';
import { getHolidays, createHoliday, updateHoliday, deleteHoliday } from '../../services/api';
import { getSocket } from '../../services/socket';
import {
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Palmtree,
  Calendar,
  Landmark,
  Zap,
} from 'lucide-react';

const extractErrorMessage = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err.response?.data?.message || err.message || fallback;
};

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function HolidayManager({ user }) {
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const todayStr = getTodayDateString();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  
  const initialFormState = {
    title: '',
    date: todayStr,
    type: isAdmin ? 'NATIONAL' : 'EMERGENCY', // 'NATIONAL' | 'EMERGENCY'
    description: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchHolidaysList();

    const socket = getSocket();
    if (!socket) return;

    const handleHolidayLiveSync = () => {
      fetchHolidaysList();
    };

    socket.on('holiday-added', handleHolidayLiveSync);
    socket.on('holiday-deleted', handleHolidayLiveSync);
    socket.on('holiday-updated', handleHolidayLiveSync);

    return () => {
      socket.off('holiday-added', handleHolidayLiveSync);
      socket.off('holiday-deleted', handleHolidayLiveSync);
      socket.off('holiday-updated', handleHolidayLiveSync);
    };
  }, [user?.department]);

  const fetchHolidaysList = async () => {
    setLoading(true);
    try {
      const data = await getHolidays({ department: user?.department });
      setHolidays(data?.data || []);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to load department holidays.');
      console.error('❌ [HOLIDAY] Failed to load holidays:', errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const trimmedTitle = (formData.title || '').trim();
    if (!trimmedTitle || !formData.date) {
      setError('Please provide Holiday Title and Date.');
      return;
    }

    if (trimmedTitle.length < 2) {
      setError('Holiday title must be at least 2 characters long.');
      return;
    }

    if (trimmedTitle.length > 100) {
      setError('Holiday title cannot exceed 100 characters.');
      return;
    }

    const trimmedDesc = (formData.description || '').trim();
    if (trimmedDesc.length > 500) {
      setError('Holiday description cannot exceed 500 characters.');
      return;
    }

    if (formData.date < todayStr) {
      setError('Cannot declare a holiday for a past date.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    console.log(`🏖️  [HOLIDAY] Submitting holiday: "${formData.title}" on ${formData.date}`);

    try {
      const payload = {
        title: formData.title.trim(),
        date: formData.date,
        type: formData.type,
        description:
          formData.description.trim() ||
          (formData.type === 'NATIONAL' ? 'National / Annual Holiday' : 'Emergency / Local Holiday'),
      };

      const res = await createHoliday(payload);
      console.log(`✅ [HOLIDAY] Holiday "${formData.title}" declared`);
      setSuccess(res.message || `Holiday "${formData.title}" declared successfully!`);
      setFormData({ title: '', date: '', type: isAdmin ? 'NATIONAL' : 'EMERGENCY', description: '' });
      await fetchHolidaysList();
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to save holiday details.');
      console.error('❌ [HOLIDAY] Save holiday failed:', errMsg);
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (holiday) => {
    if (deletingId) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to remove the holiday "${holiday.title}" on ${holiday.date}?\n\nClassrooms and timetables will become available again.`
    );
    if (!confirmDelete) return;

    const holidayId = holiday.id || holiday._id;
    setDeletingId(holidayId);
    setError('');
    setSuccess('');
    console.log(`🗑️  [HOLIDAY] Revoking holiday: "${holiday.title}" (${holiday.date})`);

    try {
      await deleteHoliday(holidayId);
      console.log(`✅ [HOLIDAY] Holiday "${holiday.title}" revoked successfully`);
      setSuccess(`Holiday "${holiday.title}" removed successfully.`);

      await fetchHolidaysList();
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to remove holiday.');
      console.error('❌ [HOLIDAY] Delete failed:', errMsg);
      setError(errMsg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {error && (
        <div className="px-5 py-3 bg-white border border-mac-border rounded-lg flex items-start text-rose-800 text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 mr-2.5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 whitespace-pre-line">{error}</div>
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
        {/* Left Column: Form */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg px-8 py-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-mac-bg text-mac-blue flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-mac-text">
                'Declare Holiday / Closure'
              </h3>
            </div>
            
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fixed Holiday Type based on Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Holiday Category *
              </label>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                {isAdmin ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                    <Landmark className="w-4 h-4 text-mac-blue" />
                    <span>National / Fixed (Global College-Wide)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-950">
                    <Zap className="w-4 h-4 text-rose-600" />
                    <span>Emergency / Local (Department-Wise)</span>
                  </div>
                )}
                <span className="text-[10px] text-mac-subtext font-medium px-2 py-1 bg-white border border-slate-200 rounded">
                  {isAdmin ? 'Locks all rooms across the institution' : 'Locks all rooms in your department'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Holiday Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder={
                  formData.type === 'NATIONAL'
                    ? 'e.g. Independence Day, Republic Day'
                    : 'e.g. Weather Alert, Campus Maintenance'
                }
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-mac-blue outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date *</label>
              <input
                type="date"
                name="date"
                min={todayStr}
                value={formData.date}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-mac-blue outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Description / Details (Optional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                placeholder="e.g. All lectures and lab sessions suspended"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-mac-blue outline-none transition-all resize-none"
              />
            </div>

            <div className="p-3 bg-white border border-mac-border rounded-lg text-[11px] text-amber-800 leading-relaxed">
              <strong>Impact:</strong> Declaring or updating this holiday will mark all rooms in {user?.department} as closed and automatically cancel conflicting bookings with email notices.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-mac-blue text-white py-2.5 px-4 rounded-lg text-sm font-bold hover:bg-mac-blue-hover transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Holiday...</span>
                </>
              ) : (
                <span>'Declare Holiday'</span>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Table */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palmtree className="w-5 h-5 text-mac-blue" />
              <h3 className="text-base font-bold text-mac-text">
                {isAdmin ? `Institutional Holidays (${holidays.length})` : `Department Holidays (${holidays.length})`}
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-mac-blue" />
                <span>Loading holidays...</span>
              </div>
            ) : holidays.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No holidays declared for your department.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Holiday & Type
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Date & Cycle
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Scope
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {holidays.map((h) => {
                    const holidayId = h.id || h._id;
                    const isDeleting = deletingId === holidayId;
                    const isNational = h.type === 'NATIONAL' || h.isRecurring;
                    const isPast = h.date < todayStr;

                    return (
                      <tr key={holidayId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 text-sm">
                          <div className="font-bold text-mac-text flex items-center gap-1.5">
                            <span>{h.title}</span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                isNational
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isNational ? 'National / Fixed' : 'Emergency'}
                            </span>
                          </div>
                          {h.description && (
                            <div className="text-xs text-slate-400 mt-0.5">{h.description}</div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-sm">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{h.date}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {isNational
                              ? 'Repeats Annually (Month-Day)'
                              : isPast
                              ? 'Passed (Auto-pruning)'
                              : 'One-time only'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-sm">
                          <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                            {h.department === 'ALL' ? 'Institute-Wide' : h.department}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-sm text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {(isAdmin || h.department !== 'ALL') && (
                              <>
                                <button
                              type="button"
                              onClick={() => handleEditClick(h)}
                              className="p-1.5 text-mac-subtext hover:text-mac-blue hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit / Reschedule Holiday"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(h)}
                              disabled={isDeleting}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                              title="Remove Holiday"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}