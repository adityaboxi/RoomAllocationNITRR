import { useAuth } from '../../context/AuthContext';

const Navbar = ({ tabs, currentView, setView }) => {
  const { user, logout } = useAuth();

  const getRoleDisplay = () => {
    if (user?.role === 'hod' && user?.hodApproval === 'approved') return 'Admin';
    if (user?.role === 'hod' && user?.hodApproval === 'pending') return 'Pending HOD';
    if (user?.role === 'professor') return 'Professor';
    return 'User';
  };

  const getRoleBadgeColor = () => {
    if (user?.role === 'hod' && user?.hodApproval === 'approved') return 'bg-purple-600';
    if (user?.role === 'hod' && user?.hodApproval === 'pending') return 'bg-yellow-500';
    return 'bg-blue-600';
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">🏫</span>
            </div>
            <div>
              <span className="text-lg font-semibold text-gray-800">NITRR</span>
              <span className="text-xs text-gray-500 ml-1">Room Allocation</span>
            </div>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg">
              <div
                className={`w-7 h-7 ${getRoleBadgeColor()} rounded-full flex items-center justify-center text-white font-medium text-xs`}
              >
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-medium text-gray-700">{user?.name}</span>
                <span className="text-xs text-gray-500 block leading-none">{user?.department}</span>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {getRoleDisplay()}
              </span>
              {user?.hodApproval === 'pending' && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                  Pending
                </span>
              )}
            </div>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition"
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
