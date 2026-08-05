import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CheckSquare, Zap, Layers, Sliders, RotateCcw, ShoppingBag, BarChart3,
  Clock, PlusCircle, Search, Menu, X, LogOut, Bell, Settings, RefreshCw, Users, Star,
  LogIn, UserCheck, Play, Square,
} from 'lucide-react';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import { io, Socket } from 'socket.io-client';
import { commerceApi, attendanceApi, notifyOrdersUpdated } from '../services/api';
import { toast } from 'sonner';

const NAV_LINKS = [
  { to: '/today', label: "Today's Work", icon: CheckSquare },
  { to: '/next', label: 'Next Call', icon: Zap },
  { to: '/queues', label: 'Task Queues', icon: Layers },
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/returns', label: 'Returns', icon: RotateCcw },
  { to: '/reviews', label: 'Reviews', icon: Star },
  { to: '/recovery', label: 'Recovery', icon: RotateCcw },
  { to: '/rules', label: 'Rules', icon: Sliders },
  { to: '/stats', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [menuOpen, setMenuOpen] = useState(false);
  const { simulatedTimeIso, advanceTime } = useSimulatedTime();
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [attendance, setAttendance] = useState<any>(null);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch { return null; }
  })();

  const isSuperAdmin = currentUser?.role === 'super-admin';
  const links = isSuperAdmin
    ? [...NAV_LINKS, { to: '/users', label: 'Users', icon: Users }]
    : NAV_LINKS;

  const fetchAttendanceStatus = async () => {
    try {
      const res: any = await attendanceApi.getStatus();
      if (res?.data) {
        setAttendance(res.data);
      }
    } catch {}
  };

  useEffect(() => {
    if (!token) return;
    fetchAttendanceStatus();
    const interval = setInterval(fetchAttendanceStatus, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleToggleAttendance = async () => {
    try {
      if (attendance?.isCheckedIn) {
        await attendanceApi.checkOut();
        toast.success('Shift checked out successfully');
      } else {
        await attendanceApi.checkIn();
        toast.success('Shift checked in successfully');
      }
      fetchAttendanceStatus();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update shift status');
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const q = searchQuery.trim();
    navigate(q ? `/orders?search=${encodeURIComponent(q)}` : '/orders');
  };

  useEffect(() => {
    if (!token) return;
    const socket: Socket = io(window.location.origin, { transports: ['websocket'] });
    socket.on('new-orders', (data: { count: number }) => {
      setNewOrderCount(prev => prev + data.count);
      notifyOrdersUpdated();
    });
    socket.on('order-updates', () => {
      notifyOrdersUpdated();
    });
    return () => { socket.disconnect(); };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const check = async () => {
      try {
        const res: any = await commerceApi.getSyncStatus();
        const status = res.data;
        setSyncing(status.running);
        if (status.lastCompletedAt) setLastSyncTime(status.lastCompletedAt);
      } catch {}
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleSync = async () => {
    try {
      await commerceApi.syncAll();
      setSyncing(true);
      toast.info('Order sync triggered...');
    } catch {
      toast.error('Failed to trigger sync');
    }
  };

  const formatTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  };

  const formattedTime = new Date(simulatedTimeIso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!token) return null;

  return (
    <header className="sticky top-0 z-40 bg-[#ffffff]/95 backdrop-blur-md border-b border-[#e5e5e5] text-[#0a0a0a] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link to="/today" className="flex items-center gap-3 shrink-0 group">
          <div className="w-9 h-9 rounded-2xl bg-[#dc3545] text-white flex items-center justify-center font-bold shadow-md shadow-[#dc3545]/20 group-hover:scale-105 transition-transform">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <div>
            <div className="font-extrabold text-base tracking-tight text-[#0a0a0a] flex items-center gap-1.5">
              <span>NepalCan</span>
              <span className="text-[#dc3545]">Ops</span>
            </div>
            <p className="text-[10px] text-[#737373] hidden sm:block font-medium tracking-wide uppercase">Follow-up Engine</p>
          </div>
        </Link>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search order #, phone, customer..."
              className="w-full bg-[#f5f5f5] border border-transparent focus:border-[#dc3545] focus:bg-white rounded-2xl pl-9 pr-4 py-1.5 text-xs text-[#0a0a0a] placeholder-[#737373] outline-none transition-all focus:ring-2 focus:ring-[#dc3545]/15"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Simulated Time Widget */}
          <div className="hidden lg:flex items-center gap-1 bg-[#fafafa] border border-[#e5e5e5] px-2.5 py-1 rounded-2xl text-xs shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-[#dc3545]" />
            <span className="text-[#0a0a0a] font-semibold text-[11px]">{formattedTime}</span>
            <div className="h-3 w-px bg-[#e5e5e5] mx-1" />
            <button
              onClick={() => advanceTime(1)}
              className="px-1.5 py-0.5 rounded-lg bg-[#ffffff] border border-[#e5e5e5] hover:bg-[#fff5f5] hover:border-[#f8d7da] hover:text-[#dc3545] text-[#0a0a0a] font-medium transition-colors text-[10px] cursor-pointer"
            >+1h</button>
            <button
              onClick={() => advanceTime(8)}
              className="px-1.5 py-0.5 rounded-lg bg-[#ffffff] border border-[#e5e5e5] hover:bg-[#fff5f5] hover:border-[#f8d7da] hover:text-[#dc3545] text-[#0a0a0a] font-medium transition-colors text-[10px] cursor-pointer"
            >+8h</button>
          </div>

          {/* Shift Attendance Quick Toggle */}
          <button
            onClick={handleToggleAttendance}
            className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl border transition-all cursor-pointer ${
              attendance?.isCheckedIn
                ? 'bg-[#fff5f5] border-[#f8d7da] text-[#dc3545] shadow-2xs hover:bg-[#f8d7da]/50'
                : 'bg-[#f5f5f5] border-[#e5e5e5] text-[#737373] hover:text-[#dc3545] hover:border-[#f8d7da]'
            }`}
            title={attendance?.isCheckedIn ? 'Click to check out' : 'Click to check in'}
          >
            {attendance?.isCheckedIn ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold">Shift: {attendance?.activeShift?.currentDurationMinutes || 0}m</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5 text-[#dc3545]" />
                <span className="text-[11px] font-semibold">Check In</span>
              </>
            )}
          </button>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 bg-[#ffffff] border border-[#e5e5e5] hover:border-[#f8d7da] hover:bg-[#fff5f5] hover:text-[#dc3545] text-[#0a0a0a] font-medium text-xs px-3 py-1.5 rounded-2xl transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            title={lastSyncTime ? `Last sync ${formatTimeAgo(lastSyncTime)}` : 'Sync now'}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#dc3545] ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline text-[11px] font-semibold">{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => { setShowNotif(!showNotif); if (showNotif) setNewOrderCount(0); }}
              className="relative p-2 text-[#737373] hover:text-[#dc3545] transition-colors cursor-pointer rounded-2xl hover:bg-[#fff5f5]"
            >
              <Bell className="w-4 h-4" />
              {newOrderCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#dc3545] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow-xs">
                  {newOrderCount}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute right-0 mt-2 w-72 bg-[#ffffff] rounded-2xl shadow-xl border border-[#e5e5e5] p-4 text-[#0a0a0a] z-50 animate-in-fast">
                <h4 className="font-bold text-xs mb-2 text-[#0a0a0a]">Notifications</h4>
                {newOrderCount > 0 ? (
                  <div>
                    <p className="text-xs text-[#737373] mb-3">{newOrderCount} new order(s) synced from NepalCan Commerce.</p>
                    <button
                      onClick={() => { navigate('/today'); setShowNotif(false); setNewOrderCount(0); }}
                      className="w-full bg-[#dc3545] hover:bg-[#b02a37] text-white font-semibold text-xs py-2 rounded-2xl cursor-pointer transition-colors"
                    >
                      View in Dashboard
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[#737373]">No new order notifications.</p>
                )}
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="text-[#737373] hover:text-[#dc3545] p-2 rounded-2xl hover:bg-[#fff5f5] transition-colors hidden sm:block"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-2 text-[#0a0a0a] rounded-2xl hover:bg-[#f5f5f5]"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Pill Navigation Bar */}
      <nav className="bg-[#fafafa] border-t border-[#e5e5e5] px-4 sm:px-6 lg:px-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex space-x-1.5 py-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#dc3545] text-white shadow-xs font-bold'
                    : 'text-[#737373] hover:text-[#dc3545] hover:bg-[#fff5f5]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Drawer Menu (<640px) */}
      {menuOpen && (
        <div className="sm:hidden border-t border-[#e5e5e5] bg-[#ffffff] pb-4 px-4 pt-2 shadow-lg animate-in-fast">
          <div className="mb-3 p-3 bg-[#fff5f5] border border-[#f8d7da] rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#0a0a0a]">{currentUser?.name || 'Staff User'}</p>
              <p className="text-[10px] text-[#737373]">{currentUser?.email || 'staff@nepalcan.com'}</p>
            </div>
            <button
              onClick={handleToggleAttendance}
              className={`px-3 py-1.5 rounded-2xl text-xs font-semibold border ${
                attendance?.isCheckedIn ? 'bg-[#ffffff] text-[#dc3545] border-[#f8d7da]' : 'bg-[#dc3545] text-white'
              }`}
            >
              {attendance?.isCheckedIn ? 'Check Out' : 'Check In'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-2xl border ${
                    isActive
                      ? 'bg-[#dc3545] text-white border-[#dc3545]'
                      : 'bg-[#fafafa] text-[#0a0a0a] border-[#e5e5e5]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 mt-3 px-3 py-2.5 text-xs font-bold text-red-600 bg-red-50 rounded-2xl w-full border border-red-200"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
