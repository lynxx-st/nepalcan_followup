import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { dashboardApi, commerceApi, taskApi } from '../services/api';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import SLACountdown from '../components/SLACountdown';
import { getSLAInfo } from '../utils/ruleEngine';
import { entityName } from '../utils/order';
import {
  PhoneCall, Store, Clock, RefreshCw, Star, AlertTriangle,
  Zap, ArrowRight, CheckCircle2, TrendingUp, Filter, X, Truck,
} from 'lucide-react';



const CALL_TYPES = [
  { key: 'customer-confirmation', label: 'Customer Conf.', icon: PhoneCall, color: 'text-blue-600', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  { key: 'vendor-call', label: 'Vendor Action', icon: Store, color: 'text-purple-600', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' },
  { key: 'vendor-delay', label: 'Vendor Delay', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
  { key: 'cancelled-recovery', label: 'Cancelled Recovery', icon: RefreshCw, color: 'text-rose-600', bgColor: 'bg-rose-500/10', borderColor: 'border-rose-500/30' },
  { key: 'review-call', label: 'Review Calls', icon: Star, color: 'text-yellow-600', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' },
  { key: 'escalation', label: 'Escalations', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' },
  { key: 'logistics-followup', label: 'Logistics Follow-up', icon: Truck, color: 'text-teal-600', bgColor: 'bg-teal-500/10', borderColor: 'border-teal-500/30' },
  { key: 'overdue', label: 'Overdue SLA', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/40' },
];

export default function TodayWork() {
  const navigate = useNavigate();
  const { simulatedTimeIso } = useSimulatedTime();
  const [tasks, setTasks] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ count: number } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashRes, todayRes] = await Promise.all([
        dashboardApi.getOrders().catch(() => null),
        dashboardApi.getToday().catch(() => null),
      ]);
      setOrders(dashRes?.data?.orders || []);
      setSummary(todayRes?.data || null);
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSync = async () => {
    try {
      toast('Syncing orders...', { duration: 2000 });
      const result: any = await commerceApi.syncOrders({ status: 'Active' });
      const count = result.data?.totalFetched || 0;
      setSyncResult({ count });
      setTimeout(() => setSyncResult(null), 5000);
      toast.success(`Synced ${count} orders`, { duration: 4000 });
      fetchData();
    } catch {
      toast.error('Failed to sync orders');
    }
  };

  const counts: Record<string, number> = {};
  orders.forEach((o: any) => {
    const type = o.taskType || 'unknown';
    counts[type] = (counts[type] || 0) + 1;
  });

  const filteredOrders = selectedQueue
    ? orders.filter((o: any) => (o.taskType || 'unknown') === selectedQueue)
    : orders;

  const overdueCount = orders.filter((o: any) => {
    if (!o.dueAt) return false;
    return getSLAInfo(o.dueAt, simulatedTimeIso).isOverdue;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in">
      {syncResult && (
        <div className="flex items-center justify-between bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg animate-in-fast">
          <div className="flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="w-5 h-5" />
            Synced <strong>{syncResult.count}</strong> order{syncResult.count !== 1 ? 's' : ''} · just now
          </div>
          <button onClick={() => setSyncResult(null)} className="p-1 hover:bg-emerald-500 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-800 border border-red-500 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/20 text-white border border-white/30 text-xs font-bold px-3 py-1 rounded-full">
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
              <span>Smart Queue Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Today's Work Engine</h1>
            <p className="text-sm text-red-100 font-medium">
              System automatically prioritizes critical customer calls, vendor dispatch delays, and recovery opportunities.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <button
              onClick={() => navigate('/next')}
              className="group flex items-center justify-center gap-3 bg-white hover:bg-red-50 text-red-600 font-black text-base px-6 py-4 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <Zap className="w-5 h-5 fill-red-600 text-red-600 animate-bounce" />
              <span>START NEXT CALL</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={handleSync}
              className="flex items-center gap-2 bg-red-950 text-white hover:bg-red-900 font-bold text-xs px-4 py-3 rounded-xl border border-red-400/40 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Sync Orders
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {CALL_TYPES.map((ct) => {
          const count = ct.key === 'overdue' ? overdueCount : (counts[ct.key] || 0);
          if (ct.key === 'overdue') {
            return (
              <div key={ct.key}
                className="col-span-2 sm:col-span-1 rounded-xl bg-gradient-to-b from-red-500/10 to-red-500/5 border border-red-500/40 p-4 text-center flex flex-col items-center justify-center gap-1 shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <span className="text-2xl font-black text-red-600">{count}</span>
                <span className="text-xs font-semibold text-red-700">Overdue SLA</span>
              </div>
            );
          }
          const Icon = ct.icon;
          return (
            <button
              key={ct.key}
              onClick={() => setSelectedQueue(selectedQueue === ct.key ? null : ct.key)}
              className={`rounded-xl border p-4 text-left transition-all cursor-pointer ${
                selectedQueue === ct.key
                  ? 'ring-2 ring-indigo-500 bg-indigo-50/50 border-indigo-500 shadow-md'
                  : `bg-white ${ct.borderColor} shadow-sm hover:shadow-md`
              } ${count === 0 ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${ct.bgColor}`}>
                  <Icon className={`w-5 h-5 ${ct.color}`} />
                </div>
                <span className="text-2xl font-black text-slate-900 font-mono">{count}</span>
              </div>
              <div className="font-bold text-xs text-slate-800 truncate">{ct.label}</div>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900">Today's Orders</h3>
              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium">
                {orders.length} total
              </span>
            </div>
            <p className="text-xs text-slate-500">Click an order to see details</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h4 className="font-bold text-slate-800">All caught up!</h4>
              <p className="text-sm text-slate-500">No orders with pending tasks.</p>
            </div>
          ) : (
            filteredOrders.map((order: any) => {
              const isOverdue = order.dueAt && getSLAInfo(order.dueAt, simulatedTimeIso).isOverdue;
              const orderStatus = order.commerce?.orderStatus || order.orderStatus || '';
              return (
                <div
                  key={order._id || order.commerceOrderId}
                  onClick={() => navigate(`/orders/${order.commerceOrderId}`)}
                  className="p-4 sm:p-5 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold text-red-600">#{order.orderId || order.orderNumber}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          orderStatus === 'Cancelled' ? 'bg-red-100 text-red-700' :
                          orderStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                          orderStatus === 'Pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{orderStatus}</span>
                        {order.priority && (
                          <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded ${
                            order.priority === 'critical' ? 'bg-red-500' :
                            order.priority === 'high' ? 'bg-orange-500' :
                            order.priority === 'medium' ? 'bg-yellow-500' : 'bg-slate-500'
                          }`}>{order.priority}</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-700">
                        <span className="font-medium">{entityName(order.customer, order.customerName) || '-'}</span>
                        {(order.customer?.phone || order.customerPhone) && (
                          <a href={`tel:${order.customer?.phone || order.customerPhone}`} onClick={(e) => e.stopPropagation()}
                            className="text-red-600 ml-2 text-xs">📞 {order.customer?.phone || order.customerPhone}</a>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                        <span>Rs {order.totalAmount || order.commerce?.totalAmount || 0}</span>
                        {entityName(order.vendor, order.vendorName) && <span>Vendor: {entityName(order.vendor, order.vendorName)}</span>}
                        {order.shippingType && <span>{order.shippingType}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOverdue && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded animate-pulse">Overdue</span>}
                      {order.dueAt && <SLACountdown dueAt={order.dueAt} />}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (order.taskId) {
                            await taskApi.skip(order.taskId, { notes: 'Skipped from dashboard' });
                            fetchData();
                          }
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold text-xs px-2.5 py-1.5 rounded-lg cursor-pointer"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
