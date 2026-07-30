import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { recoveryApi } from '../services/api';
import {
  RotateCcw, DollarSign, TrendingUp, Gift, XCircle,
  CheckCircle2, Search, Zap, PieChart as PieIcon,
} from 'lucide-react';



export default function Recovery() {
  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const [recRes, statsRes] = await Promise.all([
        recoveryApi.list(),
        recoveryApi.getStats(),
      ]);
      setRecords((recRes as any).data || []);
      setStats((statsRes as any).data || null);
    } catch (err) {
      console.error('Failed to load recovery data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdate = async (id: string, outcome: string) => {
    try {
      await recoveryApi.update(id, { outcome });
      toast.success(`Marked as ${outcome}`, { duration: 3000 });
      fetchData();
    } catch {
      toast.error('Failed to update');
    }
  };

  const total = records.length;
  const recovered = records.filter((r) => r.outcome === 'recovered').length;
  const lost = records.filter((r) => r.outcome === 'lost').length;
  const pending = records.filter((r) => r.outcome === 'pending' || !r.outcome).length;
  const recoveryRate = recovered + lost > 0 ? Math.round((recovered / (recovered + lost)) * 100) : 0;
  const totalRecoveredRevenue = records
    .filter((r) => r.outcome === 'recovered')
    .reduce((sum, r) => sum + (r.revenueAmount || 0), 0);

  const reasonCounts: Record<string, number> = {};
  records.forEach((r: any) => {
    const reason = r.cancellationReason || 'Other';
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  });

  const filteredRecords = records.filter((r) => {
    if (filterOutcome !== 'all' && r.outcome !== filterOutcome) return false;
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

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading recovery data...</div>;
  }

  return (
    <div className="space-y-6 pb-12 animate-in">
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white rounded-2xl p-6 border border-rose-900/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-rose-400" />
            <h1 className="text-2xl font-black text-white">Cancellation Revenue Recovery</h1>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Turn cancellations into saved sales with automated coupon offers and dedicated recovery queues.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Recovered Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600">
            NPR {totalRecoveredRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">From {recovered} saved orders</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Recovery Rate</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black font-mono text-indigo-600">{recoveryRate}%</div>
          <div className="text-[11px] text-slate-500">Target: 35%+</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Pending Recovery</span>
            <Gift className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-600">{pending} Orders</div>
          <div className="text-[11px] text-slate-500">Active calls waiting</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Unrecoverable</span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-700">{lost} Orders</div>
          <div className="text-[11px] text-slate-500">Closed after call</div>
        </div>
      </div>

      {Object.keys(reasonCounts).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-rose-500" />
              <span>Cancellation Reasons</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(reasonCounts).map(([reason, count]) => {
              const pct = Math.round((count / total) * 100) || 0;
              return (
                <div key={reason} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{reason}</span>
                    <span className="font-mono font-bold text-rose-600">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="font-extrabold text-slate-900 text-base">Recovery Records</h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order or customer..."
                className="w-full bg-slate-100 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none" />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              {['all', 'pending', 'recovered'].map((f) => (
                <button key={f} onClick={() => setFilterOutcome(f)}
                  className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                    filterOutcome === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                  }`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredRecords.map((record) => (
            <div key={record._id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900 font-mono text-sm">
                    #{record.orderNumber || record.orderId}
                  </span>
                  <span className="font-semibold text-slate-700">
                    {record.customerName} {record.customerPhone && `(${record.customerPhone})`}
                  </span>
                  <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px]">
                    {record.cancellationReason}
                  </span>
                </div>
                <div className="text-slate-500">
                  Value: <strong className="font-mono text-slate-800">NPR {record.revenueAmount?.toLocaleString() || 0}</strong>
                  {record.offeredIncentive && <> • Incentive: <span className="text-indigo-600 font-medium">{record.offeredIncentive}</span></>}
                </div>
                {record.notes && <p className="text-slate-600 italic text-[11px] bg-slate-50 p-2 rounded">"{record.notes}"</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {record.outcome === 'recovered' && (
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Recovered
                  </span>
                )}
                {record.outcome === 'lost' && (
                  <span className="bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded-full border border-slate-300 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Lost
                  </span>
                )}
                {(!record.outcome || record.outcome === 'pending') && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleUpdate(record._id, 'recovered')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                      Mark Recovered
                    </button>
                    <button onClick={() => handleUpdate(record._id, 'lost')}
                      className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                      Mark Lost
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredRecords.length === 0 && (
            <div className="py-8 text-center text-slate-500">No records found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
