import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { dashboardApi, commerceApi, taskApi, attendanceApi } from '../services/api';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import SLACountdown from '../components/SLACountdown';
import Breadcrumbs from '../components/Breadcrumbs';
import { getSLAInfo } from '../utils/ruleEngine';
import { entityName } from '../utils/order';
import {
  PhoneCall, Store, Clock, RefreshCw, Star, AlertTriangle,
  Zap, ArrowRight, CheckCircle2, TrendingUp, Filter, X, Truck, Calendar,
  UserCheck, ShieldCheck, DollarSign, Activity, Play, CheckSquare, Layers, Eye,
} from 'lucide-react';

const STAGE_TABS = [
  { key: 'all', label: 'All Pending' },
  { key: 'preOrder', label: 'PRE PROCESSING', description: 'Confirmation & verification' },
  { key: 'processing', label: 'Processing', description: 'Vendor & logistics delays' },
  { key: 'afterDelivery', label: 'After Delivery', description: 'Review & NPS feedback' },
  { key: 'return', label: 'Return', description: 'Recovery & escalations' },
] as const;

export default function TodayWork() {
  const navigate = useNavigate();
  const { simulatedTimeIso } = useSimulatedTime();
  const [orders, setOrders] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch { return null; }
  })();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashRes, todayRes] = await Promise.all([
        dashboardApi.getOrders().catch(() => null),
        dashboardApi.getToday().catch(() => null),
      ]);
      setOrders(dashRes?.data?.orders || []);
      setSummary(todayRes?.data || null);
      if (todayRes?.data?.attendance) {
        setAttendance(todayRes.data.attendance);
      }
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceStatus = async () => {
    try {
      const res: any = await attendanceApi.getStatus();
      if (res?.data) setAttendance(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    window.addEventListener('orders-updated', fetchData);
    return () => window.removeEventListener('orders-updated', fetchData);
  }, []);

  const handleToggleAttendance = async () => {
    try {
      if (attendance?.isCheckedIn) {
        await attendanceApi.checkOut();
        toast.success('Shift checked out');
      } else {
        await attendanceApi.checkIn();
        toast.success('Shift checked in');
      }
      fetchAttendanceStatus();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update attendance');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await commerceApi.syncAll();
      toast.success('Sync completed!');
      fetchData();
    } catch {
      toast.error('Failed to sync orders');
    } finally {
      setSyncing(false);
    }
  };

  // Filter orders by active stage
  const filteredOrders = orders.filter((o: any) => {
    if (activeStage === 'all') return true;
    const type = o.taskType || '';
    if (activeStage === 'preOrder') return type === 'customer-confirmation';
    if (activeStage === 'processing') return ['vendor-call', 'vendor-delay', 'logistics-followup'].includes(type);
    if (activeStage === 'afterDelivery') return type === 'review-call';
    if (activeStage === 'return') return ['cancelled-recovery', 'escalation'].includes(type);
    return true;
  });

  const stageCounts = {
    preOrder: orders.filter(o => o.taskType === 'customer-confirmation').length,
    processing: orders.filter(o => ['vendor-call', 'vendor-delay', 'logistics-followup'].includes(o.taskType)).length,
    afterDelivery: orders.filter(o => o.taskType === 'review-call').length,
    return: orders.filter(o => ['cancelled-recovery', 'escalation'].includes(o.taskType)).length,
  };

  const slaRate = summary?.summary?.slaRate ?? 100;
  const revenueAtRisk = summary?.summary?.revenueAtRisk ?? 0;
  const totalPending = summary?.summary?.pending ?? orders.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#737373] text-sm animate-pulse">Loading engine dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: "Today's Work & Shift Dashboard" }]} />

      {/* User Info & Shift Attendance Header Card */}
      <div className="card-blueprint p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0a0a0a] text-white flex items-center justify-center font-bold text-lg shadow-xs">
            {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'OP'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-[#0a0a0a]">
                Welcome back, {currentUser?.name || 'Operations Agent'}
              </h1>
              <span className="badge-pill badge-pill-solid text-[10px] uppercase tracking-wider">
                {currentUser?.role || 'staff'}
              </span>
            </div>
            <p className="text-xs text-[#737373] mt-0.5">
              {currentUser?.email || 'staff@nepalcan.com'} · {currentUser?.team || 'Core Follow-up Team'}
            </p>
          </div>
        </div>

        {/* Shift Attendance Widget */}
        <div className="flex items-center gap-3 bg-[#fafafa] border border-[#e5e5e5] p-2.5 rounded-2xl w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2 pl-1">
            <span className={`w-2.5 h-2.5 rounded-full ${attendance?.isCheckedIn ? 'bg-emerald-500 animate-pulse' : 'bg-[#737373]'}`} />
            <div>
              <p className="text-xs font-semibold text-[#0a0a0a]">
                {attendance?.isCheckedIn ? 'Active Working Shift' : 'Shift Off Duty'}
              </p>
              <p className="text-[10px] text-[#737373]">
                {attendance?.isCheckedIn
                  ? `Duration: ${attendance?.activeShift?.currentDurationMinutes || 0} minutes`
                  : 'Click check-in to record attendance'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleAttendance}
            className={`btn-primary text-xs px-4 py-2 shrink-0 ${
              attendance?.isCheckedIn ? 'bg-[#171717] hover:bg-[#0a0a0a]' : 'bg-[#0a0a0a] hover:bg-[#171717]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{attendance?.isCheckedIn ? 'Check Out' : 'Check In'}</span>
          </button>
        </div>
      </div>

      {/* KPI Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: SLA Compliance */}
        <div className="card-blueprint p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#737373]">SLA Compliance Rate</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold tracking-tight text-[#0a0a0a]">{slaRate}%</span>
              <span className="text-xs text-emerald-600 font-medium">On-time target</span>
            </div>
            <p className="text-[11px] text-[#737373] mt-1">Tasks completed within SLA window</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#fafafa] border border-[#e5e5e5] flex items-center justify-center text-[#0a0a0a]">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Active Pending & Revenue at Risk */}
        <div className="card-blueprint p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#737373]">Active Pending Actions</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold tracking-tight text-[#0a0a0a]">{totalPending}</span>
              <span className="text-xs font-semibold text-[#0a0a0a]">
                Rs. {revenueAtRisk.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-[#737373] mt-1">Total revenue value at risk</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#fafafa] border border-[#e5e5e5] flex items-center justify-center text-[#0a0a0a]">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Call Performance & Quick Trigger */}
        <div className="card-blueprint p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#737373]">Call Engine Mode</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => navigate('/next')}
                className="btn-primary text-xs w-full py-2 cursor-pointer shadow-xs"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>START NEXT CALL</span>
              </button>
            </div>
            <p className="text-[11px] text-[#737373] mt-2">Next highest priority call in queue</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#fafafa] border border-[#e5e5e5] flex items-center justify-center text-[#0a0a0a] shrink-0">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Pending Items Dashboard */}
      <div className="card-blueprint p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#e5e5e5] pb-4">
          <div>
            <h2 className="text-base font-bold text-[#0a0a0a] tracking-tight">Pending Follow-up Workstation</h2>
            <p className="text-xs text-[#737373]">Categorized pending tasks bundled by workflow stage</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-outline text-xs px-3 py-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Commerce'}</span>
            </button>
            <button
              onClick={() => navigate('/next')}
              className="btn-primary text-xs px-4 py-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Start Call Queue</span>
            </button>
          </div>
        </div>

        {/* 4 Stage Segment Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#e5e5e5]">
          {STAGE_TABS.map((tab) => {
            const count = tab.key === 'all'
              ? orders.length
              : stageCounts[tab.key as keyof typeof stageCounts] || 0;
            const isActive = activeStage === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveStage(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0a0a0a] text-white shadow-2xs'
                    : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#e5e5e5]'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-[#ffffff] text-[#0a0a0a]' : 'bg-[#e5e5e5] text-[#0a0a0a]'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Pending Items Grid / List */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-[#fafafa] rounded-2xl border border-[#e5e5e5]">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-[#0a0a0a]">No Pending Items in Stage</h3>
            <p className="text-xs text-[#737373] mt-1">All follow-ups for this workflow category have been resolved!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrders.map((order: any) => {
              const customerName = entityName(order.customer?.name) || 'Customer';
              const slaInfo = order.dueAt ? getSLAInfo(order.dueAt, simulatedTimeIso) : null;
              return (
                <div
                  key={order.commerceOrderId || order._id}
                  className="bg-[#ffffff] border border-[#e5e5e5] rounded-2xl p-4 hover:border-[#0a0a0a] transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/orders/${order.commerceOrderId}`}
                          className="font-bold text-sm text-[#0a0a0a] hover:underline"
                        >
                          #{order.orderId || order.commerceOrderId}
                        </Link>
                        <span className="badge-pill badge-pill-soft text-[11px]">
                          {order.taskType || 'Task'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#0a0a0a] mt-1">{customerName}</p>
                      <p className="text-xs text-[#737373]">Phone: {order.customerPhone || order.customer?.phone || 'N/A'}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-[#0a0a0a]">
                        Rs. {(
                          order.totalAmount ||
                          order.commerce?.totalAmount ||
                          (order.items || order.commerce?.items || []).reduce((acc: number, it: any) => acc + (Number(it.price || it.product?.price || it.product?.sellingPrice || it.variant?.sellingPrice || 0) * Number(it.quantity || 1)), 0) ||
                          0
                        ).toLocaleString()}
                      </span>
                      {order.dueAt && (
                        <div className="mt-1">
                          <SLACountdown dueAt={order.dueAt} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#f5f5f5] gap-2">
                    <Link
                      to={`/orders/${order.commerceOrderId}`}
                      className="text-xs font-medium text-[#737373] hover:text-[#0a0a0a] flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Order</span>
                    </Link>

                    <button
                      onClick={() => navigate('/next')}
                      className="btn-primary text-xs px-3.5 py-1.5 cursor-pointer"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Call Now</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
