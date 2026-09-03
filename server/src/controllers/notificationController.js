const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// ---------- GET NOTIFICATIONS ----------
exports.getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user._id || req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: req.user._id || req.user.id }),
      Notification.countDocuments({ userId: req.user._id || req.user.id, read: false }),
    ]);

    const formatted = notifications.map((n) => ({
      ...n,
      id: n._id.toString(),
    }));

    res.json({
      success: true,
      data: formatted,
      total,
      unreadCount,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error("❌ [NOTIFICATION]", 'Get notifications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- MARK SINGLE AS READ ----------
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID format' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id || req.user.id },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read', data: notification });
  } catch (error) {
    console.error("❌ [NOTIFICATION]", 'Mark notification as read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- MARK ALL AS READ ----------
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id || req.user.id, read: false },
      { $set: { read: true } }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("❌ [NOTIFICATION]", 'Mark all notifications read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- DELETE SINGLE NOTIFICATION ----------
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID format' });
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.user._id || req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error("❌ [NOTIFICATION]", 'Delete notification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- DELETE ALL NOTIFICATIONS ----------
exports.deleteAll = async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      userId: req.user._id || req.user.id,
    });

    res.json({
      success: true,
      message: 'All notifications deleted successfully',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ [NOTIFICATION]", 'Delete all notifications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};