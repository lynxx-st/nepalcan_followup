import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { commerceApi, taskApi } from '../services/api';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import { entityName } from '../utils/order';
import {
  ShoppingBag, PlusCircle, Clock, Database, CheckCircle2,
  AlertTriangle, Search, PhoneCall, Store, Zap, XCircle,
  ThumbsUp, PackageCheck, CalendarClock, Truck,
} from 'lucide-react';


const SEGMENTS = [
  { key: 'pending_confirmation', label: 'Pending Order Confirmation', icon: PhoneCall },
  { key: 'pending_review', label: 'Pending Review Calls', icon: ThumbsUp },
  { key: 'confirmed_unprocessed', label: 'Confirmed But Not Processed', icon: PackageCheck },
  { key: 'rescheduled', label: 'Rescheduled Orders', icon: CalendarClock },
  { key: 'delivered_followup', label: 'Follow-up of Delivered Calls', icon: Store },
  { key: 'shipped', label: 'Shipped Orders', icon: Truck },
  { key: 'done', label: 'Marked Done', icon: CheckCircle2 },
] as const;

const PAGE_SIZE = 10;

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { simulatedTimeIso, advanceTime } = useSimulatedTime();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [activeSegment, setActiveSegment] = useState<string>('pending_confirmation');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    setSearchQuery(searchParams.get('search') || '');
  }, [searchParams]);

  const fetchOrders = async (p: number) => {
    try {
      setLoading(true);
      const data: any = await commerceApi.getOrders({ 
        limit: PAGE_SIZE, 
        page: p,
        segment: activeSegment,
        search: searchQuery || undefined
      });
      setOrders(data.data?.orders || []);
      setTotal(data.data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(page);
  }, [page, activeSegment, searchQuery]);

  useEffect(() => {
    const onUpdate = () => { fetchOrders(page); commerceApi.getSegmentCounts().then(res => { if (res?.data) setSegmentCounts(res.data); }).catch(console.error); };
    window.addEventListener('orders-updated', onUpdate);
    return () => window.removeEventListener('orders-updated', onUpdate);
  }, [page, activeSegment, searchQuery]);

  useEffect(() => {
    commerceApi.getSegmentCounts().then(res => {
      if (res?.data) setSegmentCounts(res.data);
    }).catch(console.error);
  }, [activeSegment]);

  const handleSkip = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    if (!order.taskId) { toast.error('No active task to skip'); return; }
    try {
      await taskApi.skip(order.taskId, { notes: 'Skipped from Orders page' });
      toast.success('Order skipped');
      fetchOrders(page);
    } catch { toast.error('Failed to skip task'); }
  };

  const handleMarkDone = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    try {
      await commerceApi.updateStatus(order.commerceOrderId, { confirmationStatus: 'confirmed' });
      toast.success('Order marked as confirmed');
      fetchOrders(page);
    } catch { toast.error('Failed to mark as done'); }
  };

  const getSegmentCounts = () => SEGMENTS.map((seg) => ({
    ...seg,
    count: segmentCounts[seg.key] || 0,
  }));

  return (
    <div className="space-y-6 pb-12 animate-in">
      <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white rounded-2xl p-6 border border-red-500 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-white" />
            <h1 className="text-2xl font-black text-white">Orders</h1>
          </div>
          <p className="text-xs text-red-100 font-medium">
            Segmented view of all orders by confirmation and processing stage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => advanceTime(1)}
            className="flex items-center gap-1.5 bg-white text-red-700 hover:bg-red-50 font-extrabold text-xs px-3.5 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer">
            <Clock className="w-4 h-4 text-red-600" /> +1 Hour
          </button>
          <button onClick={() => advanceTime(8)}
            className="flex items-center gap-1.5 bg-red-950 text-white hover:bg-red-900 font-black text-xs px-3.5 py-2.5 rounded-xl border border-red-400/40 cursor-pointer">
            <Zap className="w-4 h-4 text-amber-300" /> +8 Hours
          </button>
          <button onClick={() => navigate('/today')}
            className="flex items-center gap-2 bg-white text-red-600 hover:bg-red-50 font-black text-xs px-4 py-2.5 rounded-xl shadow-md cursor-pointer">
            <ShoppingBag className="w-4 h-4" /> Dashboard
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {getSegmentCounts().map((seg) => {
          const Icon = seg.icon;
          const isActive = activeSegment === seg.key;
          return (
            <button key={seg.key} onClick={() => setActiveSegment(seg.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                isActive
                  ? 'bg-red-600 text-white shadow-md ring-2 ring-red-300'
                  : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-red-300 hover:text-red-600'
              }`}>
              <Icon className="w-4 h-4" />
              <span>{seg.label}</span>
              <span className={`ml-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                isActive ? 'bg-white text-red-700' : 'bg-slate-100 text-slate-600'
              }`}>{seg.count}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="text-sm font-bold text-slate-800">
            {getSegmentCounts().find((s) => s.key === activeSegment)?.label || ''}
            <span className="ml-2 text-slate-400 font-mono text-xs">
              Page {page} of {Math.ceil(total / PAGE_SIZE) || 1} ({total} total)
            </span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, customer, phone..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-bold">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-bold text-slate-800">No orders in this segment</p>
            </div>
          ) : (
            orders.map((order) => {
              const os = order.commerce?.orderStatus || order.orderStatus || '';
              const customer = entityName(order.customer);
              const customerPhone = order.customer?.phone || order.customerPhone;
              return (
              <div key={order._id || order.commerceOrderId}
                onClick={() => navigate(`/orders/${order.commerceOrderId}`)}
                className="rounded-2xl border-2 border-slate-200 bg-white p-4 transition-all hover:border-red-300 hover:shadow-md space-y-3 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-red-600 font-mono bg-red-50 px-3 py-1 rounded-xl border border-red-200">
                        #{order.orderNumber || order.commerceOrderId}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        os === 'Cancelled' ? 'bg-red-100 text-red-700' :
                        os === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                        os === 'Processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{os}</span>
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900 text-sm">{customer || '-'}</p>
                      {customerPhone && (
                        <p className="text-xs text-slate-500 font-mono">{customerPhone}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black font-mono text-slate-900">Rs {order.totalAmount || order.commerce?.totalAmount || 0}</div>
                    <div className="flex gap-1 mt-1 justify-end">
                      {(order.customer?.confirmationStatus || order.confirmationStatus) === 'confirmed' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Confirmed</span>
                      )}
                      {os === 'Delivered' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800">Delivered</span>
                      )}
                    </div>
                    {activeSegment === 'pending_confirmation' && (
                      <button onClick={(e) => handleMarkDone(e, order)}
                        className="mt-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer">
                        Mark Done
                      </button>
                    )}
                    {order.taskId && (
                      <button onClick={(e) => handleSkip(e, order)}
                        className="mt-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 cursor-pointer">
                        Skip
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })
          )}
          {!loading && total > PAGE_SIZE && (() => {
            const totalPages = Math.ceil(total / PAGE_SIZE);
            const pages: (number | string)[] = [];
            const start = Math.max(1, page - 2);
            const end = Math.min(totalPages, page + 2);
            if (start > 1) { pages.push(1); if (start > 2) pages.push('...'); }
            for (let i = start; i <= end; i++) pages.push(i);
            if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }
            return (
              <div className="flex items-center justify-center gap-1.5 pt-4 border-t border-slate-200">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
                  ←
                </button>
                {pages.map((p, i) =>
                  typeof p === 'string' ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-xs text-slate-400">...</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p)}
                      className={`min-w-[32px] px-2 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        p === page
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'border border-slate-300 text-slate-600 hover:border-red-300 hover:text-red-600'
                      }`}>
                      {p}
                    </button>
                  )
                )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
                  →
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
