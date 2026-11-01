const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Timetable = require('../models/Timetable');
const Room = require('../models/Room');
const { getReportModels } = require('../models/reportModels');
const { connectReportDB } = require('../config/reportDb');
const { getTodayDateString } = require('../utils/helpers');

let syncCronTimer = null;

/**
 * Synchronizes booking and timetable records into the isolated Report Database
 * CRITICAL RULE: Related records in the primary operational database are NEVER pruned.
 */
const syncToReportDatabase = async (options = {}) => {
  const isForced = options.force || false;
  console.log(`\n📊 [REPORT SYNC] Initiating synchronization to isolated Report Database...`);

  // Ensure report database connection is ready
  await connectReportDB();
  const models = getReportModels();
  if (!models) {
    console.warn(`⚠️  [REPORT SYNC] Report database connection not ready. Skipping sync.`);
    return { success: false, message: 'Report database unavailable' };
  }

  const { ReportBooking, ReportTimetable, ReportSyncMeta } = models;

  try {
    const todayStr = getTodayDateString();
    const archiveAgeDays = parseInt(process.env.REPORT_ARCHIVE_AGE_DAYS || '30', 10);
    
    // Calculate 30-day cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - archiveAgeDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    console.log(`📅 [REPORT SYNC] 30-Day Archive Boundary: Dates <= ${cutoffDateStr} tagged as 30-Day Historical Archive`);

    // 1. Fetch Room Lookup map for fast denormalization
    const allRooms = await Room.find({}).lean();
    const roomMap = new Map();
    allRooms.forEach((r) => {
      roomMap.set(r._id.toString(), {
        name: r.name || 'Classroom',
        building: r.building || '-',
        floor: r.floor !== undefined && r.floor !== null ? String(r.floor) : '-',
        department: r.department || '-',
        capacity: r.capacity || 0,
        type: r.type || 'Classroom',
      });
    });

    // 2. Query bookings from primary operational database (excluding temporary checkout locks)
    const operationalBookings = await Booking.find({
      purpose: { $ne: 'TEMPORARY_LOCK' },
    }).lean();

    let syncedBookingsCount = 0;
    const bookingBulkOps = [];

    for (const b of operationalBookings) {
      const rId = b.roomId ? b.roomId.toString() : null;
      const roomInfo = roomMap.get(rId) || {
        name: 'Classroom',
        building: '-',
        floor: '-',
        department: b.department || '-',
        capacity: 0,
        type: 'Classroom',
      };

      const isOlderThan30Days = b.date <= cutoffDateStr;

      bookingBulkOps.push({
        updateOne: {
          filter: { originalId: b._id },
          update: {
            $set: {
              originalId: b._id,
              roomId: b.roomId,
              roomName: roomInfo.name,
              building: roomInfo.building,
              floor: roomInfo.floor,
              capacity: roomInfo.capacity,
              roomType: roomInfo.type,
              department: b.department || roomInfo.department,
              facultyName: b.facultyName || 'Faculty',
              facultyEmail: b.facultyEmail || '',
              date: b.date,
              startTime: b.startTime,
              endTime: b.endTime,
              purpose: b.purpose || 'General',
              comment: b.comment || '',
              status: b.status || 'completed',
              isArchivedAfter30Days: isOlderThan30Days,
              archivedAt: new Date(),
            },
          },
          upsert: true,
        },
      });

      if (bookingBulkOps.length >= 500) {
        const result = await ReportBooking.bulkWrite(bookingBulkOps);
        syncedBookingsCount += (result.upsertedCount + result.modifiedCount);
        bookingBulkOps.length = 0;
      }
    }

    if (bookingBulkOps.length > 0) {
      const result = await ReportBooking.bulkWrite(bookingBulkOps);
      syncedBookingsCount += (result.upsertedCount + result.modifiedCount);
    }

    // 3. Sync Active Timetable Blueprints
    const operationalTimetables = await Timetable.find({}).lean();
    let syncedTimetablesCount = 0;
    const timetableBulkOps = [];

    for (const tt of operationalTimetables) {
      const rId = tt.roomId ? tt.roomId.toString() : null;
      const roomInfo = roomMap.get(rId) || {
        name: 'Classroom',
        building: '-',
        floor: '-',
        department: tt.department || '-',
      };

      timetableBulkOps.push({
        updateOne: {
          filter: { originalId: tt._id },
          update: {
            $set: {
              originalId: tt._id,
              roomId: tt.roomId,
              roomName: roomInfo.name,
              building: roomInfo.building,
              floor: roomInfo.floor,
              department: tt.department || roomInfo.department,
              semester: tt.semester || '1st',
              section: tt.section || 'A',
              day: tt.day,
              startTime: tt.startTime,
              endTime: tt.endTime,
              subject: tt.subject,
              classGroup: tt.classGroup || '',
              faculty: tt.faculty,
              facultyEmail: tt.facultyEmail || '',
              archivedAt: new Date(),
            },
          },
          upsert: true,
        },
      });

      if (timetableBulkOps.length >= 500) {
        const result = await ReportTimetable.bulkWrite(timetableBulkOps);
        syncedTimetablesCount += (result.upsertedCount + result.modifiedCount);
        timetableBulkOps.length = 0;
      }
    }

    if (timetableBulkOps.length > 0) {
      const result = await ReportTimetable.bulkWrite(timetableBulkOps);
      syncedTimetablesCount += (result.upsertedCount + result.modifiedCount);
    }

    // 4. Record Sync Metadata in Report Database
    await ReportSyncMeta.create({
      syncType: isForced ? 'MANUAL_TRIGGER' : '30_DAY_CYCLE',
      syncedBookingsCount: operationalBookings.length,
      syncedTimetablesCount: operationalTimetables.length,
      lastSyncTimestamp: new Date(),
      status: 'SUCCESS',
      message: `Successfully synchronized ${operationalBookings.length} bookings and ${operationalTimetables.length} timetables to isolated Report DB. Zero records pruned from primary DB.`,
    });

    console.log(`✅ [REPORT SYNC] Sync Complete:`);
    console.log(`   - Bookings in Report DB   : ${operationalBookings.length} total (synced/updated)`);
    console.log(`   - Timetables in Report DB : ${operationalTimetables.length} total (synced/updated)`);
    console.log(`   - Primary Database Status : 100% UNTOUCHED (0 records deleted/pruned)`);

    return {
      success: true,
      totalBookingsInReportDb: operationalBookings.length,
      totalTimetablesInReportDb: operationalTimetables.length,
      cutoffDateStr,
      primaryDatabasePreserved: true,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`❌ [REPORT SYNC] Synchronization failed:`, err);
    return { success: false, message: err.message };
  }
};

/**
 * Starts automatic background sync scheduler
 */
const startReportSyncScheduler = () => {
  // Run initial sync 5 seconds after server bootstrap
  setTimeout(() => {
    syncToReportDatabase();
  }, 5000);

  const intervalHours = parseInt(process.env.REPORT_SYNC_INTERVAL_HOURS || '24', 10);
  const intervalMs = intervalHours * 60 * 60 * 1000;

  syncCronTimer = setInterval(() => {
    syncToReportDatabase();
  }, intervalMs);

  console.log(`⏰ [REPORT SYNC] Scheduled background sync every ${intervalHours} hour(s) to roomallocation_reports`);
};

const stopReportSyncScheduler = () => {
  if (syncCronTimer) {
    clearInterval(syncCronTimer);
    syncCronTimer = null;
  }
};

module.exports = {
  syncToReportDatabase,
  startReportSyncScheduler,
  stopReportSyncScheduler,
};
