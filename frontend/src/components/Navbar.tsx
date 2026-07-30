import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CheckSquare, Zap, Layers, Sliders, RotateCcw, ShoppingBag, BarChart3,
  Clock, PlusCircle, Search, Menu, X, LogOut, Bell, Settings, RefreshCw,
} from 'lucide-react';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import { io, Socket } from 'socket.io-client';
import { commerceApi } from '../services/api';

const NAV_LINKS = [
  { to: '/today', label: "Today's Work", icon: CheckSquare },
  { to: '/next', label: 'Next Call', icon: Zap },
  { to: '/queues', label: 'Task Queues', icon: Layers },
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
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

  useEffect(() => {
    if (!token) return;
    const socket: Socket = io(window.location.origin, { transports: ['websocket'] });
    socket.on('new-orders', (data: { count: number }) => {
      setNewOrderCount(prev => prev + data.count);
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
    } catch {}
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
    navigate('/login');
  };

  if (!token) return null;

  return (
    <header className="sticky top-0 z-40 bg-red-600 border-b border-red-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/today" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white text-red-600 flex items-center justify-center font-black shadow-sm">
            <Zap className="w-5 h-5 text-red-600 fill-red-600" />
          </div>
          <div>
            <div className="font-extrabold text-xl tracking-tight text-white">NepalCan Ops</div>
            <p className="text-xs text-red-100 hidden sm:block font-medium">Follow-up Engine</p>
          </div>
        </Link>

        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-red-300" />
            <input
              type="text"
              placeholder="Search order #, phone, customer..."
              className="w-full bg-red-700/80 border border-red-500 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 bg-red-700 border border-red-500 px-3 py-1 rounded-lg text-xs">
            <Clock className="w-3.5 h-3.5 text-red-100" />
            <span className="text-white font-medium">{formattedTime}</span>
            <div className="h-3 w-px bg-red-500 mx-1" />
            <button
              onClick={() => advanceTime(1)}
              className="px-2 py-0.5 rounded bg-white text-red-700 hover:bg-red-50 font-bold transition-colors text-[11px] cursor-pointer"
            >+1h</button>
            <button
              onClick={() => advanceTime(8)}
              className="px-2 py-0.5 rounded bg-white text-red-700 hover:bg-red-50 font-bold transition-colors text-[11px] cursor-pointer"
            >+8h</button>
          </div>

          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 bg-red-700 border border-red-500 hover:bg-red-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            title={lastSyncTime ? `Last sync ${formatTimeAgo(lastSyncTime)}` : 'Sync now'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <div className="relative">
            <button onClick={() => { setShowNotif(!showNotif); if (showNotif) setNewOrderCount(0); }}
              className="relative p-2 text-white hover:text-red-200 transition-colors cursor-pointer">
              <Bell className="w-5 h-5" />
              {newOrderCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-yellow-400 text-red-800 text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {newOrderCount}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 text-slate-900 z-50">
                <h4 className="font-bold text-sm mb-2">Notifications</h4>
                {newOrderCount > 0 ? (
                  <div>
                    <p className="text-xs text-slate-600">{newOrderCount} new order(s) synced.</p>
                    <button onClick={() => { navigate('/today'); setShowNotif(false); setNewOrderCount(0); }}
                      className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer">
                      View in Dashboard
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No new notifications.</p>
                )}
              </div>
            )}
          </div>

          <Link
            to="/orders"
            className="hidden sm:flex items-center gap-1.5 bg-white text-red-600 hover:bg-red-50 font-bold text-xs px-3.5 py-2 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Order</span>
          </Link>

          <button
            onClick={handleLogout}
            className="text-red-200 hover:text-white p-1.5 hidden sm:block"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-1.5 text-white"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <nav className="bg-red-700/90 backdrop-blur border-t border-red-500 px-4 sm:px-6 lg:px-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex space-x-1 sm:space-x-2 py-2">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-red-100 hover:bg-red-600 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {menuOpen && (
        <div className="sm:hidden border-t border-red-500 bg-red-700 pb-3 px-4">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg ${
                  isActive ? 'bg-red-800 text-white' : 'text-red-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-red-200 w-full"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
