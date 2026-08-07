import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckSquare, Zap, ShoppingBag, RotateCcw, MoreHorizontal, X, LogOut, Download,
} from 'lucide-react';
import { attendanceApi } from '../services/api';
import { toast } from 'sonner';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const PRIMARY_ITEMS = [
  { to: '/today', label: 'Today', icon: CheckSquare },
  { to: '/next', label: 'Next', icon: Zap },
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/returns', label: 'Returns', icon: RotateCcw },
];

const NAV_LINKS = [
  { to: '/today', label: "Today's Work", icon: CheckSquare },
  { to: '/next', label: 'Next Call', icon: Zap },
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/returns', label: 'Returns', icon: RotateCcw },
  { to: '/reviews', label: 'Reviews', icon: CheckSquare },
  { to: '/recovery', label: 'Recovery', icon: RotateCcw },
  { to: '/rules', label: 'Rules', icon: CheckSquare },
  { to: '/stats', label: 'Analytics', icon: CheckSquare },
  { to: '/settings', label: 'Settings', icon: CheckSquare },
];

export default function BottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [attendance, setAttendance] = useState<any>(null);
  const { canInstall, isIos, install } = useInstallPrompt();

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch { return null; }
  })();

  const fetchAttendance = async () => {
    try {
      const res: any = await attendanceApi.getStatus();
      if (res?.data) setAttendance(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchAttendance();
    const interval = setInterval(fetchAttendance, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAttendance = async () => {
    try {
      if (attendance?.isCheckedIn) {
        await attendanceApi.checkOut();
        toast.success('Shift checked out successfully');
      } else {
        await attendanceApi.checkIn();
        toast.success('Shift checked in successfully');
      }
      setAttendance(await attendanceApi.getStatus().then((r: any) => r.data).catch(() => null));
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update shift status');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const itemClass = (active: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-1 rounded-2xl transition-all cursor-pointer ${
      active ? 'bg-[#0a0a0a] text-white font-semibold' : 'text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]'
    }`;

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#ffffff]/95 backdrop-blur border-t border-[#e5e5e5] px-2 pt-1 pb-1">
        <div className="grid grid-cols-5 gap-1">
          {PRIMARY_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className={itemClass(active)}>
                <Icon className="w-5 h-5" />
                <span className="text-[10px] leading-none">{item.label}</span>
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen(!moreOpen)} className={itemClass(moreOpen)}>
            {moreOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
            <span className="text-[10px] leading-none">More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-0 inset-x-0 bg-[#ffffff] rounded-t-3xl p-4 pb-8 max-h-[75vh] overflow-y-auto animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-[#0a0a0a]">{currentUser?.name || 'Staff User'}</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-2 rounded-2xl text-[#737373] hover:bg-[#f5f5f5] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-3 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#737373]">{currentUser?.email || 'staff@nepalcan.com'}</p>
                <p className="text-[11px] font-semibold text-[#0a0a0a]">
                  {attendance?.isCheckedIn ? 'Checked In' : 'Off shift'}
                </p>
              </div>
              <button
                onClick={handleToggleAttendance}
                className={`px-3 py-2 rounded-2xl text-xs font-semibold min-h-[44px] cursor-pointer ${
                  attendance?.isCheckedIn ? 'bg-[#ffffff] text-[#e7000b] border border-[#e5e5e5]' : 'bg-[#0a0a0a] text-white'
                }`}
              >
                {attendance?.isCheckedIn ? 'Check Out' : 'Check In'}
              </button>
            </div>

            <div className="space-y-1.5">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const active = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-2xl min-h-[44px] cursor-pointer ${
                      active ? 'bg-[#0a0a0a] text-white' : 'bg-[#fafafa] text-[#0a0a0a] border border-[#e5e5e5]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {(canInstall || isIos) && (
              <button
                onClick={() => { install(); if (!canInstall) setMoreOpen(false); }}
                className="flex items-center justify-center gap-2 mt-3 px-4 py-3 text-sm font-semibold rounded-2xl w-full min-h-[44px] cursor-pointer bg-[#0a0a0a] text-white"
              >
                <Download className="w-4 h-4" />
                {canInstall ? 'Install App' : 'Install via browser menu → Add to Home Screen'}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 mt-3 px-4 py-3 text-sm font-bold text-[#e7000b] bg-[#fff5f5] rounded-2xl w-full min-h-[44px] border border-[#f8d7da] cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}
