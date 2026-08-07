import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { recoveryApi } from '../services/api';
import Breadcrumbs from '../components/Breadcrumbs';
import {
  RotateCcw, DollarSign, TrendingUp, Gift, XCircle,
  CheckCircle2, Search, Zap, Eye,
} from 'lucide-react';

export default function Recovery() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const recRes: any = await recoveryApi.list();
      setRecords(recRes?.data || []);
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
      toast.success(`Marked as ${outcome}`);
      fetchData();
    } catch {
      toast.error('Failed to update campaign');
    }
  };

  const total = records.length;
  const recovered = records.filter((r) => r.outcome === 'recovered').length;
  const lost = records.filter((r) => r.outcome === 'lost').length;
  const recoveryRate = recovered + lost > 0 ? Math.round((recovered / (recovered + lost)) * 100) : 0;
  const totalRecoveredRevenue = records
    .filter((r) => r.outcome === 'recovered')
    .reduce((sum, r) => sum + (r.revenueAmount || 0), 0);

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

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Cancelled Order Recovery' }]} />

      {/* Header Container */}
      <div className="card-blueprint p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0a0a0a]">Cancelled Revenue Recovery</h1>
            <span className="badge-pill badge-pill-solid text-[10px] uppercase">
              {total} Campaigns
            </span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            Automated recovery queues targeting cancelled orders to recover lost revenue.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-blueprint p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#737373]">Recovered Revenue</p>
          <p className="text-2xl font-bold text-[#0a0a0a] mt-1">Rs. {totalRecoveredRevenue.toLocaleString()}</p>
          <p className="text-[11px] text-[#737373] mt-1">Saved order value</p>
        </div>

        <div className="card-blueprint p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#737373]">Recovery Success Rate</p>
          <p className="text-2xl font-bold text-[#0a0a0a] mt-1">{recoveryRate}%</p>
          <p className="text-[11px] text-[#737373] mt-1">{recovered} of {recovered + lost} resolved</p>
        </div>

        <div className="card-blueprint p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#737373]">Active Recovery Queue</p>
          <p className="text-2xl font-bold text-[#0a0a0a] mt-1">
            {records.filter(r => !r.outcome || r.outcome === 'pending' || r.outcome === 'in-progress').length}
          </p>
          <p className="text-[11px] text-[#737373] mt-1">Pending campaign calls</p>
        </div>
      </div>

      {/* Main Campaign List */}
      <div className="card-blueprint p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[#e5e5e5] pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(['all', 'pending', 'recovered', 'lost'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterOutcome(st)}
                className={`px-3.5 py-1.5 rounded-2xl text-xs font-medium transition-all cursor-pointer capitalize ${
                  filterOutcome === st
                    ? 'bg-[#0a0a0a] text-white shadow-2xs font-semibold'
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
              className="input-blueprint w-full pl-9 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Campaign List Cards */}
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
              <div
                key={r._id}
                className="bg-[#ffffff] border border-[#e5e5e5] rounded-2xl p-4 space-y-3 hover:border-[#0a0a0a] transition-all"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#0a0a0a]">
                        #{r.orderNumber || r.commerceOrderId}
                      </span>
                      <span className="badge-pill badge-pill-soft text-[10px]">
                        Reason: {r.cancellationReason || 'Cancelled'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#0a0a0a] mt-1">{r.customerName || 'Customer'}</p>
                    {r.customerPhone && <p className="text-xs text-[#737373]">Phone: {r.customerPhone}</p>}
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-[#0a0a0a]">
                      Rs. {(r.revenueAmount || 0).toLocaleString()}
                    </span>
                    <p className="text-[10px] text-[#737373] capitalize mt-0.5">
                      Outcome: {r.outcome || 'pending'}
                    </p>
                    {r.outcome === 'recovered' && r.recoveredBy && (
                      <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                        Recovered by: {r.recoveredBy}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#f5f5f5] gap-2">
                  {r.orderId || r.commerceOrderId ? (
                    <Link to={`/orders/${r.orderId || r.commerceOrderId}`} className="btn-outline text-xs px-3 py-1">
                      <Eye className="w-3.5 h-3.5" /> View Order
                    </Link>
                  ) : <span />}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdate(r._id, 'recovered')}
                      className="btn-primary text-xs px-3 py-1 cursor-pointer"
                    >
                      Mark Recovered
                    </button>
                    <button
                      onClick={() => handleUpdate(r._id, 'lost')}
                      className="btn-secondary text-xs px-3 py-1 cursor-pointer text-red-600"
                    >
                      Mark Lost
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
