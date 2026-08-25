import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { roomAPI, bookingAPI } from '../../services/api';
import Navbar from '../common/Navbar';
import BookingModal from '../booking/BookingModal';
import HODApprovalPage from '../admin/HODApprovalPage';

const DashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalRooms: 0, available: 0, myBookings: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [searchDate, setSearchDate] = useState('');
  const [searchStart, setSearchStart] = useState('');
  const [searchEnd, setSearchEnd] = useState('');
  const [searchDept, setSearchDept] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState('dashboard');
  const [myBookings, setMyBookings] = useState([]);

  const fetchRooms = async () => {
    try {
      const params = {};
      if (searchDept) params.department = searchDept;
      const response = await roomAPI.getAll(params);
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const fetchAvailableRooms = async () => {
    if (!searchDate || !searchStart || !searchEnd) {
      alert('Please select date, start time and end time');
      return;
    }
    try {
      const params = { date: searchDate, startTime: searchStart, endTime: searchEnd };
      if (searchDept) params.department = searchDept;
      const response = await roomAPI.getAvailable(params);
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Error fetching available rooms:', error);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const response = await bookingAPI.getMyBookings();
      setMyBookings(response.data.data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [roomsRes, bookingsRes] = await Promise.all([
          roomAPI.getAll(),
          bookingAPI.getMyBookings(),
        ]);
        const allRooms = roomsRes.data.data || [];
        const bookings = bookingsRes.data.data || [];
        setStats({
          totalRooms: allRooms.length,
          available: allRooms.filter((r) => r.isAvailable !== false).length,
          myBookings: bookings.length,
          cancelled: bookings.filter((b) => b.status === 'cancelled').length,
        });
        setMyBookings(bookings);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    fetchRooms();
  }, []);

  const getTabs = () => {
    const baseTabs = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'rooms', label: 'Rooms' },
      { id: 'booking', label: 'Book Room' },
      { id: 'mybookings', label: 'My Bookings' },
    ];
    if (user?.role === 'hod' && user?.hodApproval === 'approved') {
      return [...baseTabs, { id: 'timetable', label: 'Timetable' }, { id: 'hod-approval', label: 'HOD Approval' }];
    }
    if (user?.role === 'hod' && user?.hodApproval === 'pending') {
      return [{ id: 'dashboard', label: 'Dashboard' }, { id: 'pending', label: 'Pending Approval' }];
    }
    return baseTabs;
  };

  const tabs = getTabs();

  const renderContent = () => {
    if (user?.role === 'hod' && user?.hodApproval === 'pending') return <PendingHODView />;
    if (view === 'hod-approval') return <HODApprovalPage />;
    if (view === 'timetable') return <TimetableManagementPage />;
    if (view === 'rooms') return <RoomsView rooms={rooms} />;
    if (view === 'booking') {
      return (
        <BookingView
          searchDate={searchDate}
          setSearchDate={setSearchDate}
          searchStart={searchStart}
          setSearchStart={setSearchStart}
          searchEnd={searchEnd}
          setSearchEnd={setSearchEnd}
          searchDept={searchDept}
          setSearchDept={setSearchDept}
          fetchAvailableRooms={fetchAvailableRooms}
          rooms={rooms}
          setSelectedRoom={setSelectedRoom}
          setShowModal={setShowModal}
        />
      );
    }
    if (view === 'mybookings') return <MyBookingsView myBookings={myBookings} />;
    return <DashboardView stats={stats} user={user} setView={setView} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar tabs={tabs} currentView={view} setView={setView} />
      <div className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto bg-white rounded-lg border border-gray-200 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                view === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {renderContent()}
      </div>
      {showModal && selectedRoom && (
        <BookingModal
          room={selectedRoom}
          onClose={() => {
            setShowModal(false);
            setSelectedRoom(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setSelectedRoom(null);
            alert('✅ Room booked successfully!');
            fetchMyBookings();
          }}
        />
      )}
    </div>
  );
};

// ============================================
// DASHBOARD VIEW
// ============================================
const DashboardView = ({ stats, user, setView }) => (
  <div>
    {/* Welcome */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">
          Welcome, <span className="text-blue-600">{user?.name}</span>
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {user?.role === 'hod' ? 'Admin' : 'Professor'} - {user?.department} Department
        </p>
      </div>
      <div className="text-xs text-gray-400 bg-white px-3 py-1.5 rounded-md border border-gray-200 mt-2 sm:mt-0">
        ⚡ 4 req/sec | 👥 500+ users
      </div>
    </div>

    {/* Stats */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Total Rooms', value: stats.totalRooms, color: 'bg-blue-100 text-blue-700' },
        { label: 'Available', value: stats.available, color: 'bg-green-100 text-green-700' },
        { label: 'My Bookings', value: stats.myBookings, color: 'bg-purple-100 text-purple-700' },
        { label: 'Cancelled', value: stats.cancelled, color: 'bg-red-100 text-red-700' },
      ].map((stat, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">{stat.label}</p>
          <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>

    {/* Quick Actions */}
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { action: () => setView('booking'), icon: '📖', title: 'Book Room', desc: 'Check availability' },
          { action: () => setView('mybookings'), icon: '📋', title: 'My Bookings', desc: 'View bookings' },
          { action: () => setView('rooms'), icon: '🏢', title: 'View Rooms', desc: 'Browse rooms' },
        ].map((item, i) => (
          <button
            key={i}
            onClick={item.action}
            className="bg-gray-50 hover:bg-gray-100 p-4 rounded-lg border border-gray-200 text-center transition"
          >
            <div className="text-2xl mb-1">{item.icon}</div>
            <p className="text-sm font-medium text-gray-800">{item.title}</p>
            <p className="text-xs text-gray-500">{item.desc}</p>
          </button>
        ))}
      </div>
    </div>
  </div>
);

// ============================================
// PENDING HOD VIEW
// ============================================
const PendingHODView = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md w-full text-center">
      <div className="text-5xl mb-4">⏳</div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Account Pending Approval</h2>
      <p className="text-sm text-gray-600 mb-4">
        Your HOD account is awaiting approval from an administrator.
      </p>
      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded text-left text-sm text-yellow-700">
        <p className="font-medium">📌 What happens next?</p>
        <p>1. Admin reviews your request</p>
        <p>2. You'll receive an email notification</p>
        <p>3. Once approved, you can access all HOD features</p>
      </div>
    </div>
  </div>
);

// ============================================
// ROOMS VIEW
// ============================================
const RoomsView = ({ rooms }) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-4">All Rooms</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {rooms.map((room) => (
        <div key={room._id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-medium text-blue-600">Room {room.roomNumber}</h3>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                room.isAvailable
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {room.isAvailable ? 'Available' : 'Unavailable'}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-600 space-y-0.5">
            <p>📍 Floor {room.floor} · {room.building}</p>
            <p>🏛️ {room.department} · 👥 {room.capacity}</p>
            <div className="flex gap-2 mt-1">
              {room.hasProjector && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">📽️</span>
              )}
              {room.hasAC && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">❄️</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ============================================
// BOOKING VIEW
// ============================================
const BookingView = ({
  searchDate,
  setSearchDate,
  searchStart,
  setSearchStart,
  searchEnd,
  setSearchEnd,
  searchDept,
  setSearchDept,
  fetchAvailableRooms,
  rooms,
  setSelectedRoom,
  setShowModal,
}) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-4">Find & Book a Room</h2>

    {/* Search */}
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
          <input
            type="time"
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            value={searchStart}
            onChange={(e) => setSearchStart(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
          <input
            type="time"
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            value={searchEnd}
            onChange={(e) => setSearchEnd(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
          <select
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            value={searchDept}
            onChange={(e) => setSearchDept(e.target.value)}
          >
            <option value="">All</option>
            <option value="CSE">CSE</option>
            <option value="ECE">ECE</option>
            <option value="ME">ME</option>
            <option value="EE">EE</option>
            <option value="CE">CE</option>
            <option value="MME">MME</option>
            <option value="BT">BT</option>
            <option value="IT">IT</option>
            <option value="MCA">MCA</option>
            <option value="MBA">MBA</option>
          </select>
        </div>
      </div>
      <button
        onClick={fetchAvailableRooms}
        className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-md text-sm font-medium transition"
      >
        Check Availability
      </button>
    </div>

    {/* Results */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {rooms.map((room) => (
        <div key={room._id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition">
          <h3 className="text-lg font-medium text-blue-600">Room {room.roomNumber}</h3>
          <div className="mt-2 text-sm text-gray-600 space-y-0.5">
            <p>📍 Floor {room.floor} · {room.building}</p>
            <p>🏛️ {room.department} · 👥 {room.capacity}</p>
          </div>
          <button
            onClick={() => {
              setSelectedRoom(room);
              setShowModal(true);
            }}
            className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-md text-sm font-medium transition"
          >
            Book This Room
          </button>
        </div>
      ))}
    </div>
  </div>
);

// ============================================
// MY BOOKINGS VIEW
// ============================================
const MyBookingsView = ({ myBookings }) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-4">My Bookings</h2>
    {myBookings.length === 0 ? (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-gray-500">No bookings found</p>
        <p className="text-sm text-gray-400">You haven't made any bookings yet</p>
      </div>
    ) : (
      <div className="space-y-3">
        {myBookings.map((booking) => (
          <div
            key={booking._id}
            className="bg-white rounded-lg border border-gray-200 p-4 border-l-4 border-l-blue-600 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium text-blue-600">Room {booking.room?.roomNumber}</h3>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      booking.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : booking.status === 'cancelled'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-600 space-y-0.5">
                  <p>📅 {new Date(booking.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  <p>🕐 {booking.startTime} - {booking.endTime}</p>
                  <p>📚 <span className="font-medium">{booking.subject}</span></p>
                  {booking.comment && booking.comment !== 'No comment provided' && (
                    <p className="text-gray-500 italic">💬 "{booking.comment}"</p>
                  )}
                  {booking.hasConflict && (
                    <div className="mt-2 bg-yellow-50 border-l-4 border-yellow-500 p-2 rounded text-sm text-yellow-700">
                      ⚠️ Conflict: {booking.conflictDetails?.subject} by {booking.conflictDetails?.professor} at {booking.conflictDetails?.time}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ============================================
// TIMETABLE MANAGEMENT PAGE
// ============================================
const TimetableManagementPage = () => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-4">Timetable Management</h2>
    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
      <div className="text-4xl mb-3">📅</div>
      <p className="text-gray-500">Timetable management coming soon</p>
      <p className="text-sm text-gray-400">HODs can manage department timetables here</p>
    </div>
  </div>
);

export default DashboardPage;
