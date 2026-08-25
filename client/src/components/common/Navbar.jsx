import { useAuth } from '../../context/AuthContext';

const Navbar = ({ tabs, currentView, setView }) => {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">🏫</span>
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">NITRR</span>
              <span className="text-sm text-gray-500 ml-1">Room Allocation</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user?.name}</span>
              <span className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 px-2 py-1 rounded-lg font-medium">{user?.role}</span>
              {user?.hodApproval === 'pending' && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg font-medium">⏳ Pending</span>
              )}
              {user?.hodApproval === 'approved' && user?.role === 'hod' && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">✅ Approved</span>
              )}
            </div>
            <button
              onClick={logout}
              className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
