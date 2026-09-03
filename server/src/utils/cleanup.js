const mongoose = require('mongoose');
const OTP = require('../models/OTP');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Timetable = require('../models/Timetable');
const Review = require('../models/Review');
const Holiday = require('../models/Holiday');
const { getTodayDateString, getCurrentTimeHHMM } = require('./helpers');

let cleanupTimer = null;

const runDatabaseCleanup = async () => {
  const now = new Date();
  const todayStr = getTodayDateString();
  const currentHHMM = getCurrentTimeHHMM();

  const cancelledDays = parseInt(process.env.PRUNE_CANCELLED_BOOKINGS_DAYS, 10) || 7;
  const completedDays = parseInt(process.env.PRUNE_COMPLETED_BOOKINGS_DAYS, 10) || 90;
  const reviewDays = parseInt(process.env.PRUNE_REVIEWS_DAYS, 10) || 90;
  const readNotifDays = parseInt(process.env.PRUNE_READ_NOTIFICATIONS_DAYS, 10) || 7;
  const unreadNotifDays = parseInt(process.env.PRUNE_UNREAD_NOTIFICATIONS_DAYS, 10) || 30;
  const otpHours = parseInt(process.env.PRUNE_OTP_HOURS, 10) || 24;

  const cancelledCutoff = new Date(now.getTime() - cancelledDays * 24 * 60 * 60 * 1000);
  const completedCutoff = new Date(now.getTime() - completedDays * 24 * 60 * 60 * 1000);
  const reviewCutoff = new Date(now.getTime() - reviewDays * 24 * 60 * 60 * 1000);
  const readNotifCutoff = new Date(now.getTime() - readNotifDays * 24 * 60 * 60 * 1000);
  const unreadNotifCutoff = new Date(now.getTime() - unreadNotifDays * 24 * 60 * 60 * 1000);
  const otpCutoff = new Date(now.getTime() - otpHours * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const cancelledCutoffStr = cancelledCutoff.toISOString().split('T')[0];
  const completedCutoffStr = completedCutoff.toISOString().split('T')[0];

  try {
    console.log(`🧹 [CLEANUP] Running database pruning at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);

    // 0. Auto-complete past active bookings
    const autoCompleted = await Booking.updateMany(
      {
        status: 'active',
        purpose: { $ne: 'TEMPORARY_LOCK' },
        $or: [
          { date: { $lt: todayStr } },
          { date: todayStr, endTime: { $lte: currentHHMM } },
        ],
      },
      { $set: { status: 'completed' } }
    );
    if (autoCompleted.modifiedCount > 0) {
      console.log(`🧹 [CLEANUP] Auto-completed ${autoCompleted.modifiedCount} past bookings`);
    }

    // 1. Delete Old Reviews (> 90 days)
    const deletedReviews = await Review.deleteMany({ createdAt: { $lt: reviewCutoff } });

    // 2. Protected booking IDs
    const activeReviewedBookingIds = await Review.distinct('bookingId');
    const recentNotifBookingIds = await Notification.distinct('metadata.bookingId', {
      createdAt: { $gte: cancelledCutoff },
      'metadata.bookingId': { $exists: true, $ne: null },
    });

    const protectedIdsSet = new Set([
      ...activeReviewedBookingIds.map((id) => id.toString()),
      ...recentNotifBookingIds.map((id) => id.toString()),
    ]);

    const protectedBookingObjectIds = Array.from(protectedIdsSet)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      // 3. Delete verified / expired OTPs (> 24h)
      OTP.deleteMany({ createdAt: { $lt: otpCutoff }, verified: true }),
      // 4. Delete abandoned checkout locks older than 1h
      Booking.deleteMany({ purpose: 'TEMPORARY_LOCK', createdAt: { $lt: oneHourAgo } }),
      // 5. Delete read notifications (> 7 days)
      Notification.deleteMany({ read: true, createdAt: { $lt: readNotifCutoff } }),
      // 6. Delete unread notifications (> 30 days)
      Notification.deleteMany({ read: false, createdAt: { $lt: unreadNotifCutoff } }),
      // 7. Delete old cancelled bookings (> 7 days)
      Booking.deleteMany({ status: 'cancelled', date: { $lt: cancelledCutoffStr }, _id: { $nin: protectedBookingObjectIds } }),
      // 8. Delete old completed bookings (> 90 days)
      Booking.deleteMany({ status: 'completed', date: { $lt: completedCutoffStr }, _id: { $nin: protectedBookingObjectIds } }),
      // 9. Delete decommissioned timetable slots
      Timetable.deleteMany({ isActive: false, updatedAt: { $lt: cancelledCutoff } }),
    ]);

    // 10. Delete ONLY Emergency/One-time holidays older than 90 days
    const r8 = await Holiday.deleteMany({
      isRecurring: false,
      type: 'EMERGENCY',
      date: { $lt: completedCutoffStr },
    });

    console.log(`🧹 [CLEANUP] Complete — OTPs: ${r1.deletedCount} | Locks: ${r2.deletedCount} | ReadNotifs: ${r3.deletedCount} | UnreadNotifs: ${r4.deletedCount} | CancelledBookings: ${r5.deletedCount} | CompletedBookings: ${r6.deletedCount} | Timetables: ${r7.deletedCount} | Holidays: ${r8.deletedCount} | Reviews: ${deletedReviews.deletedCount}`);
  } catch (error) {
    console.error('❌ [CLEANUP] Database pruning error:', error.message);
  }
};

const startCleanupScheduler = () => {
  setTimeout(() => {
    runDatabaseCleanup();
  }, 10000);

  const intervalHours = parseInt(process.env.CLEANUP_CRON_INTERVAL_HOURS, 10) || 24;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  cleanupTimer = setInterval(() => {
    runDatabaseCleanup();
  }, intervalMs);
};

const stopCleanupScheduler = () => {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
};

module.exports = {
  runDatabaseCleanup,
  startCleanupScheduler,
  stopCleanupScheduler,
};