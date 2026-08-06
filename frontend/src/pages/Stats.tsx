import { useState, useEffect } from 'react';
import { dashboardApi, taskApi, analyticsApi } from '../services/api';
import Breadcrumbs from '../components/Breadcrumbs';
import {
  BarChart3, PhoneCall, Clock, CheckCircle2, TrendingUp, Zap, User, ShieldCheck,
  AlertTriangle, ArrowDown, ArrowUp, Minus, Download, Filter,
} from 'lucide-react';

export default function Stats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchStats();
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const [overview, slaBreach, callOutcomes, agentPerf, lifecycle] = await Promise.all([
        analyticsApi.getOverview(),
        analyticsApi.getSlaBreach(),
        analyticsApi.getCallOutcomes(),
        analyticsApi.getAgentPerformance(),
        analyticsApi.getOrderLifecycle(),
      ]);
      setAnalyticsData({
        overview: (overview as any).data,
        slaBreach: (slaBreach as any).data,
        callOutcomes: (callOutcomes as any).data,
        agentPerformance: (agentPerf as any).data,
        orderLifecycle: (lifecycle as any).data,
      });
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

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
         <div className="flex items-center gap-2">
           <button onClick={fetchAnalytics} disabled={analyticsLoading} className="btn-outline text-xs px-3 py-1.5 cursor-pointer">
             <TrendingUp className="w-3.5 h-3.5" />
             <span>{analyticsLoading ? 'Loading...' : 'Refresh Analytics'}</span>
           </button>
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

       {/* Analytics Charts */}
       {analyticsData && (
         <div className="space-y-6">
           {/* Overview KPIs */}
           {analyticsData.overview && (
             <div className="card-blueprint p-6 space-y-4">
               <h2 className="text-sm font-bold text-[#0a0a0a]">Analytics Overview</h2>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-4">
                   <span className="text-[10px] text-[#737373] uppercase font-bold">Total Orders</span>
                   <p className="text-2xl font-bold text-[#0a0a0a] mt-1">{analyticsData.overview.orders?.total || 0}</p>
                 </div>
                 <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-4">
                   <span className="text-[10px] text-[#737373] uppercase font-bold">Revenue</span>
                   <p className="text-2xl font-bold text-[#0a0a0a] mt-1">Rs. {(analyticsData.overview.orders?.revenue || 0).toLocaleString()}</p>
                 </div>
                 <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-4">
                   <span className="text-[10px] text-[#737373] uppercase font-bold">Avg Time to Delivery</span>
                   <p className="text-2xl font-bold text-[#0a0a0a] mt-1">
                     {analyticsData.overview.delivery?.avgTimeToDeliveryMs != null
                       ? `${Math.floor(analyticsData.overview.delivery.avgTimeToDeliveryMs / 86400000)}d ${Math.floor((analyticsData.overview.delivery.avgTimeToDeliveryMs % 86400000) / 3600000)}h`
                       : '—'}
                   </p>
                 </div>
                 <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-4">
                   <span className="text-[10px] text-[#737373] uppercase font-bold">SLA Breached</span>
                   <p className="text-2xl font-bold text-red-600 mt-1">{analyticsData.overview.sla?.breached || 0}</p>
                 </div>
               </div>
             </div>
           )}

           {/* Order Stage Distribution */}
           {analyticsData.overview?.orders?.byStage && (
             <div className="card-blueprint p-6 space-y-4">
               <h2 className="text-sm font-bold text-[#0a0a0a]">Order Stage Distribution</h2>
               <div className="space-y-2">
                 {Object.entries(analyticsData.overview.orders.byStage).map(([stage, count]: [string, number]) => {
                   const total = Object.values(analyticsData.overview.orders.byStage || {}).reduce((a: number, b: number) => a + b, 0);
                   const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                   return (
                     <div key={stage} className="flex items-center gap-3 text-xs">
                       <span className="w-32 text-[#737373] font-medium">{stage}</span>
                       <div className="flex-1 bg-[#f5f5f5] rounded-full h-3 overflow-hidden">
                         <div className="bg-[#0a0a0a] h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                       </div>
                       <span className="font-bold text-[#0a0a0a] w-12 text-right">{count}</span>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}

           {/* SLA Breach Breakdown */}
           {analyticsData.slaBreach && (
             <div className="card-blueprint p-6 space-y-4">
               <h2 className="text-sm font-bold text-[#0a0a0a]">SLA Breach Breakdown</h2>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-4">
                   <span className="text-[10px] text-[#737373] uppercase font-bold">Total Breached</span>
                   <p className="text-2xl font-bold text-red-600 mt-1">{analyticsData.slaBreach.total || 0}</p>
                 </div>
                 <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-4">
                   <span className="text-[10px] text-[#737373] uppercase font-bold">Revenue at Risk</span>
                   <p className="text-2xl font-bold text-[#0a0a0a] mt-1">Rs. {(analyticsData.slaBreach.revenueAtRisk || 0).toLocaleString()}</p>
                 </div>
                 <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-4 col-span-2 md:col-span-1">
                   <span className="text-[10px] text-[#737373] uppercase font-bold">By Stage</span>
                   <div className="mt-2 space-y-1">
                     {Object.entries(analyticsData.slaBreach.byStage || {}).map(([stage, count]: [string, number]) => (
                       <div key={stage} className="flex justify-between text-xs">
                         <span className="text-[#737373]">{stage}</span>
                         <span className="font-bold text-[#0a0a0a]">{count}</span>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
             </div>
           )}

           {/* Call Outcome Distribution */}
           {analyticsData.callOutcomes && (
             <div className="card-blueprint p-6 space-y-4">
               <h2 className="text-sm font-bold text-[#0a0a0a]">Call Outcome Distribution</h2>
               <div className="space-y-2">
                 {analyticsData.callOutcomes.outcomes?.map((o: any) => (
                   <div key={o._id} className="flex items-center gap-3 text-xs">
                     <span className="w-32 text-[#0a0a0a] font-semibold capitalize">{o._id}</span>
                     <div className="flex-1 bg-[#f5f5f5] rounded-full h-3 overflow-hidden">
                       <div className="bg-[#dc3545] h-full rounded-full transition-all" style={{ width: `${Math.min(100, (o.count / (analyticsData.callOutcomes.total || 1)) * 100)}%` }} />
                     </div>
                     <span className="font-bold text-[#0a0a0a] w-16 text-right">{o.count} calls</span>
                     <span className="text-[#737373] w-20 text-right">avg {o.avgDurationMinutes?.toFixed(1) || 0}m</span>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* Agent Performance Leaderboard */}
           {analyticsData.agentPerformance && (
             <div className="card-blueprint p-6 space-y-4">
               <h2 className="text-sm font-bold text-[#0a0a0a]">Agent Performance Leaderboard</h2>
               <div className="overflow-x-auto">
                 <table className="w-full text-xs border-collapse">
                   <thead>
                     <tr className="bg-[#fafafa] border-b border-[#e5e5e5] text-[#737373] font-semibold">
                       <th className="py-3 px-4 text-left">Agent</th>
                       <th className="py-3 px-4 text-right">Tasks Done</th>
                       <th className="py-3 px-4 text-right">Overdue</th>
                       <th className="py-3 px-4 text-right">Avg Resolution</th>
                       <th className="py-3 px-4 text-right">Calls</th>
                       <th className="py-3 px-4 text-right">Avg Call</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#e5e5e5]">
                     {analyticsData.agentPerformance.agents?.map((a: any, idx: number) => (
                       <tr key={a.name || idx} className={idx === 0 ? 'bg-emerald-50' : ''}>
                         <td className="py-3 px-4 font-bold text-[#0a0a0a]">#{idx + 1} {a.name}</td>
                         <td className="py-3 px-4 text-right font-mono">{a.tasksCompleted || 0}</td>
                         <td className="py-3 px-4 text-right font-mono text-red-600">{a.tasksOverdue || 0}</td>
                         <td className="py-3 px-4 text-right font-mono">{a.avgTaskResolutionMinutes || 0}m</td>
                         <td className="py-3 px-4 text-right font-mono">{a.calls || 0}</td>
                         <td className="py-3 px-4 text-right font-mono">{a.avgCallDurationMinutes || 0}m</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           )}

           {/* Order Lifecycle */}
           {analyticsData.orderLifecycle && (
             <div className="card-blueprint p-6 space-y-4">
               <h2 className="text-sm font-bold text-[#0a0a0a]">Avg Time in Stage (Lifecycle)</h2>
               <div className="space-y-2">
                 {Object.entries(analyticsData.orderLifecycle.avgTimeByBundleMs || {}).map(([bundle, ms]: [string, number]) => (
                   <div key={bundle} className="flex items-center gap-3 text-xs">
                     <span className="w-32 text-[#737373] font-medium capitalize">{bundle}</span>
                     <div className="flex-1 bg-[#f5f5f5] rounded-full h-3 overflow-hidden">
                       <div className="bg-[#0a0a0a] h-full rounded-full transition-all" style={{ width: `${Math.min(100, (ms / 3600000) / 24)}%` }} />
                     </div>
                     <span className="font-bold text-[#0a0a0a] w-24 text-right">{Math.floor(ms / 3600000)}h</span>
                   </div>
                 ))}
               </div>
               {analyticsData.orderLifecycle.returns && (
                 <div className="pt-3 border-t border-[#e5e5e5]">
                   <h3 className="text-xs font-bold text-[#737373] uppercase tracking-wider mb-2">Return Resolution</h3>
                   {Object.entries(analyticsData.orderLifecycle.returns).map(([stage, data]: [string, any]) => (
                     <div key={stage} className="flex items-center gap-3 text-xs py-1">
                       <span className="w-32 text-[#737373] font-medium capitalize">{stage}</span>
                       <span className="font-bold text-[#0a0a0a]">{data.count} returns</span>
                       <span className="text-[#737373]">avg {Math.round(data.avgResolutionMs / 3600000)}h</span>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           )}
         </div>
       )}
     </div>
   );
 }
