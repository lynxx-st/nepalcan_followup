import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { recoveryApi } from '../services/api';
import Breadcrumbs from '../components/Breadcrumbs';
import { Donut, HBars, TrendArea, CHART_COLORS } from '../components/charts';
import { CheckCircle2, Search, Eye, PiggyBank, Target, Repeat, Coins, Percent } from 'lucide-react';

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function Recovery() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recRes, statsRes]: any[] = await Promise.all([
        recoveryApi.list(),
        recoveryApi.getStats().catch(() => null),
      ]);
      setRecords(recRes?.data || []);
      setStats(statsRes?.data || null);
    } catch (err) {
      console.error('Failed to load recovery data', err);
    } finally {
      setLoading(false);
    }
  };

  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdate = async (id: string, outcome: string) => {
    try {
      await recoveryApi.update(id, { outcome });
      toast.success(`Marked as ${outcome}`);
      fetchData();
    } catch {
      toast.error('Failed to update campaign');
    }
  };

  const recovered = records.filter((r) => r.outcome === 'recovered');
  const lost = records.filter((r) => r.outcome === 'lost');
  const active = records.filter((r) => !r.outcome || r.outcome === 'pending' || r.outcome === 'in-progress');
  const totalRecoveredRevenue = recovered.reduce((sum, r) => sum + (r.recoveredRevenue || r.revenueAmount || 0), 0);
  const revenueAtRisk = records
    .filter((r) => r.outcome !== 'recovered')
    .reduce((sum, r) => sum + (r.revenueAmount || 0), 0);
  const recoveryRate = recovered.length + lost.length > 0 ? Math.round((recovered.length / (recovered.length + lost.length)) * 100) : 0;
  const avgPerRecovery = recovered.length > 0 ? Math.round(totalRecoveredRevenue / recovered.length) : 0;

  const donutData = [
    { name: 'Recovered', value: recovered.length },
    { name: 'In Progress', value: active.length },
    { name: 'Lost', value: lost.length },
  ];
  const donutColors = [CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.ember];

  const trendData = (() => {
    const days = 14;
    const buckets: Record<string, { label: string; recovered: number; lost: number }> = {};
    const order: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      buckets[key] = {
        label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        recovered: 0,
        lost: 0,
      };
      order.push(key);
    }
    for (const r of records) {
      const bucket = r.outcome === 'recovered' || r.outcome === 'lost';
      if (!bucket) continue;
      const key = dayKey(r.updatedAt ? new Date(r.updatedAt) : new Date());
      if (buckets[key]) buckets[key][r.outcome as 'recovered' | 'lost'] += 1;
    }
    return order.map((k) => buckets[k]);
  })();

  const reasonStats = (stats?.byReason || []).slice(0, 8).map((r: any) => ({
    name: r._id || 'Unknown',
    value: r.count,
  }));

  const filteredRecords = records.filter((r) => {
    if (filterOutcome !== 'all') {
      const matches =
        filterOutcome === 'pending'
          ? !r.outcome || r.outcome === 'pending' || r.outcome === 'in-progress'
          : r.outcome === filterOutcome;
      if (!matches) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (r.orderNumber || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.cancellationReason || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const kpis = [
    { label: 'Recovered Revenue', value: `Rs. ${totalRecoveredRevenue.toLocaleString()}`, sub: `${recovered.length} orders recovered`, icon: PiggyBank, accent: 'text-emerald-700' },
    { label: 'Success Rate', value: `${recoveryRate}%`, sub: `${recovered.length} of ${recovered.length + lost.length} resolved`, icon: Target, accent: '' },
    { label: 'Active Queue', value: `${active.length}`, sub: 'Pending campaign calls', icon: Repeat, accent: '' },
    { label: 'Avg per Recovery', value: `Rs. ${avgPerRecovery.toLocaleString()}`, sub: 'Revenue recaptured / order', icon: Coins, accent: '' },
    { label: 'Revenue at Risk', value: `Rs. ${revenueAtRisk.toLocaleString()}`, sub: 'Still to recover or lost', icon: Percent, accent: 'text-red-600' },
  ];

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Cancelled Order Recovery' }]} />

      <div className="card-blueprint p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0a0a0a]">Cancelled Revenue Recovery</h1>
            <span className="badge-pill badge-pill-solid text-[10px] uppercase">{records.length} Campaigns</span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            Automated recovery queues targeting cancelled orders to recover lost revenue.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card-blueprint p-4">
              <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${k.accent}`} />
                <p className="text-[10px] uppercase tracking-wider text-[#737373] font-semibold">{k.label}</p>
              </div>
              <p className={`text-xl font-bold text-[#0a0a0a] mt-1.5 ${k.accent}`}>{k.value}</p>
              <p className="text-[11px] text-[#737373] mt-0.5">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-blueprint p-6">
          <h2 className="text-sm font-bold text-[#0a0a0a]">Outcome Distribution</h2>
          <Donut data={donutData} colors={donutColors} label="Recovery outcome distribution" height={230} />
        </div>
        <div className="card-blueprint p-6">
          <h2 className="text-sm font-bold text-[#0a0a0a]">Recovery Activity · last 14 days</h2>
          <TrendArea
            data={trendData}
            label="Recovered versus lost orders over last 14 days"
            series={[
              { key: 'recovered', name: 'Recovered', color: CHART_COLORS.emerald },
              { key: 'lost', name: 'Lost', color: CHART_COLORS.ember },
            ]}
          />
        </div>
        <div className="card-blueprint p-6 lg:col-span-2">
          <h2 className="text-sm font-bold text-[#0a0a0a]">Recovery Attempts by Cancellation Reason</h2>
          <HBars data={reasonStats} color={CHART_COLORS.emerald} label="Recovery attempts by cancellation reason" height={Math.max(160, reasonStats.length * 34)} />
        </div>
      </div>

      {/* Campaign List */}
      <div className="card-blueprint p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[#e5e5e5] pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(['all', 'pending', 'recovered', 'lost'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterOutcome(st)}
                className={`px-3.5 py-1.5 min-h-[44px] rounded-2xl text-xs font-medium transition-all cursor-pointer capitalize ${
                  filterOutcome === st
                    ? 'bg-[#0a0a0a] text-white font-semibold'
                    : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search campaigns..."
              className="input-blueprint w-full pl-9 pr-3 py-2 text-xs"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-[#737373] animate-pulse">
            Loading recovery records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 bg-[#fafafa] rounded-2xl border border-[#e5e5e5]">
            <CheckCircle2 className="w-8 h-8 text-[#737373] mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-[#0a0a0a]">No Recovery Records</h3>
            <p className="text-xs text-[#737373] mt-1">No cancelled order recovery campaigns match your criteria.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((r) => (
              <div key={r._id} className="bg-[#ffffff] border border-[#e5e5e5] rounded-2xl p-4 space-y-3 hover:border-[#0a0a0a] transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#0a0a0a]">#{r.orderNumber || r.commerceOrderId}</span>
                      <span className="badge-pill badge-pill-soft text-[10px]">Reason: {r.cancellationReason || 'Cancelled'}</span>
                    </div>
                    <p className="text-xs font-semibold text-[#0a0a0a] mt-1">{r.customerName || 'Customer'}</p>
                    {r.customerPhone && <p className="text-xs text-[#737373]">Phone: {r.customerPhone}</p>}
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-[#0a0a0a]">Rs. {(r.revenueAmount || 0).toLocaleString()}</span>
                    <p className={`text-[10px] capitalize mt-0.5 font-medium ${r.outcome === 'recovered' ? 'text-emerald-700' : r.outcome === 'lost' ? 'text-red-600' : 'text-[#737373]'}`}>
                      Outcome: {r.outcome || 'pending'}
                    </p>
                    {r.outcome === 'recovered' && r.recoveredBy && (
                      <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Recovered by: {r.recoveredBy}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#f5f5f5] gap-2">
                  {r.commerceOrderId || r.orderId ? (
                    <Link to={`/orders/${r.commerceOrderId || r.orderId}`} className="btn-outline text-xs px-3 py-2">
                      <Eye className="w-3.5 h-3.5" /> View Order
                    </Link>
                  ) : (
                    <span />
                  )}

                  {r.outcome !== 'recovered' && r.outcome !== 'lost' && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleUpdate(r._id, 'recovered')} className="btn-primary text-xs px-3 py-2 cursor-pointer">
                        Mark Recovered
                      </button>
                      <button onClick={() => handleUpdate(r._id, 'lost')} className="btn-secondary text-xs px-3 py-2 cursor-pointer text-red-600">
                        Mark Lost
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}