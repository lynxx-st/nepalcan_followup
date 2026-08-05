import { useState, useEffect } from 'react';
import { dashboardApi, taskApi } from '../services/api';
import Breadcrumbs from '../components/Breadcrumbs';
import {
  BarChart3, PhoneCall, Clock, CheckCircle2, TrendingUp, Zap, User, ShieldCheck,
} from 'lucide-react';

export default function Stats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [dashRes, todayRes, taskRes] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getToday(),
          taskApi.list({ limit: 100 }),
        ]);
        setStats({
          dashboard: (dashRes as any).data,
          today: (todayRes as any).data,
          allTasks: (taskRes as any).data,
        });
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-[#737373] animate-pulse">
        Loading analytics metrics...
      </div>
    );
  }

  const s = stats;

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Operations Analytics' }]} />

      {/* Header Container */}
      <div className="card-blueprint p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0a0a0a]">Operations Analytics & SLAs</h1>
            <span className="badge-pill badge-pill-solid text-[10px] uppercase">
              Live Engine Metrics
            </span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            Comprehensive metric tracking across call velocity, task resolution, and order volumes.
          </p>
        </div>
      </div>

      {s?.dashboard && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-blueprint p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">Tasks Completed</span>
              <p className="text-3xl font-bold text-[#0a0a0a] mt-1">{s.dashboard.totalCompleted || 0}</p>
              <p className="text-[11px] text-[#737373] mt-1">Resolved task actions</p>
            </div>
            <div className="card-blueprint p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">SLA Breached</span>
              <p className="text-3xl font-bold text-red-600 mt-1">{s.dashboard.totalOverdue || 0}</p>
              <p className="text-[11px] text-[#737373] mt-1">Overdue follow-ups</p>
            </div>
            <div className="card-blueprint p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">Today's Created</span>
              <p className="text-3xl font-bold text-[#0a0a0a] mt-1">{s.today?.summary?.total || 0}</p>
              <p className="text-[11px] text-[#737373] mt-1">Generated tasks</p>
            </div>
            <div className="card-blueprint p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">Recent Call Logs</span>
              <p className="text-3xl font-bold text-[#0a0a0a] mt-1">{s.today?.recentCallLogs?.length || 0}</p>
              <p className="text-[11px] text-[#737373] mt-1">Logged call entries</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-blueprint p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">Total Commerce Orders</span>
              <p className="text-2xl font-bold text-[#0a0a0a] mt-1">{s.dashboard.totalOrders || 0}</p>
            </div>
            <div className="card-blueprint p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">Pending Orders</span>
              <p className="text-2xl font-bold text-[#0a0a0a] mt-1">{s.dashboard.pendingOrders || 0}</p>
            </div>
            <div className="card-blueprint p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">Delivered Orders</span>
              <p className="text-2xl font-bold text-[#0a0a0a] mt-1">{s.dashboard.deliveredOrders || 0}</p>
            </div>
            <div className="card-blueprint p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">Cancelled Orders</span>
              <p className="text-2xl font-bold text-red-600 mt-1">{s.dashboard.cancelledOrders || 0}</p>
            </div>
          </div>
        </>
      )}

      {s?.dashboard?.callStats?.length > 0 && (
        <div className="card-blueprint p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#0a0a0a]">Call Outcome Distribution</h2>
          <div className="divide-y divide-[#e5e5e5]">
            {s.dashboard.callStats.map((stat: any) => (
              <div key={stat._id} className="py-3 flex justify-between items-center text-xs">
                <span className="capitalize font-semibold text-[#0a0a0a]">{stat._id}</span>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-[#0a0a0a]">{stat.count} calls</span>
                  <span className="text-[#737373]">Avg {stat.avgDuration?.toFixed(1) || 0} min</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
