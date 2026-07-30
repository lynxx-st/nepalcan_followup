import { useState, useEffect } from 'react';
import { dashboardApi, taskApi } from '../services/api';
import {
  BarChart3, PhoneCall, Clock, CheckCircle2, TrendingUp, Zap, User,
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
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading analytics...</div>;
  }

  const s = stats;

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl flex items-start gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-black text-white">Performance Analytics</h1>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Call efficiency, task completion, and operations metrics.
          </p>
        </div>
      </div>

      {s?.dashboard && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>Tasks Completed</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-3xl font-black text-slate-900">{s.dashboard.totalCompleted || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>Overdue</span>
                <Clock className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-3xl font-black text-red-600">{s.dashboard.totalOverdue || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>Today's Tasks</span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-3xl font-black text-amber-600">{s.today?.summary?.total || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>Recent Calls</span>
                <PhoneCall className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-3xl font-black text-blue-600">{s.today?.recentCallLogs?.length || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Orders</p>
              <p className="text-2xl font-black text-slate-900">{s.dashboard.totalOrders || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pending Orders</p>
              <p className="text-2xl font-black text-yellow-600">{s.dashboard.pendingOrders || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Delivered</p>
              <p className="text-2xl font-black text-emerald-600">{s.dashboard.deliveredOrders || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cancelled</p>
              <p className="text-2xl font-black text-red-600">{s.dashboard.cancelledOrders || 0}</p>
            </div>
          </div>
        </>
      )}

      {s?.allTasks?.tasks && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide mb-4">Task Breakdown</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-black text-slate-900">{s.allTasks.total || 0}</p>
              <p className="text-xs text-slate-500">Total Tasks</p>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-xl">
              <p className="text-2xl font-black text-emerald-600">
                {s.allTasks.tasks.filter((t: any) => t.status === 'completed').length}
              </p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-xl">
              <p className="text-2xl font-black text-red-600">
                {s.allTasks.tasks.filter((t: any) => t.status === 'overdue').length}
              </p>
              <p className="text-xs text-slate-500">Overdue</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-xl">
              <p className="text-2xl font-black text-amber-600">
                {s.allTasks.tasks.filter((t: any) => t.status === 'pending').length}
              </p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
          </div>
        </div>
      )}

      {s?.dashboard?.callStats?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide mb-4">Call Outcomes</h2>
          <div className="space-y-2">
            {s.dashboard.callStats.map((stat: any) => (
              <div key={stat._id} className="flex justify-between items-center border-b pb-2 text-sm">
                <span className="capitalize font-medium">{stat._id}</span>
                <div className="flex items-center gap-4">
                  <span className="font-bold">{stat.count}</span>
                  <span className="text-xs text-slate-400">avg {stat.avgDuration?.toFixed(1)} min</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
