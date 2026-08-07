import { useState, useEffect } from 'react';
import { analyticsApi } from '../services/api';
import Breadcrumbs from '../components/Breadcrumbs';
import { Donut, HBars, VBars, CHART_COLORS } from '../components/charts';
import {
  Wallet, Timer, ShieldCheck, Megaphone, ShoppingBag,
  RotateCcw, TrendingUp,
} from 'lucide-react';

const RANGES = [
  { key: 7, label: '7d' },
  { key: 30, label: '30d' },
  { key: 90, label: '90d' },
] as const;

type Range = (typeof RANGES)[number]['key'];

export default function Stats() {
  const [range, setRange] = useState<Range>(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);

  const fetchAnalytics = async (days: number = range) => {
    try {
      setAnalyticsLoading(true);
      setLoadError(false);
      const [overview, slaBreach, callOutcomes, agentPerf, lifecycle] = await Promise.all([
        analyticsApi.getOverview(days),
        analyticsApi.getSlaBreach(days),
        analyticsApi.getCallOutcomes(days),
        analyticsApi.getAgentPerformance(days),
        analyticsApi.getOrderLifecycle(days),
      ]);
      setData({
        window: w,
        overview: overview.data,
        slaBreach: slaBreach.data,
        callOutcomes: callOutcomes.data,
        agentPerformance: agentPerf.data,
        orderLifecycle: lifecycle.data,
        operational: operational.data,
        forecast: forecast.data,
      });
    } catch (err) {
      console.error('Failed to load analytics', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  if (analyticsLoading && !analyticsData) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-[#737373] animate-pulse">
        Loading analytics metrics...
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="space-y-6 pb-16 animate-in">
        <Breadcrumbs items={[{ label: 'Operations Analytics' }]} />
        <div className="card-blueprint p-10 text-center">
          <ShieldCheck className="w-8 h-8 text-[#737373] mx-auto mb-2" />
          <h3 className="font-semibold text-sm text-[#0a0a0a]">Analytics unavailable</h3>
          <p className="text-xs text-[#737373] mt-1">The analytics service did not respond. {loadError ? 'Check the backend API.' : ''}</p>
          <button onClick={() => fetchAnalytics(range)} className="btn-primary text-xs px-4 py-2 mt-4 cursor-pointer">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { overview, slaBreach, callOutcomes, agentPerformance, orderLifecycle } = analyticsData;

  const total = overview?.orders?.total || 0;
  const revenue = overview?.orders?.revenue || 0;
  const breached = overview?.sla?.breached || 0;
  const avgMs = overview?.delivery?.avgTimeToDeliveryMs;
  const avgDelivery = avgMs != null ? `${Math.floor(avgMs / 86400000)}d ${Math.floor((avgMs % 86400000) / 3600000)}h` : '—';
  const tasksDone = overview?.tasks?.byStatus?.completed || 0;
  const slaRate = overview?.tasks?.slaRate;
  const returns = overview?.returns;

  const kpis = [
    { label: 'Total Orders', value: total.toLocaleString(), sub: 'In selected window', icon: ShoppingBag, accent: '' },
    { label: 'Revenue', value: `Rs. ${revenue.toLocaleString()}`, sub: 'Order value', icon: Wallet, accent: '' },
    { label: 'Avg Time to Delivery', value: avgDelivery, sub: 'Order lifecycle span', icon: Timer, accent: '' },
    { label: 'Tasks Completed', value: tasksDone.toLocaleString(), sub: `SLA rate ${slaRate ?? '—'}%`, icon: Megaphone, accent: '' },
    { label: 'Active Returns', value: returns ? `${returns.active}` : '—', sub: `${returns?.resolved || 0} resolved`, icon: RotateCcw, accent: '' },
    { label: 'SLA Breached', value: breached.toLocaleString(), sub: 'Orders past SLA', icon: ShieldCheck, accent: 'text-red-600' },
  ];

  const stageData = Object.entries(overview?.orders?.byStage || {}).map(([name, value]) => ({ name, value: value as number }));
  const stagePct = (name: string) => {
    const v = overview?.orders?.byStage?.[name] || 0;
    return total > 0 ? Math.round((v / total) * 100) : 0;
  };

  const slaDonut = [
    { name: 'On Time', value: Math.max(0, total - breached) },
    { name: 'Breached', value: breached },
  ];

  const slaZoneData = Object.entries(slaBreach?.byZone || {}).map(([name, value]) => ({ name, value: value as number }));
  const slaStageData = Object.entries(slaBreach?.byStage || {}).map(([name, value]) => ({ name, value: value as number }));

  const callData = (callOutcomes?.outcomes || []).map((o: any) => ({
    name: o._id || 'other',
    value: o.count || 0,
    avg: (o.avgDurationMinutes || 0).toFixed(1),
  }));

  const agents = agentPerformance?.agents || [];
  const agentData = agents.map((a: any) => ({ name: a.name || a._id, value: a.tasksCompleted || 0 }));

  const lifecycleData = Object.entries(orderLifecycle?.avgTimeByBundleMs || {}).map(([name, ms]) => ({
    name,
    value: Math.round(((ms as number) / 3600000) * 10) / 10,
  }));

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Operations Analytics' }]} />

      {/* Header */}
      <div className="card-blueprint p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0a0a0a]">Operations Analytics & SLAs</h1>
            <span className="badge-pill badge-pill-solid text-[10px] uppercase">Live Engine Metrics</span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            Comprehensive metric tracking across call velocity, task resolution, and order volumes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-3.5 py-1.5 min-h-[44px] rounded-2xl text-xs font-medium transition-all cursor-pointer ${
                  range === r.key ? 'bg-[#0a0a0a] text-white font-semibold' : 'text-[#737373] hover:text-[#0a0a0a]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => fetchAnalytics(range)} className="btn-outline text-xs px-3 py-2 cursor-pointer">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-blueprint p-4">
            <p className={`text-[10px] uppercase tracking-wider text-[#737373] font-semibold ${k.accent}`}>{k.label}</p>
            <p className={`text-xl font-bold text-[#0a0a0a] mt-1.5 ${k.accent}`}>{k.value}</p>
            <p className="text-[11px] text-[#737373] mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Stage distribution + SLA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-blueprint p-6 space-y-3">
          <h2 className="text-sm font-bold text-[#0a0a0a]">Order Stage Distribution</h2>
          {stageData.length === 0 ? (
            <p className="text-xs text-[#737373] py-8">No orders in range.</p>
          ) : (
            <>
              {stageData.map((s) => (
                <div key={s.name} className="flex items-center gap-3 text-xs">
                  <span className="w-24 sm:w-36 capitalize truncate text-[#737373] font-medium">{s.name}</span>
                  <div className="flex-1 bg-[#f5f5f5] rounded-full h-3 overflow-hidden">
                    <div className="bg-[#0a0a0a] h-full rounded-full transition-all" style={{ width: `${stagePct(s.name)}%` }} />
                  </div>
                  <span className="font-bold text-[#0a0a0a] w-10 text-right">{s.value}</span>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="card-blueprint p-6">
          <h2 className="text-sm font-bold text-[#0a0a0a]">SLA Performance</h2>
          <Donut data={slaDonut} label="SLA breached versus on-time orders" colors={[CHART_COLORS.emerald, CHART_COLORS.ember]} height={240} />
        </div>
      </div>

      {/* SLA breach breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-blueprint p-6">
          <h2 className="text-sm font-bold text-[#0a0a0a]">SLA Breach by Stage</h2>
          {slaStageData.length === 0 ? (
            <p className="text-xs text-[#737373] py-8">No breaches in range.</p>
          ) : (
            <HBars data={slaStageData} color={CHART_COLORS.ember} label="SLA breaches by workflow stage" />
          )}
        </div>
        <div className="card-blueprint p-6">
          <h2 className="text-sm font-bold text-[#0a0a0a]">SLA Breach by Delivery Zone</h2>
          {slaZoneData.length === 0 ? (
            <p className="text-xs text-[#737373] py-8">No breaches in range.</p>
          ) : (
            <HBars data={slaZoneData} color={CHART_COLORS.ember} label="SLA breaches by delivery zone" />
          )}
        </div>
      </div>

      {/* Call outcomes + lifecycle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-blueprint p-6">
          <h2 className="text-sm font-bold text-[#0a0a0a]">Call Outcome Distribution</h2>
          <p className="text-[11px] text-[#737373] mb-2">Count per outcome · tooltip shows avg duration</p>
          {callData.length === 0 ? (
            <p className="text-xs text-[#737373] py-8">No calls logged in range.</p>
          ) : (
            <VBars data={callData} label="Call outcome distribution" />
          )}
        </div>
        <div className="card-blueprint p-6">
          <h2 className="text-sm font-bold text-[#0a0a0a]">Avg Time in Lifecycle Bundle</h2>
          <p className="text-[11px] text-[#737373] mb-2">pre-order → processing → after-delivery → return</p>
          {lifecycleData.length === 0 ? (
            <p className="text-xs text-[#737373] py-8">No history in range.</p>
          ) : (
            <HBars data={lifecycleData} label="Avg time per lifecycle bundle" />
          )}
        </div>
      </div>

      {/* Agent performance */}
      <div className="card-blueprint p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#0a0a0a]">Agent Performance Leaderboard</h2>
        {agentData.length === 0 ? (
          <p className="text-xs text-[#737373]">No agent activity in range.</p>
        ) : (
          <>
            <HBars data={agentData.slice(0, 8)} label="Tasks completed per agent" color={CHART_COLORS.ink} height={Math.min(agents.length, 8) * 40 + 60} />
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
                  {agents.map((a: any, idx: number) => (
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
          </>
        )}
      </div>

      {/* Returns resolution */}
      {orderLifecycle?.returns && Object.keys(orderLifecycle.returns).length > 0 && (
        <div className="card-blueprint p-6 space-y-3">
          <h2 className="text-sm font-bold text-[#0a0a0a]">Return Resolution</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(orderLifecycle.returns).map(([stage, data]) => (
              <div key={stage} className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase text-[#737373]">{stage}</p>
                <p className="text-lg font-bold text-[#0a0a0a] mt-1">{(data as any).count} returns</p>
                <p className="text-[11px] text-[#737373] mt-0.5">avg {Math.round(((data as any).avgResolutionMs) / 3600000)}h to resolve</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}