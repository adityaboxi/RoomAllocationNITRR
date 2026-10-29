const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const User = require('../models/User');
const AdminUser = require('../models/AdminUser');

const DEPARTMENTS_DATA = [
  {
    department: 'Computer Science & Engineering',
    hod: {
      name: 'Dr. Dilip Singh Sisodia',
      email: 'drsisodia@cse.nitrr.ac.in',
    },
    faculty: [
      { name: 'Aditya Boxi', email: 'aditya@cse.nitrr.ac.in' },
      { name: 'Dr. Pradeep Singh', email: 'pradeep@cse.nitrr.ac.in' },
    ],
  },
  {
    department: 'Information Technology',
    hod: {
      name: 'Dr. Rakesh Tripathi',
      email: 'hod@it.nitrr.ac.in',
    },
    faculty: [
      { name: 'Dr. Govind P. Gupta', email: 'govind@it.nitrr.ac.in' },
      { name: 'Dr. Sanjay Kumar', email: 'sanjay@it.nitrr.ac.in' },
    ],
  },
  {
    department: 'Electronics & Communication',
    hod: {
      name: 'Dr. Shrish Verma',
      email: 'hod@ece.nitrr.ac.in',
    },
    faculty: [
      { name: 'Dr. Alok Naugarhiya', email: 'alok@ece.nitrr.ac.in' },
      { name: 'Dr. Manoj Kumar Majumder', email: 'manoj@ece.nitrr.ac.in' },
    ],
  },
  {
    department: 'Electrical Engineering',
    hod: {
      name: 'Dr. Subhojit Ghosh',
      email: 'hod@ee.nitrr.ac.in',
    },
    faculty: [
      { name: 'Dr. Anamika Yadav', email: 'anamika@ee.nitrr.ac.in' },
      { name: 'Dr. Ebha Koley', email: 'ebha@ee.nitrr.ac.in' },
    ],
  },
  {
    department: 'Mechanical Engineering',
    hod: {
      name: 'Dr. S. Sanyal',
      email: 'hod@me.nitrr.ac.in',
    },
    faculty: [
      { name: 'Dr. Anil Kumar Tiwari', email: 'anil@me.nitrr.ac.in' },
      { name: 'Dr. Nitin Kumar Jain', email: 'nitin@me.nitrr.ac.in' },
    ],
  },
  {
    department: 'Civil Engineering',
    hod: {
      name: 'Dr. Gangadhar Ramtekkar',
      email: 'hod@ce.nitrr.ac.in',
    },
    faculty: [
      { name: 'Dr. U. K. Dewangan', email: 'dewangan@ce.nitrr.ac.in' },
      { name: 'Dr. Shirish V. Deo', email: 'shirish@ce.nitrr.ac.in' },
    ],
  },
  {
    department: 'Chemical Engineering',
    hod: {
      name: 'Dr. A. B. Soni',
      email: 'hod@che.nitrr.ac.in',
    },
    faculty: [
      { name: 'Dr. Prabir Ghosh', email: 'prabir@che.nitrr.ac.in' },
      { name: 'Dr. Dharm Pal', email: 'dharmpal@che.nitrr.ac.in' },
    ],
  },
  {
    department: 'Biotechnology',
    hod: {
      name: 'Dr. Lata Sheo Bachan Upadhyay',
      email: 'hod@bt.nitrr.ac.in',
    },
    faculty: [
      { name: 'Dr. Pratima Gupta', email: 'pratima@bt.nitrr.ac.in' },
      { name: 'Dr. Awanish Kumar', email: 'awanish@bt.nitrr.ac.in' },
    ],
  },
  {
    department: 'Metallurgical & Materials',
    hod: {
      name: 'Dr. Manoj Chopkar',
      email: 'hod@mme.nitrr.ac.in',
    },
    faculty: [
      { name: 'Dr. Sanjeev Das', email: 'sanjeev@mme.nitrr.ac.in' },
      { name: 'Dr. M. K. Tripathi', email: 'tripathi@mme.nitrr.ac.in' },
    ],
  },
  {
    department: 'Mining Engineering',
    hod: {
      name: 'Dr. B. R. Chahar',
      email: 'hod@min.nitrr.ac.in',
    },
    faculty: [
      { name: 'Dr. Ravi K. Jade', email: 'ravijade@min.nitrr.ac.in' },
      { name: 'Dr. P. D. Dewangan', email: 'pddewangan@min.nitrr.ac.in' },
    ],
  },
];

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/roomallocation';
    console.log(`Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    const defaultPassword = process.env.DEFAULT_SEED_PASSWORD || 'Password@123';

    // 1. Super Admin
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@nitrr.ac.in').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'adminsecret123';

    let admin = await AdminUser.findOne({ email: adminEmail });
    if (!admin) {
      admin = await AdminUser.create({
        name: 'System Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'ADMIN',
        department: 'ALL',
        isFirstLogin: false,
      });
      console.log(`✅ AdminUser created: ${adminEmail}`);
    } else {
      admin.password = adminPassword;
      await admin.save();
      console.log(`✅ AdminUser verified: ${adminEmail}`);
    }

    // 2. Department Users (1 HOD + 2 Faculty each)
    let seededHODs = 0;
    let seededFaculty = 0;

    for (const item of DEPARTMENTS_DATA) {
      const deptName = item.department;

      // Seed HOD
      let hod = await User.findOne({ email: item.hod.email.toLowerCase() });
      if (hod) {
        hod.name = item.hod.name;
        hod.role = 'HOD';
        hod.department = deptName;
        hod.isActive = true;
        hod.password = defaultPassword;
        await hod.save();
      } else {
        hod = new User({
          name: item.hod.name,
          email: item.hod.email.toLowerCase(),
          password: defaultPassword,
          role: 'HOD',
          department: deptName,
          isActive: true,
        });
        await hod.save();
      }
      seededHODs++;

      // Seed 2 Faculty
      for (const fac of item.faculty) {
        let faculty = await User.findOne({ email: fac.email.toLowerCase() });
        if (faculty) {
          faculty.name = fac.name;
          faculty.role = 'FACULTY';
          faculty.department = deptName;
          faculty.isActive = true;
          faculty.password = defaultPassword;
          await faculty.save();
        } else {
          faculty = new User({
            name: fac.name,
            email: fac.email.toLowerCase(),
            password: defaultPassword,
            role: 'FACULTY',
            department: deptName,
            isActive: true,
          });
          await faculty.save();
        }
        seededFaculty++;
      }
    }

    console.log(`\n✅ Successfully seeded ${seededHODs} HODs and ${seededFaculty} Faculty across ${DEPARTMENTS_DATA.length} departments.`);

  } catch (error) {
    console.error('❌ Seeding error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
