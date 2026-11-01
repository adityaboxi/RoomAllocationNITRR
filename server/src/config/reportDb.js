const mongoose = require('mongoose');

let reportConnection = null;

/**
 * Derives report database URI from primary URI if not explicitly provided
 */
const getReportDbUri = () => {
  if (process.env.REPORT_MONGODB_URI) {
    return process.env.REPORT_MONGODB_URI;
  }
  const primaryUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/roomallocation';
  try {
    const url = new URL(primaryUri);
    const primaryDb = url.pathname.replace(/^\//, '') || 'roomallocation';
    url.pathname = `/${primaryDb}_reports`;
    return url.toString();
  } catch {
    return 'mongodb://127.0.0.1:27017/roomallocation_reports';
  }
};

/**
 * Initializes and caches dedicated Mongoose connection for Reports & Analytics
 */
const connectReportDB = async () => {
  if (reportConnection && reportConnection.readyState === 1) {
    return reportConnection;
  }

  const reportUri = getReportDbUri();
  console.log(`📊 [REPORT DB] Connecting dedicated analytics database...`);

  try {
    reportConnection = mongoose.createConnection(reportUri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await reportConnection.asPromise();

    console.log(`✅ [REPORT DB] Connected to isolated reports database: ${reportConnection.host}/${reportConnection.name}`);
    console.log(`🛡️  [REPORT DB] High-throughput analytics isolated from live website queries.`);

    reportConnection.on('error', (err) => {
      console.error('❌ [REPORT DB] Runtime error:', err.message);
    });

    reportConnection.on('disconnected', () => {
      console.warn('⚠️  [REPORT DB] Disconnected.');
    });

    return reportConnection;
  } catch (err) {
    console.error('❌ [REPORT DB] Connection error:', err.message);
    // Return null so callers gracefully fallback to primary DB without crashing
    return null;
  }
};

const getReportConnection = () => {
  return reportConnection;
};

module.exports = {
  connectReportDB,
  getReportConnection,
  getReportDbUri,
};
