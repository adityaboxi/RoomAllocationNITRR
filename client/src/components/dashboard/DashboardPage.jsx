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
          bookingAPI.getMyBookings()
        ]);
        const allRooms = roomsRes.data.data || [];
        const bookings = bookingsRes.data.data || [];
        setStats({
          totalRooms: allRooms.length,
          available: allRooms.filter(r => r.isAvailable !== false).length,
          myBookings: bookings.length,
          cancelled: bookings.filter(b => b.status === 'cancelled').length
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

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'rooms', label: '🏢 Rooms' },
    { id: 'booking', label: '📖 Book Room' },
    { id: 'mybookings', label: '📋 My Bookings' },
    ...(user?.role === 'hod' ? [{ id: 'timetable', label: '📅 Timetable' }] : []),
    ...(user?.role === 'hod' && user?.hodApproval === 'approved' ? [{ id: 'hod-approval', label: '👑 HOD Approval' }] : [])
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Navbar tabs={tabs} currentView={view} setView={setView} />

      <div className="container mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto bg-white rounded-2xl p-2 shadow-md border border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 whitespace-nowrap ${
                view === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Welcome back, <span className="text-blue-600">{user?.name}</span>! 👋</h1>
                <p className="text-gray-500 mt-1">{user?.role === 'hod' ? 'HOD' : 'Professor'} - {user?.department} Department</p>
              </div>
              <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-xl shadow-md border border-gray-100">
                ⚡ 4 req/sec | 👥 500+ users
              </div>
            </div>

            {user?.hodApproval === 'pending' && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-xl">
                <p className="text-yellow-700">⏳ Your HOD account is pending approval. You will be notified once approved.</p>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Rooms', value: stats.totalRooms, color: 'from-blue-500 to-blue-600', icon: '🏢' },
                { label: 'Available', value: stats.available, color: 'from-green-500 to-green-600', icon: '✅' },
                { label: 'My Bookings', value: stats.myBookings, color: 'from-purple-500 to-purple-600', icon: '📚' },
                { label: 'Cancelled', value: stats.cancelled, color: 'from-red-500 to-red-600', icon: '❌' }
              ].map((stat, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-800 mt-1">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-xl flex items-center justify-center text-white text-2xl shadow-md`}>
                      {stat.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">🚀 Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { action: () => setView('booking'), icon: '📖', title: 'Book a Room', desc: 'Check availability & book' },
                  { action: () => { setView('mybookings'); fetchMyBookings(); }, icon: '📋', title: 'My Bookings', desc: 'View all your bookings' },
                  { action: () => setView('rooms'), icon: '🏢', title: 'View Rooms', desc: 'Browse all rooms' }
                ].map((item, index) => (
                  <button
                    key={index}
                    onClick={item.action}
                    className="group bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 p-6 rounded-xl border-2 border-blue-100 hover:border-blue-300 transition-all duration-200 text-center"
                  >
                    <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">{item.icon}</div>
                    <h3 className="font-semibold text-gray-800">{item.title}</h3>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rooms View */}
        {view === 'rooms' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🏢 All Rooms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map(room => (
                <div key={room._id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold text-blue-600">Room {room.roomNumber}</h3>
                    <span className={`px-3 py-1 rounded-xl text-xs font-semibold ${
                      room.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {room.isAvailable ? '✅ Available' : '❌ Unavailable'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <p>📍 Floor: {room.floor} | Building: {room.building}</p>
                    <p>🏛️ {room.department} | 👥 Capacity: {room.capacity}</p>
                    <div className="flex gap-2 mt-2">
                      {room.hasProjector && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs">📽️ Projector</span>}
                      {room.hasAC && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs">❄️ AC</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Booking View */}
        {view === 'booking' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📖 Find & Book a Room</h2>
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={searchStart}
                    onChange={(e) => setSearchStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={searchEnd}
                    onChange={(e) => setSearchEnd(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
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
                className="mt-4 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                🔍 Check Availability
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map(room => (
                <div key={room._id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-200">
                  <h3 className="text-xl font-bold text-blue-600">Room {room.roomNumber}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>📍 Floor: {room.floor} | Building: {room.building}</p>
                    <p>🏛️ {room.department} | 👥 Capacity: {room.capacity}</p>
                    <div className="flex gap-2 mt-2">
                      {room.hasProjector && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs">📽️</span>}
                      {room.hasAC && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs">❄️</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedRoom(room); setShowModal(true); }}
                    className="mt-4 w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2 rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    📖 Book This Room
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Bookings View */}
        {view === 'mybookings' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📋 My Bookings</h2>
            {myBookings.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-gray-500 text-lg">No bookings found</p>
                <p className="text-sm text-gray-400">You haven't made any bookings yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myBookings.map(booking => (
                  <div key={booking._id} className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-blue-600">Room {booking.room?.roomNumber}</h3>
                          <span className={`px-3 py-1 rounded-xl text-xs font-semibold ${
                            booking.status === 'active' ? 'bg-green-100 text-green-700' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <p>📅 {new Date(booking.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          <p>🕐 {booking.startTime} - {booking.endTime}</p>
                          <p>📚 <span className="font-medium">{booking.subject}</span></p>
                          {booking.comment && <p className="text-gray-500 italic">💬 "{booking.comment}"</p>}
                          {booking.hasConflict && (
                            <div className="mt-2 bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-lg">
                              <p className="text-sm text-yellow-700">⚠️ Conflict: {booking.conflictDetails?.subject} by {booking.conflictDetails?.professor} at {booking.conflictDetails?.time}</p>
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
        )}

        {/* Timetable View */}
        {view === 'timetable' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📅 Timetable</h2>
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center border border-gray-100">
              <div className="text-5xl mb-4">📅</div>
              <p className="text-gray-500 text-lg">Timetable management coming soon</p>
              <p className="text-sm text-gray-400">HODs can manage department timetables here</p>
            </div>
          </div>
        )}

        {/* HOD Approval View */}
        {view === 'hod-approval' && <HODApprovalPage />}
      </div>

      {/* Booking Modal */}
      {showModal && selectedRoom && (
        <BookingModal
          room={selectedRoom}
          onClose={() => { setShowModal(false); setSelectedRoom(null); }}
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

export default DashboardPage;
