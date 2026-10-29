import React, { useState, useEffect } from 'react';
import {
  Zap,
  Clock,
  Building2,
  Users,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
  Download,
  Sparkles,
} from 'lucide-react';
import { getInstantAvailableRooms, createBooking } from '../services/api';
import { getGoogleCalendarUrl, downloadIcsFile } from '../utils/calendarHelper';

export default function InstantRoomFinderModal({ isOpen, onClose, user, onBookingSuccess }) {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(60); // 60 mins default
  const [bookingInProgress, setBookingInProgress] = useState(null);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [purpose, setPurpose] = useState('Remedial / Extra Lecture');
  const [error, setError] = useState('');

  const fetchFreeRooms = async (duration = selectedDuration) => {
    setLoading(true);
    setError('');
    try {
      const res = await getInstantAvailableRooms({
        department: user?.department || '',
        duration,
      });
      if (res?.data) {
        setRooms(res.data.data || []);
        setMeta({
          date: res.data.date,
          day: res.data.day,
          startTime: res.data.startTime,
          endTime: res.data.endTime,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to search instant available classrooms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setConfirmedBooking(null);
      setError('');
      fetchFreeRooms(selectedDuration);
    }
  }, [isOpen]);

  const handleDurationChange = (dur) => {
    setSelectedDuration(dur);
    fetchFreeRooms(dur);
  };

  const handleQuickBook = async (room) => {
    if (!meta) return;
    setBookingInProgress(room._id || room.id);
    setError('');

    try {
      const payload = {
        roomId: room._id || room.id,
        date: meta.date,
        day: meta.day,
        startTime: meta.startTime,
        endTime: meta.endTime,
        purpose: purpose.trim() || 'Instant Academic Session',
        comment: 'Booked via Instant Room Finder',
      };

      const res = await createBooking(payload);
      const bookingData = res?.data || {
        ...payload,
        roomName: room.name,
        building: room.building,
        floor: room.floor,
        facultyName: user?.name,
      };

      setConfirmedBooking(bookingData);
      if (typeof onBookingSuccess === 'function') {
        onBookingSuccess(bookingData);
      }
    } catch (err) {
      setError(err.message || 'Failed to book room instantly. It may have just been reserved.');
      fetchFreeRooms();
    } finally {
      setBookingInProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border-b border-slate-800 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Instant Room Finder
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live Free Now
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically finds vacant classrooms right now without timetable or booking clashes.
              </p>
            </div>
          </div>

          {/* Time & Duration bar */}
          {meta && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-mono">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Slot: <strong>{meta.startTime}</strong> - <strong>{meta.endTime}</strong> (Today)</span>
              </div>

              {/* Duration selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">Duration:</span>
                {[30, 60, 90].map((dur) => (
                  <button
                    key={dur}
                    onClick={() => handleDurationChange(dur)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                      selectedDuration === dur
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {dur}m
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Booking Confirmation Success Card */}
          {confirmedBooking ? (
            <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Classroom Reserved Successfully!</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Room <strong>{confirmedBooking.roomName || 'Classroom'}</strong> is now locked for your session today from {confirmedBooking.startTime} to {confirmedBooking.endTime}.
                </p>
              </div>

              {/* 1-Click Calendar Sync Actions */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={getGoogleCalendarUrl(confirmedBooking)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-md shadow-blue-500/20"
                >
                  <Calendar className="w-3.5 h-3.5" /> Add to Google Calendar
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>

                <button
                  onClick={() => downloadIcsFile(confirmedBooking)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" /> Export iCal (.ics)
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="text-xs text-slate-400 hover:text-slate-200 font-medium underline"
                >
                  Done & Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Optional Purpose Input */}
              <div className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-xs font-medium text-slate-400 whitespace-nowrap">Session Purpose:</span>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Remedial Class, Quiz, Guest Lecture"
                  className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Room Cards List */}
              {loading ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  <p className="text-xs font-medium">Scanning live timetable and active bookings...</p>
                </div>
              ) : rooms.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <AlertCircle className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-sm font-semibold text-slate-400">All classrooms are currently occupied</p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Classes or scheduled reservations are in session for this timeslot. Try adjusting duration to 30m.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                    <span>Available Right Now ({rooms.length})</span>
                    <span className="text-[11px] text-slate-500">Sorted by department proximity</span>
                  </div>

                  {rooms.map((room) => {
                    const isDeptMatch = room.department === user?.department;
                    const isBooking = bookingInProgress === (room._id || room.id);

                    return (
                      <div
                        key={room._id || room.id}
                        className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                          isDeptMatch
                            ? 'bg-blue-950/20 border-blue-500/30 hover:border-blue-500/50'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-white">{room.name}</span>
                            {isDeptMatch && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                My Department
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300">
                              {room.type}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {room.building}, {room.floor}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-500" />
                              Capacity: {room.capacity}
                            </span>
                            {room.hasProjector && <span className="text-emerald-400 text-[10px]">📽️ Projector</span>}
                            {room.hasAC && <span className="text-cyan-400 text-[10px]">❄️ AC</span>}
                          </div>
                        </div>

                        <button
                          onClick={() => handleQuickBook(room)}
                          disabled={Boolean(bookingInProgress)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
                            isBooking
                              ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 active:scale-95'
                          }`}
                        >
                          {isBooking ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Locking...
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5 fill-white" /> Quick Book
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
