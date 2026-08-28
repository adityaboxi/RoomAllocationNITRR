import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAll,
} from '../services/api';
import { formatDate } from '../utils/helpers';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ArrowLeft,
  CalendarX,
  CheckCircle2,
  Calendar,
  AlertCircle,
  X,
  Inbox,
} from 'lucide-react';

export default function NotificationCenter({
  user,
  notifications = [],
  setNotifications,
  onRefresh,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, []);

  // Optimistic Single Mark As Read
  const handleMarkRead = async (id) => {
    if (setNotifications) {
      setNotifications((prev) =>
        prev.map((n) => ((n.id === id || n._id === id) ? { ...n, read: true } : n))
      );
    }

    try {
      await markAsRead(id);
    } catch (err) {
      setError(err.message || 'Failed to update notification status');
      if (onRefresh) onRefresh();
    }
  };

  // Optimistic Mark All As Read
  const handleMarkAllRead = async () => {
    if (setNotifications) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }

    try {
      await markAllAsRead();
    } catch (err) {
      setError(err.message || 'Failed to mark all as read');
      if (onRefresh) onRefresh();
    }
  };

  // Optimistic Delete Single Notification
  const handleDelete = async (id) => {
    if (setNotifications) {
      setNotifications((prev) => prev.filter((n) => n.id !== id && n._id !== id));
    }

    try {
      await deleteNotification(id);
    } catch (err) {
      setError(err.message || 'Failed to delete notification');
      if (onRefresh) onRefresh();
    }
  };

  // Optimistic Delete All Notifications
  const handleDeleteAll = async () => {
    const confirmDelete = window.confirm('Are you sure you want to clear your notification history?');
    if (!confirmDelete) return;

    if (setNotifications) {
      setNotifications([]);
    }

    try {
      await deleteAll();
    } catch (err) {
      setError(err.message || 'Failed to delete notifications');
      if (onRefresh) onRefresh();
    }
  };

  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n) => !n.read).length
    : 0;

  const renderTypeIcon = (type) => {
    switch (type) {
      case 'booking-cancelled':
        return <CalendarX className="w-4 h-4 text-rose-600" />;
      case 'booking-confirmed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'timetable-updated':
        return <Calendar className="w-4 h-4 text-indigo-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <Link
            to="/"
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>Notifications Inbox</span>
              {unreadCount > 0 && (
                <span className="text-xs font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">Activity updates & class schedule notices</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAll}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 px-3.5 py-2 rounded-xl hover:bg-rose-100 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start text-rose-800 text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 mr-2 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading your inbox...</div>
      ) : notifications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-400">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700 text-sm">Your inbox is completely clear.</p>
          <p className="text-xs text-slate-400 mt-1">
            New booking confirmations or schedule notices will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const notifId = n.id || n._id;
            return (
              <div
                key={notifId}
                className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-sm flex items-start justify-between gap-4 transition-all ${
                  !n.read
                    ? 'border-l-4 border-l-indigo-600 border-slate-200 bg-indigo-50/20 shadow-md'
                    : 'border-slate-200 opacity-90'
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 rounded-xl bg-slate-100 flex-shrink-0 mt-0.5">
                    {renderTypeIcon(n.type)}
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900 leading-snug">{n.message}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5">
                      <span>{formatDate(n.createdAt)}</span>
                      {n.metadata?.roomName && (
                        <span>• Room: <strong className="text-slate-600">{n.metadata.roomName}</strong></span>
                      )}
                      {n.metadata?.date && (
                        <span>• Date: <strong className="text-slate-600">{n.metadata.date}</strong></span>
                      )}
                      {n.metadata?.startTime && n.metadata?.endTime && (
                        <span>• Time: <strong className="text-slate-600">{n.metadata.startTime} - {n.metadata.endTime}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(notifId)}
                      className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                      title="Mark as Read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(notifId)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Delete Notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}