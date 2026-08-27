import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, deleteAll } from '../services/api';
import { formatDate } from '../utils/helpers';
import { Bell, Check, Trash2, ArrowLeft } from 'lucide-react';

export default function NotificationCenter({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await markAsRead(id);
      fetchNotifications();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      fetchNotifications();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notification?')) return;
    try {
      await deleteNotification(id);
      fetchNotifications();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete all notifications?')) return;
    try {
      await deleteAll();
      fetchNotifications();
    } catch (err) {
      setError(err.message);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notifications {unreadCount > 0 && <span className="text-sm font-normal text-rose-500">({unreadCount} unread)</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={handleDeleteAll} className="text-sm bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700">
              Delete all
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-rose-50 text-rose-800 p-3 rounded mb-4">{error}</div>}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : notifications.length === 0 ? (
        <p className="text-slate-500">No notifications.</p>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start justify-between ${!n.read ? 'border-l-4 border-indigo-600' : ''}`}>
              <div className="flex-1">
                <p className="text-sm text-slate-800">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{formatDate(n.createdAt)}</p>
                {n.metadata && (
                  <div className="text-xs text-slate-500 mt-1">
                    {n.metadata.roomName && <span>Room: {n.metadata.roomName}</span>}
                    {n.metadata.date && <span className="ml-2">Date: {n.metadata.date}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                {!n.read && (
                  <button onClick={() => handleMarkRead(n.id)} className="text-indigo-600 hover:text-indigo-800" title="Mark as read">
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => handleDelete(n.id)} className="text-rose-600 hover:text-rose-800" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}