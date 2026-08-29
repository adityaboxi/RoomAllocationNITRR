import React, { useState, useEffect } from 'react';
import { getHolidays, createHoliday, updateHoliday, deleteHoliday } from '../../services/api';
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
  const todayStr = getTodayDateString();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingHoliday, setEditingHoliday] = useState(null);

  const initialFormState = {
    title: '',
    date: todayStr,
    type: 'NATIONAL', // 'NATIONAL' | 'EMERGENCY'
    description: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchHolidaysList();
  }, [user?.department]);

  const fetchHolidaysList = async () => {
    setLoading(true);
    try {
      const data = await getHolidays({ department: user?.department });
      setHolidays(data?.data || []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load department holidays.'));
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

  const handleEditClick = (holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      title: holiday.title || '',
      date: holiday.date || todayStr,
      type: holiday.type || 'NATIONAL',
      description: holiday.description || '',
    });
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingHoliday(null);
    setFormData(initialFormState);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.date) {
      setError('Please provide Holiday Title and Date.');
      return;
    }

    if (formData.date < todayStr) {
      setError('Cannot declare a holiday for a past date.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        title: formData.title.trim(),
        date: formData.date,
        type: formData.type,
        description:
          formData.description.trim() ||
          (formData.type === 'NATIONAL' ? 'National / Annual Holiday' : 'Emergency / Local Holiday'),
      };

      if (editingHoliday) {
        const id = editingHoliday.id || editingHoliday._id;
        const res = await updateHoliday(id, payload);
        setSuccess(res.message || `Holiday "${formData.title}" updated successfully!`);
      } else {
        const res = await createHoliday(payload);
        setSuccess(res.message || `Holiday "${formData.title}" declared successfully!`);
      }

      handleCancelEdit();
      await fetchHolidaysList();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save holiday details.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (holiday) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to remove the holiday "${holiday.title}" on ${holiday.date}?\n\nClassrooms and timetables will become available again.`
    );
    if (!confirmDelete) return;

    const holidayId = holiday.id || holiday._id;
    setDeletingId(holidayId);
    setError('');
    setSuccess('');

    try {
      await deleteHoliday(holidayId);
      setSuccess(`Holiday "${holiday.title}" removed successfully.`);
      if (editingHoliday && (editingHoliday.id === holidayId || editingHoliday._id === holidayId)) {
        handleCancelEdit();
      }
      await fetchHolidaysList();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to remove holiday.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start text-rose-800 text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 mr-2.5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 whitespace-pre-line">{error}</div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start text-emerald-800 text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 mr-2.5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{success}</div>
          <button type="button" onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                {editingHoliday ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {editingHoliday ? 'Edit Holiday' : 'Declare Holiday / Closure'}
              </h3>
            </div>
            {editingHoliday && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Holiday Type Selector (National vs Emergency) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Holiday Category *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, type: 'NATIONAL' }))}
                  className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    formData.type === 'NATIONAL'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                    <span>National / Fixed</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Repeats annually (Never pruned)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, type: 'EMERGENCY' }))}
                  className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    formData.type === 'EMERGENCY'
                      ? 'border-amber-600 bg-amber-50/70 text-amber-950 shadow-sm ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    <span>Emergency / Local</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">
                    One-time date (Pruned in 90d)
                  </span>
                </button>
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
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
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
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
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
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all resize-none"
              />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-800 leading-relaxed">
              <strong>Impact:</strong> Declaring or updating this holiday will mark all rooms in {user?.department} as closed and automatically cancel conflicting bookings with email notices.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Holiday...</span>
                </>
              ) : (
                <span>{editingHoliday ? 'Update Holiday' : 'Declare Holiday'}</span>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Table */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palmtree className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                Department Holidays ({holidays.length})
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
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
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
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
                            <button
                              type="button"
                              onClick={() => handleEditClick(h)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
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