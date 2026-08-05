import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { commerceApi, taskApi } from '../services/api';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import { entityName } from '../utils/order';
import Breadcrumbs from '../components/Breadcrumbs';
import PriorityBadge from '../components/PriorityBadge';
import SLACountdown from '../components/SLACountdown';
import ReviewModal from '../components/ReviewModal';
import LogisticsTimeline from '../components/LogisticsTimeline';
import {
  ShoppingBag, CheckCircle2, Search, PhoneCall, Store, Zap, Clock,
  PackageCheck, CalendarClock, Truck, ThumbsUp, Eye, XCircle, RotateCcw,
  Package, FileText
} from 'lucide-react';

const STAGE_BUNDLES = [
  {
    key: 'pre_order',
    label: 'PRE PROCESSING',
    description: 'Pending initial confirmation, verification & marked done',
    segments: ['pending_confirmation', 'done'],
  },
  {
    key: 'processing',
    label: 'Processing',
    description: 'Confirmed, packaging, vendor call & shipping',
    segments: ['confirmed_unprocessed', 'shipped'],
  },
  {
    key: 'after_delivery',
    label: 'After Delivery',
    description: 'Post-delivery review calls & feedback',
    segments: ['pending_review'],
  },
  {
    key: 'return',
    label: 'Return & Recovery',
    description: 'Return responses, rescheduled calls & recoveries',
    segments: ['customer_response', 'vendor_response', 'rescheduled'],
  },
] as const;

const SEGMENTS = [
  { key: 'pending_confirmation', label: 'Pending Order Confirmation', icon: PhoneCall, stage: 'pre_order' },
  { key: 'done', label: 'Marked Done', icon: CheckCircle2, stage: 'pre_order' },
  { key: 'confirmed_unprocessed', label: 'Confirmed But Unprocessed', icon: PackageCheck, stage: 'processing' },
  { key: 'shipped', label: 'Shipped Orders', icon: Truck, stage: 'processing' },
  { key: 'pending_review', label: 'Pending Review Calls', icon: ThumbsUp, stage: 'after_delivery' },
  { key: 'customer_response', label: 'Return: Customer Response', icon: PhoneCall, stage: 'return' },
  { key: 'vendor_response', label: 'Return: Vendor Response', icon: Store, stage: 'return' },
  { key: 'rescheduled', label: 'Rescheduled Orders', icon: CalendarClock, stage: 'return' },
] as const;

const PAGE_SIZE = 10;

const getTotalAmount = (order: any): number => {
  if (order.totalAmount && Number(order.totalAmount) > 0) return Number(order.totalAmount);
  if (order.commerce?.totalAmount && Number(order.commerce.totalAmount) > 0) return Number(order.commerce.totalAmount);
  const items = order.items || order.commerce?.items || [];
  const subtotal = items.reduce((s: number, i: any) => {
    const price = Number(i.price || i.product?.price || i.product?.sellingPrice || i.variant?.sellingPrice || 0);
    return s + (Number(i.quantity) || 1) * price;
  }, 0);
  return subtotal;
};

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { simulatedTimeIso, advanceTime } = useSimulatedTime();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [activeStage, setActiveStage] = useState<string>('pre_order');
  const [activeSegment, setActiveSegment] = useState<string>('pending_confirmation');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>({});

  // Modals state
  const [reviewOrder, setReviewOrder] = useState<any>(null);
  const [logisticsOrder, setLogisticsOrder] = useState<any>(null);

  useEffect(() => {
    setSearchQuery(searchParams.get('search') || '');
  }, [searchParams]);

  const handleStageChange = (stageKey: string) => {
    setActiveStage(stageKey);
    const bundle = STAGE_BUNDLES.find(b => b.key === stageKey);
    if (bundle && bundle.segments.length > 0) {
      setActiveSegment(bundle.segments[0]);
      setPage(1);
    }
  };

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
    const onUpdate = () => {
      fetchOrders(page);
      commerceApi.getSegmentCounts().then(res => {
        if (res?.data) setSegmentCounts(res.data);
      }).catch(console.error);
    };
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
      toast.success('Order task skipped');
      fetchOrders(page);
    } catch { toast.error('Failed to skip task'); }
  };

  const handleMarkDone = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    try {
      await commerceApi.updateStatus(order.commerceOrderId, {
        confirmationStatus: 'confirmed',
        vendorStatus: 'accepted',
        note: 'Marked done from Orders page',
      });
      toast.success('Order marked as done');
      fetchOrders(page);
    } catch { toast.error('Failed to mark as done'); }
  };

  const handleSaveReview = async (reviewData: any) => {
    if (!reviewOrder) return;
    try {
      await commerceApi.updateStatus(reviewOrder.commerceOrderId, {
        review: reviewData,
        note: 'Review collected via review modal',
      });
      toast.success('Review saved successfully');
      fetchOrders(page);
    } catch {
      toast.error('Failed to save review');
      throw new Error('Save review failed');
    }
  };

  const activeStageBundle = STAGE_BUNDLES.find(b => b.key === activeStage) || STAGE_BUNDLES[0];
  const subSegments = SEGMENTS.filter(s => (activeStageBundle.segments as readonly string[]).includes(s.key));

  const getStageTotalCount = (stageKey: string) => {
    const bundle = STAGE_BUNDLES.find(b => b.key === stageKey);
    if (!bundle) return 0;
    return bundle.segments.reduce((acc, segKey) => acc + (segmentCounts[segKey] || 0), 0);
  };

  const getStagePath = (order: any) => {
    const id = order.commerceOrderId || order._id;
    const stagePaths: Record<string, string> = {
      confirmed_unprocessed: `${id}/confirmed-unprocessed`,
      shipped: `${id}/shipped`,
      pending_review: `${id}/pending-review`,
      customer_response: `${id}/customer-response`,
      vendor_response: `${id}/vendor-response`,
    };
    return `/orders/${stagePaths[order.workflowStage] || id}`;
  };

  const renderSegmentActions = (order: any, isMobile = false) => {
    const customerPhone = order.customerPhone || order.customer?.phone || '';
    const vendorPhone = order.vendorPhone || order.vendor?.phone || '';

    switch (activeSegment) {
      case 'confirmed_unprocessed':
        return (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {vendorPhone && (
              <a
                href={`tel:${vendorPhone}`}
                className={`btn-primary text-xs ${isMobile ? 'py-2.5 flex-1 min-h-[44px] justify-center' : 'px-3 py-1.5'}`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Call Vendor</span>
              </a>
            )}
            <Link
              to={getStagePath(order)}
              className={`btn-outline text-xs ${isMobile ? 'py-2.5 px-3 min-h-[44px] flex items-center justify-center' : 'px-3 py-1.5'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </Link>
          </div>
        );

      case 'shipped':
        return (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLogisticsOrder(order)}
              className={`btn-outline text-xs ${isMobile ? 'py-2.5 flex-1 min-h-[44px] justify-center' : 'px-3 py-1.5'}`}
            >
              <Truck className="w-3.5 h-3.5 text-purple-600" />
              <span>Logistics Status</span>
            </button>
            <Link
              to={getStagePath(order)}
              className={`btn-primary text-xs ${isMobile ? 'py-2.5 px-3 min-h-[44px] flex items-center justify-center' : 'px-3 py-1.5'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </Link>
          </div>
        );

      case 'pending_review':
        return (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {customerPhone && (
              <a
                href={`tel:${customerPhone}`}
                className={`btn-primary text-xs ${isMobile ? 'py-2.5 flex-1 min-h-[44px] justify-center' : 'px-3 py-1.5'}`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Customer</span>
              </a>
            )}
            <button
              onClick={() => setReviewOrder(order)}
              className={`btn-outline text-xs text-amber-700 border-amber-300 bg-amber-50 ${isMobile ? 'py-2.5 flex-1 min-h-[44px] justify-center' : 'px-3 py-1.5'}`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Get Review</span>
            </button>
            <Link
              to={getStagePath(order)}
              className={`btn-secondary text-xs ${isMobile ? 'py-2.5 px-3 min-h-[44px] flex items-center justify-center' : 'px-3 py-1.5'}`}
            >
              <Eye className="w-3.5 h-3.5" />
            </Link>
          </div>
        );

      case 'customer_response':
        return (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {customerPhone && (
              <a
                href={`tel:${customerPhone}`}
                className={`btn-primary text-xs ${isMobile ? 'py-2.5 flex-1 min-h-[44px] justify-center' : 'px-3 py-1.5'}`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Customer</span>
              </a>
            )}
            <Link
              to={getStagePath(order)}
              className={`btn-outline text-xs ${isMobile ? 'py-2.5 flex-1 min-h-[44px] justify-center' : 'px-3 py-1.5'}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Process Return</span>
            </Link>
          </div>
        );

      case 'vendor_response':
        return (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {vendorPhone && (
              <a
                href={`tel:${vendorPhone}`}
                className={`btn-primary text-xs ${isMobile ? 'py-2.5 flex-1 min-h-[44px] justify-center' : 'px-3 py-1.5'}`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Call Vendor</span>
              </a>
            )}
            <Link
              to={getStagePath(order)}
              className={`btn-outline text-xs ${isMobile ? 'py-2.5 flex-1 min-h-[44px] justify-center' : 'px-3 py-1.5'}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Vendor Approval</span>
            </Link>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => handleMarkDone(e, order)}
              className="btn-outline text-xs px-2.5 py-1"
            >
              Confirm
            </button>
            {order.taskId && (
              <button
                onClick={(e) => handleSkip(e, order)}
                className="btn-secondary text-xs px-2.5 py-1"
              >
                Skip
              </button>
            )}
            <Link
              to={getStagePath(order)}
              className="btn-primary text-xs px-3 py-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </Link>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Orders Management' }]} />

      {/* Header Container */}
      <div className="card-blueprint p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0a0a0a] tracking-tight">Order Lifecycle Engine</h1>
            <span className="badge-pill badge-pill-solid text-[10px] uppercase">
              {total} Total
            </span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            Browse and process NepalCan Commerce orders bundled across 4 lifecycle stages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => advanceTime(1)}
            className="btn-outline text-xs px-3 py-2 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>+1 Hour</span>
          </button>
          <button
            onClick={() => advanceTime(8)}
            className="btn-outline text-xs px-3 py-2 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-[#0a0a0a]" />
            <span>+8 Hours</span>
          </button>
          <button
            onClick={() => navigate('/today')}
            className="btn-primary text-xs px-4 py-2 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Today's Dashboard</span>
          </button>
        </div>
      </div>

      {/* 4 Primary Lifecycle Stage Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAGE_BUNDLES.map((stage) => {
          const isActive = activeStage === stage.key;
          const count = getStageTotalCount(stage.key);
          return (
            <button
              key={stage.key}
              onClick={() => handleStageChange(stage.key)}
              className={`card-blueprint p-4 text-left transition-all cursor-pointer ${
                isActive
                  ? 'border-[#0a0a0a] shadow-xs bg-[#ffffff] ring-1 ring-[#0a0a0a]'
                  : 'hover:border-[#737373] bg-[#fafafa]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-[#0a0a0a]' : 'text-[#737373]'}`}>
                  {stage.label}
                </span>
                <span className={`badge-pill text-[11px] font-bold ${isActive ? 'badge-pill-solid' : 'badge-pill-soft'}`}>
                  {count}
                </span>
              </div>
              <p className="text-[11px] text-[#737373] mt-2 line-clamp-1">{stage.description}</p>
            </button>
          );
        })}
      </div>

      {/* Main Order Workspace */}
      <div className="card-blueprint p-5 sm:p-6 space-y-5">
        {/* Sub-segment Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[#e5e5e5] pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {subSegments.map((seg) => {
              const Icon = seg.icon;
              const isActive = activeSegment === seg.key;
              const count = segmentCounts[seg.key] || 0;
              return (
                <button
                  key={seg.key}
                  onClick={() => { setActiveSegment(seg.key); setPage(1); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0a0a0a] text-white shadow-2xs font-semibold'
                      : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#e5e5e5]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{seg.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-[#ffffff] text-[#0a0a0a]' : 'bg-[#e5e5e5] text-[#0a0a0a]'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
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

        {/* Content View: Desktop Table / Mobile Cards */}
        {loading ? (
          <div className="text-center py-12 text-xs text-[#737373] animate-pulse">
            Loading order records...
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 bg-[#fafafa] rounded-2xl border border-[#e5e5e5]">
            <CheckCircle2 className="w-8 h-8 text-[#737373] mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-[#0a0a0a]">No Orders in Segment</h3>
            <p className="text-xs text-[#737373] mt-1">No order records match the selected filter stage.</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#e5e5e5]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-[#e5e5e5] text-[#737373] font-semibold">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">SLA Window</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e5]">
                  {orders.map((order: any) => {
                    const customerName = entityName(order.customer?.name) || 'Customer';
                    return (
                      <tr
                        key={order.commerceOrderId || order._id}
                        onClick={() => navigate(getStagePath(order))}
                        className="hover:bg-[#fafafa] transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-bold text-[#0a0a0a]">
                          #{order.orderId || order.commerceOrderId}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#0a0a0a]">
                          {customerName}
                        </td>
                        <td className="py-3.5 px-4 text-[#737373]">
                          {order.customerPhone || order.customer?.phone || 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[#0a0a0a]">
                          Rs. {getTotalAmount(order).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <PriorityBadge priority={order.priority || 'medium'} />
                        </td>
                        <td className="py-3.5 px-4">
                          <SLACountdown dueAt={order.dueAt} />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {renderSegmentActions(order)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View (<768px) */}
            <div className="md:hidden space-y-3">
              {orders.map((order: any) => {
                const customerName = entityName(order.customer?.name) || 'Customer';
                const phone = order.customerPhone || order.customer?.phone || 'N/A';
                const cs = order.confirmationStatus || 'pending';
                const vs = order.vendorStatus || 'unassigned';

                return (
                  <div
                    key={order.commerceOrderId || order._id}
                    onClick={() => navigate(getStagePath(order))}
                    className="bg-[#ffffff] border border-[#e5e5e5] active:border-[#dc3545] rounded-2xl p-4 space-y-3.5 shadow-2xs transition-all cursor-pointer"
                  >
                    {/* Top row: ID, Customer Name & Price */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-sm text-[#0a0a0a]">
                            #{order.orderId || order.commerceOrderId}
                          </span>
                          <PriorityBadge priority={order.priority || 'medium'} showLabel={false} />
                          <span className="badge-pill bg-[#fff5f5] text-[#dc3545] border border-[#f8d7da] text-[10px] font-bold">
                            {order.orderStatus || 'Pending'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#0a0a0a] mt-1">{customerName}</p>
                        <p className="text-xs text-[#737373] mt-0.5">Phone: {phone}</p>
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

                    {/* Middle row: Customer & Vendor Status badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] pt-1">
                      <span className={`px-2 py-0.5 rounded-full font-semibold border ${
                        cs === 'confirmed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        Cust: {cs}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold border ${
                        vs === 'accepted' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        Vendor: {vs}
                      </span>
                    </div>

                    {/* Bottom row: Touch Action Bar (min 44px targets) */}
                    <div className="pt-2 border-t border-[#f5f5f5]">
                      {renderSegmentActions(order, true)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination Bar */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4 border-t border-[#e5e5e5]">
            <p className="text-xs text-[#737373]">
              Page {page} of {Math.ceil(total / PAGE_SIZE)} ({total} orders)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-outline text-xs px-3 py-1.5 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * PAGE_SIZE >= total}
                className="btn-outline text-xs px-3 py-1.5 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewOrder && (
        <ReviewModal
          isOpen={!!reviewOrder}
          onClose={() => setReviewOrder(null)}
          onSubmit={handleSaveReview}
          orderId={reviewOrder.orderId || reviewOrder.commerceOrderId}
        />
      )}

      {/* Logistics Status Modal */}
      {logisticsOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in-fast">
          <div className="bg-[#ffffff] card-blueprint p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#0a0a0a]">
                Logistics Tracking #{logisticsOrder.orderId || logisticsOrder.commerceOrderId}
              </h3>
              <button onClick={() => setLogisticsOrder(null)} className="p-1 rounded-xl hover:bg-[#f5f5f5]">
                <XCircle className="w-4 h-4 text-[#737373]" />
              </button>
            </div>
            <LogisticsTimeline
              events={logisticsOrder.externalStatusHistory}
              externalLogisticsOrderId={logisticsOrder.externalLogisticsOrderId || logisticsOrder.commerce?.externalNonHeavyLogisticsId}
            />
            <div className="pt-2 flex justify-end">
              <button onClick={() => setLogisticsOrder(null)} className="btn-primary text-xs px-4 py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}