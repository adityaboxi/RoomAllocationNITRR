import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  Loader2,
  CheckCircle2,
  Wrench,
  Tv,
  Wind,
  Mic,
  Sparkles,
  Zap,
} from 'lucide-react';
import { reportRoomIssue } from '../services/api';

const ISSUE_PRESETS = [
  { label: 'Projector Down / Blurry', value: 'Projector Down', icon: Tv },
  { label: 'AC Not Cooling / Off', value: 'AC Not Working', icon: Wind },
  { label: 'Mic / Audio Malfunction', value: 'Audio / Mic Issue', icon: Mic },
  { label: 'Power Socket / Lighting', value: 'Power / Lighting', icon: Zap },
  { label: 'Cleanliness / Furniture', value: 'Cleanliness / Maintenance', icon: Sparkles },
  { label: 'Other Equipment Issue', value: 'Other', icon: Wrench },
];

export default function ReportIssueModal({ isOpen, onClose, room, onIssueReported }) {
  const [selectedIssue, setSelectedIssue] = useState(ISSUE_PRESETS[0].value);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !room) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const roomId = room._id || room.id;
      const res = await reportRoomIssue(roomId, {
        issueType: selectedIssue,
        description: description.trim(),
      });

      setSuccess(true);
      if (typeof onIssueReported === 'function') {
        onIssueReported(res?.data || res);
      }
      setTimeout(() => {
        setSuccess(false);
        setDescription('');
        onClose();
      }, 1800);
    } catch (err) {
      setError(err.message || 'Failed to submit equipment report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-amber-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Report Classroom Hardware Issue</h2>
              <p className="text-xs text-slate-400">{room.name} ({room.building})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {success ? (
            <div className="py-6 text-center space-y-2 animate-in zoom-in-95 duration-200">
              <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Issue Flagged & Alert Dispatched</h3>
              <p className="text-xs text-slate-400">
                Department maintenance and future faculty booking this room will be notified.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Select Malfunctioning Equipment:</label>
                <div className="grid grid-cols-2 gap-2">
                  {ISSUE_PRESETS.map((p) => {
                    const Icon = p.icon;
                    const isSelected = selectedIssue === p.value;
                    return (
                      <button
                        type="button"
                        key={p.value}
                        onClick={() => setSelectedIssue(p.value)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{p.value}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Specific Details (Optional):</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. HDMI cable missing, display flickers intermittently..."
                  rows={3}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20 flex items-center gap-1.5 transition"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  Submit Report
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
