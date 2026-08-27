const mongoose = require('mongoose');
const OTP = require('../models/OTP');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Timetable = require('../models/Timetable');
const Review = require('../models/Review');

const runDatabaseCleanup = async () => {
  const now = new Date();

  // Read configurable thresholds from .env with robust fallbacks
  const cancelledDays = parseInt(process.env.PRUNE_CANCELLED_BOOKINGS_DAYS, 10) || 7;
  const readNotifDays = parseInt(process.env.PRUNE_READ_NOTIFICATIONS_DAYS, 10) || 7;
  const unreadNotifDays = parseInt(process.env.PRUNE_UNREAD_NOTIFICATIONS_DAYS, 10) || 30;
  const otpHours = parseInt(process.env.PRUNE_OTP_HOURS, 10) || 24;

  const cancelledCutoff = new Date(now.getTime() - cancelledDays * 24 * 60 * 60 * 1000);
  const readNotifCutoff = new Date(now.getTime() - readNotifDays * 24 * 60 * 60 * 1000);
  const unreadNotifCutoff = new Date(now.getTime() - unreadNotifDays * 24 * 60 * 60 * 1000);
  const otpCutoff = new Date(now.getTime() - otpHours * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const cancelledCutoffStr = cancelledCutoff.toISOString().split('T')[0];

  console.log(`\n🧹 [CRON] Starting Configured Database Pruning Job at ${now.toISOString()}...`);

  try {
    // 🛡️ Protect referenced booking records
    const reviewedBookingIds = await Review.distinct('bookingId');
    const recentNotifBookingIds = await Notification.distinct('metadata.bookingId', {
      createdAt: { $gte: cancelledCutoff },
      'metadata.bookingId': { $exists: true, $ne: null },
    });

    const protectedIdsSet = new Set([
      ...reviewedBookingIds.map((id) => id.toString()),
      ...recentNotifBookingIds.map((id) => id.toString()),
    ]);

    const protectedBookingObjectIds = Array.from(protectedIdsSet)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const [
      otpResult,
      locksResult,
      readNotifsResult,
      staleUnreadNotifsResult,
      cancelledBookingsResult,
      inactiveTimetableResult,
    ] = await Promise.all([
      // 1. Delete verified / expired OTPs
      OTP.deleteMany({
        createdAt: { $lt: otpCutoff },
        verified: true,
      }),

      // 2. Delete temporary checkout locks
      Booking.deleteMany({
        purpose: 'TEMPORARY_LOCK',
        createdAt: { $lt: oneHourAgo },
      }),

      // 3. Delete read notifications
      Notification.deleteMany({
        read: true,
        createdAt: { $lt: readNotifCutoff },
      }),

      // 4. Delete unread notifications
      Notification.deleteMany({
        read: false,
        createdAt: { $lt: unreadNotifCutoff },
      }),

      // 5. Delete cancelled bookings (with relational protection)
      Booking.deleteMany({
        status: 'cancelled',
        date: { $lt: cancelledCutoffStr },
        _id: { $nin: protectedBookingObjectIds },
      }),

      // 6. Delete decommissioned timetable slots
      Timetable.deleteMany({
        isActive: false,
        updatedAt: { $lt: cancelledCutoff },
      }),
    ]);

    console.log(`   ├─ 🗑️  Expired/verified OTPs pruned: ${otpResult.deletedCount}`);
    console.log(`   ├─ 🗑️  Abandoned locks cleared: ${locksResult.deletedCount}`);
    console.log(`   ├─ 🗑️  Old read notifications purged: ${readNotifsResult.deletedCount}`);
    console.log(`   ├─ 🗑️  Stale unread notifications purged: ${staleUnreadNotifsResult.deletedCount}`);
    console.log(`   ├─ 🗑️  Archived cancelled bookings deleted: ${cancelledBookingsResult.deletedCount} (${protectedBookingObjectIds.length} protected)`);
    console.log(`   ├─ 🗑️  Decommissioned timetable slots pruned: ${inactiveTimetableResult.deletedCount}`);
    console.log(`   └─ 🛡️  Relational integrity preserved.`);
    console.log(`✅ [CRON] Database Pruning Finished Successfully.\n`);
  } catch (error) {
    console.error('❌ [CRON] Database Pruning Error:', error.message);
  }
};

const startCleanupScheduler = () => {
  // Initial run after startup
  setTimeout(() => {
    runDatabaseCleanup();
  }, 10000);

  const intervalHours = parseInt(process.env.CLEANUP_CRON_INTERVAL_HOURS, 10) || 24;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  setInterval(() => {
    runDatabaseCleanup();
  }, intervalMs);

  console.log(`⏰ Database auto-pruning scheduler registered (Interval: ${intervalHours}h)`);
};

module.exports = {
  runDatabaseCleanup,
  startCleanupScheduler,
};