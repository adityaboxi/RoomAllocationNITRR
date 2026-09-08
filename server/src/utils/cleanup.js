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

  const cancelledDays = parseInt(process.env.PRUNE_CANCELLED_BOOKINGS_DAYS, 10) || 90;
  const completedDays = parseInt(process.env.PRUNE_COMPLETED_BOOKINGS_DAYS, 10) || 90;
  const reviewDays = parseInt(process.env.PRUNE_REVIEWS_DAYS, 10) || 90;
  const readNotifDays = parseInt(process.env.PRUNE_READ_NOTIFICATIONS_DAYS, 10) || 90;
  const unreadNotifDays = parseInt(process.env.PRUNE_UNREAD_NOTIFICATIONS_DAYS, 10) || 90;
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

    // 1. RELATIONAL INTEGRITY PROTECTION:
    // Identify all Bookings that are recent (< 90 days old) or active.
    // Any Review linked to a recent or active booking MUST NOT be deleted!
    const recentBookingIds = await Booking.distinct('_id', {
      $or: [
        { date: { $gte: completedCutoffStr } },
        { createdAt: { $gte: completedCutoff } },
        { status: 'active' },
      ],
    });
    const recentBookingIdsSet = new Set(recentBookingIds.map((id) => id.toString()));

    // 2. Prune Old Reviews (> 90 days) ONLY IF their related booking is NOT recent/active
    const candidateOldReviews = await Review.find({ createdAt: { $lt: reviewCutoff } }).select('_id bookingId');
    const reviewIdsToDelete = candidateOldReviews
      .filter((r) => !recentBookingIdsSet.has(r.bookingId?.toString()))
      .map((r) => r._id);

    const deletedReviews = await Review.deleteMany({ _id: { $in: reviewIdsToDelete } });

    // 3. BIDIRECTIONAL RELATIONAL INTEGRITY: Protected Booking IDs
    // (a) Protect any booking that has a Review remaining in the database
    const activeReviewedBookingIds = await Review.distinct('bookingId');
    // (b) Protect any booking referenced in recent Notifications (< 90 days old)
    const recentNotifBookingIds = await Notification.distinct('metadata.bookingId', {
      createdAt: { $gte: cancelledCutoff },
      'metadata.bookingId': { $exists: true, $ne: null },
    });

    const protectedIdsSet = new Set([
      ...activeReviewedBookingIds.map((id) => id.toString()),
      ...recentNotifBookingIds.map((id) => id.toString()),
      ...recentBookingIdsSet,
    ]);

    const protectedBookingObjectIds = Array.from(protectedIdsSet)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      // 4. Delete verified / expired OTPs (> 24h)
      OTP.deleteMany({ createdAt: { $lt: otpCutoff }, verified: true }),
      // 5. Delete abandoned checkout locks older than 1h
      Booking.deleteMany({ purpose: 'TEMPORARY_LOCK', createdAt: { $lt: oneHourAgo } }),
      // 6. Delete read notifications (> 90 days)
      Notification.deleteMany({ read: true, createdAt: { $lt: readNotifCutoff } }),
      // 7. Delete unread notifications (> 90 days)
      Notification.deleteMany({ read: false, createdAt: { $lt: unreadNotifCutoff } }),
      // 8. Delete old cancelled bookings (> 90 days, with relational protection)
      Booking.deleteMany({
        status: 'cancelled',
        date: { $lt: cancelledCutoffStr },
        _id: { $nin: protectedBookingObjectIds },
      }),
      // 9. Delete old completed bookings (> 90 days, with relational protection)
      Booking.deleteMany({
        status: 'completed',
        date: { $lt: completedCutoffStr },
        _id: { $nin: protectedBookingObjectIds },
      }),
      // 10. Delete decommissioned timetable slots (> 90 days inactive)
      Timetable.deleteMany({ isActive: false, updatedAt: { $lt: cancelledCutoff } }),
    ]);

    // 11. Delete ONLY Emergency/One-time holidays older than 90 days
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