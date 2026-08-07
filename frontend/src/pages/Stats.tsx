import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { analyticsApi } from '../services/api';
import Breadcrumbs from '../components/Breadcrumbs';
import { TrendingUp } from 'lucide-react';

type RangeKey = '7d' | '30d' | '90d' | 'custom';

const STAGE_LABELS: Record<string, string> = {
  pending_confirmation: 'Pending Order Confirmation',
  done: 'Marked Done',
  confirmed_unprocessed: 'Confirmed But Unprocessed',
  collected_by_logistics: 'Collected by Logistics',
  shipped: 'Shipped Orders',
  pending_review: 'Pending Review Calls',
  customer_response: 'Return: Customer Response',
  vendor_response: 'Return: Vendor Response',
  rescheduled: 'Rescheduled Orders',
  cancelled: 'Cancelled Orders',
  hold: 'Hold Orders',
  other: 'Other',
};

const TYPE_LABELS: Record<string, string> = {
  'customer-confirmation': 'Customer Confirmation',
  'vendor-call': 'Vendor Call',
  'vendor-delay': 'Vendor Delay',
  'cancelled-recovery': 'Cancelled Recovery',
  'review-call': 'Review Call',
  'escalation': 'Escalation',
  'logistics-followup': 'Logistics Follow-up',
  'unknown': 'Other',
};

const BUNDLE_LABELS: Record<string, string> = {
  'pre-order': 'Pre-order',
  processing: 'Processing',
  'after-delivery': 'After-delivery',
  return: 'Return',
};

const fmtMoney = (n: number) => `Rs. ${(n || 0).toLocaleString()}`;
const fmtMs = (ms: number) =>
  ms != null ? `${Math.floor(ms / 86400000)}d ${Math.floor((ms % 86400000) / 3600000)}h` : '—';
const fmtShortDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const fmtDay = (iso: string) => iso.slice(5);

const presetWindow = (r: '7d' | '30d' | '90d') => {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const days = r === '7d' ? 7 : r === '30d' ? 30 : 90;
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to,
    label: r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'Last 90 Days',
  };
};

const KpiTile = ({ label, value, sub, danger }: any) => (
  <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-4">
    <span className="text-[10px] text-[#737373] uppercase font-bold">{label}</span>
    <p className={`text-2xl font-bold mt-1 ${danger ? 'text-red-600' : 'text-[#0a0a0a]'}`}>{value}</p>
    {sub && <p className="text-[11px] text-[#737373] mt-1">{sub}</p>}
  </div>
);

const Section = ({ title, children }: any) => (
  <div className="card-blueprint p-6 space-y-4">
    <h2 className="text-sm font-bold text-[#0a0a0a]">{title}</h2>
    {children}
  </div>
);

const BarRow = ({ label, count, total, sub, color }: any) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-40 sm:w-52 text-[#737373] font-medium truncate">{label}</span>
      <div className="flex-1 bg-[#f5f5f5] rounded-full h-3 overflow-hidden">
        <div className={`${color || 'bg-[#0a0a0a]'} h-full rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="font-bold text-[#0a0a0a] w-16 text-right">{count}</span>
      <span className="text-[#737373] w-28 text-right hidden md:block">{sub}</span>
    </div>
  );
};

export default function Stats() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [range, setRange] = useState<RangeKey>('7d');
  const [tab, setTab] = useState<'present' | 'next'>('present');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const load = async (w: { from: string; to: string; label: string } | null) => {
    try {
      setLoading(true);
      const params = w ? { from: w.from, to: w.to } : {};
      const [overview, slaBreach, callOutcomes, agentPerf, lifecycle, operational, forecast] = await Promise.all([
        analyticsApi.getOverview(params),
        analyticsApi.getSlaBreach(params),
        analyticsApi.getCallOutcomes(params),
        analyticsApi.getAgentPerformance(params),
        analyticsApi.getOrderLifecycle(params),
        analyticsApi.getOperational(params),
        analyticsApi.getForecast(),
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(presetWindow('7d'));
  }, []);

  const handleRange = (r: '7d' | '30d' | '90d') => {
    setRange(r);
    load(presetWindow(r));
  };

  const handleApplyCustom = () => {
    if (!customFrom || !customTo) {
      toast.error('Select both dates');
      return;
    }
    if (customFrom > customTo) {
      toast.error('From date must be before To date');
      return;
    }
    setRange('custom');
    load({ from: customFrom, to: customTo, label: 'Custom Range' });
  };

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-2xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
      active ? 'bg-[#0a0a0a] text-white font-semibold' : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#e5e5e5]'
    }`;

  const tabBtn = (active: boolean) =>
    `py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
      active ? 'bg-[#0a0a0a] text-white shadow-sm' : 'text-[#737373] hover:text-[#0a0a0a]'
    }`;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-[#737373] animate-pulse">
        Loading analytics metrics...
      </div>
    );
  }

  const o = data?.overview;
  const op = data?.operational;
  const fc = data?.forecast;
  const callsByType: Record<string, number> = op?.calls?.byType || {};

  const stageEntries = Object.entries(o?.orders?.byStage || {})
    .map(([stage, count]: [string, any]) => ({
      stage,
      count,
      revenue: o?.orders?.byStageRevenue?.[stage] || 0,
    }))
    .sort((a, b) => b.count - a.count);
  const stageTotal = stageEntries.reduce((a, s) => a + s.count, 0);

  const typeEntries = Object.entries(o?.tasks?.byType || {})
    .map(([type, t]: [string, any]) => ({ type, ...t }))
    .sort((a, b) => b.completed - a.completed);
  const typeTotal = typeEntries.reduce((a, t) => a + t.total, 0);

  const callTypeEntries = Object.entries(callsByType)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const callsTotal = op?.calls?.total || 0;
  const dayMax = Math.max(1, ...(op?.calls?.byDay || []).map((d: any) => d.count));

  const predAvg = fc?.last7dDailyAvg || 0;
  const predTotal = fc?.predictedCallsNextDay ?? 0;
  const predDelta = predAvg > 0 ? Math.round(((predTotal - predAvg) / predAvg) * 100) : 0;

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Operations Analytics' }]} />

      {/* Header + Date Filter */}
      <div className="card-blueprint p-6 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#0a0a0a] tracking-tight">Operations Analytics</h1>
              <span className="badge-pill badge-pill-solid text-[10px] uppercase">
                {data?.window?.label || 'All Time'}
              </span>
            </div>
            <p className="text-xs text-[#737373] mt-1">
              Order, task, staff & call metrics
              {data?.window?.from ? ` · ${fmtShortDate(data.window.from)} – ${fmtShortDate(data.window.to)}` : ' · all time'}
            </p>
          </div>
          <button
            onClick={() => load(range === 'custom' ? (data?.window?.from ? data.window : null) : presetWindow(range as any))}
            disabled={loading}
            className="btn-outline text-xs px-3 py-2 cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{loading ? 'Loading...' : 'Refresh'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[#e5e5e5] pt-4">
          {(['7d', '30d', '90d'] as const).map((r) => (
            <button key={r} onClick={() => handleRange(r)} className={pill(range === r)}>
              {r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </button>
          ))}
          <button onClick={() => setRange('custom')} className={pill(range === 'custom')}>
            Custom
          </button>
          {range === 'custom' && (
            <>
              <input
                type="date"
                className="input-blueprint text-xs w-auto"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="text-xs text-[#737373]">→</span>
              <input
                type="date"
                className="input-blueprint text-xs w-auto"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
              <button onClick={handleApplyCustom} className="btn-primary text-xs px-3 py-2">
                Apply
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl">
        <button onClick={() => setTab('present')} className={tabBtn(tab === 'present')}>
          Present
        </button>
        <button onClick={() => setTab('next')} className={tabBtn(tab === 'next')}>
          Next
        </button>
      </div>

      {/* Next-Day Call Forecast */}
      {tab === 'next' && fc && (
        <Section title="Next-Day Call Forecast">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiTile label="Predicted Calls Tomorrow" value={fc.predictedCallsNextDay ?? '—'} sub={`From ${fc.asOf} current backlog`} />
            <KpiTile label="Last 7 Days Daily Avg" value={fc.last7dDailyAvg || 0} sub="Actual calls / day" />
            <KpiTile
              label="Δ vs Daily Avg"
              value={`${predDelta >= 0 ? '+' : ''}${predDelta}%`}
              sub={predDelta === 0 ? 'Matches daily average' : predDelta > 0 ? 'Higher load expected tomorrow' : 'Lower load expected tomorrow'}
              danger={predDelta > 20}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e5e5e5] text-[#737373] font-semibold">
                  <th className="py-2.5 px-3 text-left">Segment</th>
                  <th className="py-2.5 px-3 text-right">In Queue</th>
                  <th className="py-2.5 px-3 text-right">Call Prob</th>
                  <th className="py-2.5 px-3 text-right">Calls / Order</th>
                  <th className="py-2.5 px-3 text-right">Predicted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e5]">
                {fc.segments?.map((s: any) => (
                  <tr key={s.stage}>
                    <td className="py-2.5 px-3 font-semibold text-[#0a0a0a]">{STAGE_LABELS[s.stage] || s.stage}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{s.currentOrders}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{s.callProbability != null ? `${s.callProbability}%` : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{s.expectedCallsPerOrder != null ? s.expectedCallsPerOrder.toFixed(2) : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">{s.predictedCalls ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[#737373]">Heuristic: current orders in each segment × last-7-day calls-per-order history.</p>
        </Section>
      )}

      {tab === 'present' && (
        <>
      {/* KPI Overview */}
      {o && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile label="Total Orders" value={o.orders?.total || 0} sub={`${stageTotal} across all stages`} />
          <KpiTile label="Revenue" value={fmtMoney(o.orders?.revenue || 0)} sub="In selected period" />
          <KpiTile label="Avg Time to Delivery" value={fmtMs(o.delivery?.avgTimeToDeliveryMs)} sub="Created → delivered" />
          <KpiTile label="SLA Breached" value={o.sla?.breached || 0} sub="Orders past deadline" danger />
        </div>
      )}

      {/* Orders by Workflow Stage */}
      {stageEntries.length > 0 && (
        <Section title="Orders by Workflow Stage">
          <div className="space-y-2">
            {stageEntries.map((s) => (
              <BarRow
                key={s.stage}
                label={STAGE_LABELS[s.stage] || s.stage}
                count={s.count}
                total={stageTotal}
                sub={`${stageTotal > 0 ? Math.round((s.count / stageTotal) * 100) : 0}% · ${fmtMoney(s.revenue)}`}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Tasks Done by Type */}
      {typeEntries.length > 0 && (
        <Section title="Tasks Done by Type">
          <div className="space-y-2">
            {typeEntries.map((t) => (
              <BarRow
                key={t.type}
                label={TYPE_LABELS[t.type] || t.type}
                count={t.completed}
                total={typeTotal}
                color="bg-[#171717]"
                sub={`${t.completed} done / ${t.total} total (${t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0}%)`}
              />
            ))}
          </div>
        </Section>
      )}

      {/* SLA Breach Breakdown */}
      {data?.slaBreach && (
        <Section title="SLA Breach Breakdown">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiTile label="Total Breached" value={data.slaBreach.total || 0} danger />
            <KpiTile label="Revenue at Risk" value={fmtMoney(data.slaBreach.revenueAtRisk || 0)} />
            <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-4">
              <span className="text-[10px] text-[#737373] uppercase font-bold">By Stage</span>
              <div className="mt-2 space-y-1">
                {Object.entries(data.slaBreach.byStage || {}).map(([stage, count]: [string, any]) => (
                  <div key={stage} className="flex justify-between text-xs">
                    <span className="text-[#737373]">{STAGE_LABELS[stage] || stage}</span>
                    <span className="font-bold text-[#0a0a0a]">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {Object.keys(data.slaBreach.byZone || {}).length > 0 && (
            <div className="flex flex-wrap gap-4 text-xs text-[#737373]">
              <span className="font-semibold text-[#0a0a0a]">By Zone:</span>
              {Object.entries(data.slaBreach.byZone).map(([zone, count]: [string, any]) => (
                <span key={zone}>{zone} <b className="text-[#0a0a0a]">{count}</b></span>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Return & Recovery Rates */}
      {op?.rates && (
        <Section title="Return & Recovery Rates">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiTile
              label="Return Rate"
              value={`${op.rates.returnRate.pct}%`}
              sub={`${op.rates.returnRate.returns} returns / ${op.rates.returnRate.orders} orders`}
            />
            <KpiTile label="Returns in Period" value={op.rates.returnRate.returns} sub="Created in window" />
            <KpiTile
              label="Recovery Rate"
              value={`${op.rates.recoveryRate.pct}%`}
              sub={`${op.rates.recoveryRate.recovered} recovered / ${op.rates.recoveryRate.recovered + op.rates.recoveryRate.lost} decided`}
            />
            <KpiTile
              label="Recovered Revenue"
              value={fmtMoney(op.rates.recoveryRate.recoveredRevenue)}
              sub={`${op.rates.recoveryRate.inProgress} in progress`}
            />
          </div>
        </Section>
      )}

      {/* Call Activity */}
      {op?.calls && (
        <Section title="Call Activity">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiTile label="Calls in Period" value={callsTotal} sub="Logged call records" />
            <KpiTile
              label="Vendor Follow-up Calls"
              value={(callsByType['vendor-call'] || 0) + (callsByType['vendor-delay'] || 0)}
              sub="Vendor call + delay follow-ups"
            />
            <KpiTile label="Review Calls" value={callsByType['review-call'] || 0} sub="Post-delivery review calls" />
          </div>
          {callsTotal === 0 ? (
            <p className="text-xs text-[#737373]">No call logs recorded in this period.</p>
          ) : (
            <></>
          )}
          {(op.calls.byDay || []).length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-[#737373] uppercase tracking-wider mb-3">Calls per Day</h3>
              <div className="flex items-end gap-2 h-32">
                {op.calls.byDay.map((d: any) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[#0a0a0a]">{d.count}</span>
                    <div
                      className="w-full bg-[#0a0a0a] rounded-t-md transition-all"
                      style={{ height: `${Math.max(4, (d.count / dayMax) * 70)}px` }}
                    />
                    <span className="text-[10px] text-[#737373]">{fmtDay(d.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {callTypeEntries.length > 0 && (
            <div className="space-y-2">
              {callTypeEntries.map((c) => (
                <BarRow
                  key={c.type}
                  label={TYPE_LABELS[c.type] || c.type}
                  count={c.count}
                  total={callsTotal}
                  color="bg-[#dc3545]"
                  sub={`${callsTotal > 0 ? Math.round((c.count / callsTotal) * 100) : 0}% of calls`}
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Call Outcome Distribution */}
      {data?.callOutcomes && (
        <Section title="Call Outcome Distribution">
          {(data.callOutcomes.outcomes || []).length === 0 ? (
            <p className="text-xs text-[#737373]">No call logs recorded in this period.</p>
          ) : (
            <div className="space-y-2">
              {data.callOutcomes.outcomes.map((o: any) => (
                <BarRow
                  key={o._id}
                  label={o._id}
                  count={o.count}
                  total={data.callOutcomes.total || 1}
                  color="bg-[#dc3545]"
                  sub={`avg ${o.avgDurationMinutes?.toFixed(1) || 0}m`}
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Staff-wise Performance */}
      {data?.agentPerformance && (
        <Section title="Staff-wise Performance">
          {(data.agentPerformance.agents || []).length === 0 ? (
            <p className="text-xs text-[#737373]">
              No tasks assigned to staff in this period. Tasks are assigned via rules (assigneeId/team) or manual assignment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-[#e5e5e5] text-[#737373] font-semibold">
                    <th className="py-3 px-4 text-left">Agent</th>
                    <th className="py-3 px-4 text-right">Tasks Done</th>
                    <th className="py-3 px-4 text-right">Overdue</th>
                    <th className="py-3 px-4 text-right">Pending</th>
                    <th className="py-3 px-4 text-right">Avg Resolution</th>
                    <th className="py-3 px-4 text-right">Calls</th>
                    <th className="py-3 px-4 text-right">Avg Call</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e5]">
                  {(data.agentPerformance.agents as any[])
                    .slice()
                    .sort((a: any, b: any) => (b.tasksCompleted || 0) - (a.tasksCompleted || 0))
                    .map((a: any, idx: number) => (
                      <tr key={a.name || idx} className={idx === 0 ? 'bg-emerald-50' : ''}>
                        <td className="py-3 px-4 font-bold text-[#0a0a0a]">#{idx + 1} {a.name}</td>
                        <td className="py-3 px-4 text-right font-mono">{a.tasksCompleted || 0}</td>
                        <td className="py-3 px-4 text-right font-mono text-red-600">{a.tasksOverdue || 0}</td>
                        <td className="py-3 px-4 text-right font-mono">{a.tasksPending || 0}</td>
                        <td className="py-3 px-4 text-right font-mono">{a.avgTaskResolutionMinutes || 0}m</td>
                        <td className="py-3 px-4 text-right font-mono">{a.calls || 0}</td>
                        <td className="py-3 px-4 text-right font-mono">{a.avgCallDurationMinutes || 0}m</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* Order Lifecycle */}
      {data?.orderLifecycle && (
        <Section title="Avg Time in Stage (Lifecycle)">
          <div className="space-y-2">
            {(() => {
              const entries = Object.entries(data.orderLifecycle.avgTimeByBundleMs || {}) as [string, number][];
              const maxH = Math.max(0, ...entries.map(([, ms]) => Math.floor(ms / 3600000)));
              return entries.map(([bundle, ms]) => {
                const h = Math.floor(ms / 3600000);
                return (
                  <BarRow
                    key={bundle}
                    label={BUNDLE_LABELS[bundle] || bundle}
                    count={h}
                    total={maxH}
                    sub={`${h}h`}
                  />
                );
              });
            })()}
          </div>
          {data.orderLifecycle.returns && (
            <div className="pt-3 border-t border-[#e5e5e5]">
              <h3 className="text-xs font-bold text-[#737373] uppercase tracking-wider mb-2">Return Resolution</h3>
              {Object.entries(data.orderLifecycle.returns).map(([stage, d]: [string, any]) => (
                <div key={stage} className="flex items-center gap-3 text-xs py-1">
                  <span className="w-40 text-[#737373] font-medium capitalize">{stage}</span>
                  <span className="font-bold text-[#0a0a0a]">{d.count} returns</span>
                  <span className="text-[#737373]">avg {Math.round(d.avgResolutionMs / 3600000)}h</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
        </>
      )}
    </div>
  );
}
