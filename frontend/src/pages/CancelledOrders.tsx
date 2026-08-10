import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { commerceApi } from '../services/api';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import { entityName, formatDuration } from '../utils/order';
import Breadcrumbs from '../components/Breadcrumbs';
import PriorityBadge from '../components/PriorityBadge';
import SLACountdown from '../components/SLACountdown';
import { XCircle, PhoneCall, Eye, Search } from 'lucide-react';

const SEGMENTS = [
  { key: 'system_cancelled', label: 'System Cancelled' },
  { key: 'unrecoverable', label: 'Unrecoverable' },
];

const getTotalAmount = (order: any): number => {
  if (order.totalAmount && Number(order.totalAmount) > 0) return Number(order.totalAmount);
  if (order.commerce?.totalAmount && Number(order.commerce.totalAmount) > 0) return Number(order.commerce.totalAmount);
  const items = order.items || order.commerce?.items || [];
  return items.reduce((s: number, i: any) => {
    const price = Number(i.price || i.product?.price || i.product?.sellingPrice || i.variant?.sellingPrice || 0);
    return s + (Number(i.quantity) || 1) * price;
  }, 0);
};

export default function CancelledOrders() {
  const { simulatedTimeIso } = useSimulatedTime();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'system_cancelled' | 'unrecoverable'>('all');

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [sys, unrec]: any[] = await Promise.all([
        commerceApi.getOrders({ segment: 'system_cancelled', limit: 200 }),
        commerceApi.getOrders({ segment: 'unrecoverable', limit: 200 }),
      ]);
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const order of [...(sys.data?.orders || []), ...(unrec.data?.orders || [])]) {
        const id = order.commerceOrderId || order._id;
        if (seen.has(id)) continue;
        seen.add(id);
        merged.push(order);
      }
      merged.sort((a, b) => {
        const t = (o: any) => new Date(o.createdAt || o.externalCreatedAt || 0).getTime();
        return t(b) - t(a);
      });
      setOrders(merged);
    } catch {
      toast.error('Failed to load cancelled orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'all') {
        if (filter === 'system_cancelled' && !(o.unrecoverable !== true)) return false;
        if (filter === 'unrecoverable' && o.unrecoverable !== true) return false;
      }
      if (!q) return true;
      return `${o.orderId} ${o.commerceOrderId} ${o.customer?.name || ''} ${o.customerName || ''}`
        .toLowerCase().includes(q);
    });
  }, [orders, filter, searchQuery]);

  const orderAge = (order: any) => {
    const placedAt = order.createdAt || order.externalCreatedAt || order.sla?.slaCreatedAt;
    if (!placedAt) return '—';
    const now = simulatedTimeIso ? new Date(simulatedTimeIso) : new Date();
    return formatDuration(now.getTime() - new Date(placedAt).getTime()) || '—';
  };

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Orders Management' }, { label: 'Cancelled Orders' }]} />

      <div className="card-blueprint p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0a0a0a] tracking-tight">Cancelled Orders</h1>
            <span className="badge-pill badge-pill-solid text-[10px] uppercase">
              {filtered.length} Total
            </span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            System cancelled &amp; unrecoverable orders for recovery campaigns.
          </p>
        </div>
      </div>

      <div className="card-blueprint p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[#e5e5e5] pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', ...SEGMENTS.map(s => s.key)] as const).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-medium transition-all cursor-pointer min-h-[44px] ${
                  filter === key
                    ? 'bg-[#0a0a0a] text-white shadow-2xs font-semibold'
                    : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#e5e5e5]'
                }`}
              >
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{key === 'all' ? 'All Cancelled' : SEGMENTS.find(s => s.key === key)!.label}</span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, customer..."
              className="input-blueprint w-full pl-9 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-[#737373] animate-pulse">
            Loading cancelled orders...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-[#fafafa] rounded-2xl border border-[#e5e5e5]">
            <XCircle className="w-8 h-8 text-[#737373] mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-[#0a0a0a]">No Cancelled Orders</h3>
            <p className="text-xs text-[#737373] mt-1">No system cancelled or unrecoverable orders match.</p>
          </div>
        ) : (
          <div>
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#e5e5e5]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-[#e5e5e5] text-[#737373] font-semibold">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Cancel Source</th>
                    <th className="py-3 px-4">SLA Window</th>
                    <th className="py-3 px-4">Order Age</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e5]">
                  {filtered.map((order: any) => {
                    const customerName = entityName(order.customer?.name) || 'Customer';
                    const vendorName = entityName(order.vendor?.name) || order.vendorName || '—';
                    const isUnrecoverable = order.unrecoverable === true;
                    return (
                      <tr key={order.commerceOrderId || order._id} className="hover:bg-[#fafafa] transition-colors cursor-pointer">
                        <td className="py-3.5 px-4 font-bold text-[#0a0a0a] whitespace-nowrap">
                          #{order.orderId || order.commerceOrderId}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#0a0a0a] truncate max-w-[160px]" title={customerName}>
                          {customerName}
                        </td>
                        <td className="py-3.5 px-4 text-[#737373] truncate max-w-[160px]" title={vendorName}>
                          {vendorName}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#0a0a0a] whitespace-nowrap">
                          Rs. {getTotalAmount(order).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <PriorityBadge priority={order.priority || 'medium'} />
                        </td>
                        <td className="py-3.5 px-4">
                          {isUnrecoverable ? (
                            <span className="badge-pill bg-[#737373] text-white border border-[#737373] text-[10px] font-bold">
                              Unrecoverable
                            </span>
                          ) : (
                            <span className="badge-pill bg-[#fff5f5] text-[#dc3545] border border-[#f8d7da] text-[10px] font-bold">
                              System Cancelled
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <SLACountdown dueAt={order.dueAt} />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-[#737373]" title={order.createdAt || order.externalCreatedAt ? new Date(order.createdAt || order.externalCreatedAt).toLocaleString() : undefined}>
                          {orderAge(order)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {order.customerPhone && (
                              <a href={`tel:${order.customerPhone}`} className="btn-primary text-xs px-3 py-1.5">
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>Call</span>
                              </a>
                            )}
                            <Link
                              to={`/orders/${order.commerceOrderId || order._id}/cancelled`}
                              className="btn-outline text-xs px-3 py-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {filtered.map((order: any) => {
                const customerName = entityName(order.customer?.name) || 'Customer';
                const vendorName = entityName(order.vendor?.name) || order.vendorName || '—';
                const isUnrecoverable = order.unrecoverable === true;
                return (
                  <div key={order.commerceOrderId || order._id} className="bg-[#ffffff] border border-[#e5e5e5] rounded-2xl p-4 space-y-3.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-sm text-[#0a0a0a]">
                            #{order.orderId || order.commerceOrderId}
                          </span>
                          <PriorityBadge priority={order.priority || 'medium'} showLabel={false} />
                          {isUnrecoverable ? (
                            <span className="badge-pill bg-[#737373] text-white border border-[#737373] text-[10px] font-bold">
                              Unrecoverable
                            </span>
                          ) : (
                            <span className="badge-pill bg-[#fff5f5] text-[#dc3545] border border-[#f8d7da] text-[10px] font-bold">
                              System Cancelled
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-[#0a0a0a] mt-1">{customerName}</p>
                        <p className="text-xs text-[#737373] mt-0.5">Vendor: {vendorName}</p>
                        <p className="text-[10px] text-[#737373] mt-0.5">Ordered {orderAge(order)} ago</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-extrabold text-[#dc3545] font-mono">
                          Rs. {getTotalAmount(order).toLocaleString()}
                        </span>
                        <div className="mt-1">
                          <SLACountdown dueAt={order.dueAt} />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#f5f5f5] flex gap-2">
                      {order.customerPhone && (
                        <a href={`tel:${order.customerPhone}`} className="btn-primary text-xs py-2.5 flex-1 min-h-[44px] justify-center">
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Call Customer</span>
                        </a>
                      )}
                      <Link
                        to={`/orders/${order.commerceOrderId || order._id}/cancelled`}
                        className="btn-outline text-xs py-2.5 px-3 min-h-[44px] flex items-center justify-center"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}