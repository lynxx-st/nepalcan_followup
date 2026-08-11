import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { commerceApi, taskApi } from '../services/api';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import { entityName, formatDuration } from '../utils/order';
import Breadcrumbs from '../components/Breadcrumbs';
import PriorityBadge from '../components/PriorityBadge';
import SLACountdown from '../components/SLACountdown';
import ReviewModal from '../components/ReviewModal';
import LogisticsTimeline from '../components/LogisticsTimeline';
import {
  ShoppingBag, CheckCircle2, Search, PhoneCall, Store, Clock,
  PackageCheck, CalendarClock, Truck, ThumbsUp, Eye, XCircle, RotateCcw,
  ArrowUp, ArrowDown, ChevronsUpDown, PhoneOff
} from 'lucide-react';

const STAGE_BUNDLES = [
  {
    key: 'pre_order',
    label: 'Pre Processing',
    description: 'Pending initial confirmation, verification & marked done',
    segments: ['pending_confirmation', 'done', 'rescheduled'],
  },
  {
    key: 'processing',
    label: 'Processing',
    description: 'Confirmed, packaging, vendor call, logistics collection & shipping',
    segments: ['confirmed_unprocessed', 'collected_by_logistics', 'shipped'],
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
    description: 'Return responses, rescheduled calls, cancelled & hold orders',
    segments: ['customer_response', 'vendor_response', 'cancelled', 'hold'],
  },
] as const;

const SEGMENTS = [
  { key: 'pending_confirmation', label: 'Pending Order Confirmation', shortLabel: 'Pending Confirm', icon: PhoneCall, stage: 'pre_order' },
  { key: 'done', label: 'Marked Done', shortLabel: 'Done', icon: CheckCircle2, stage: 'pre_order' },
  { key: 'confirmed_unprocessed', label: 'Confirmed But Unprocessed', shortLabel: 'Unprocessed', icon: PackageCheck, stage: 'processing' },
  { key: 'collected_by_logistics', label: 'Collected by Logistics', shortLabel: 'Logistics', icon: Truck, stage: 'processing' },
  { key: 'shipped', label: 'Shipped Orders', shortLabel: 'Shipped', icon: Truck, stage: 'processing' },
  { key: 'pending_review', label: 'Pending Review Calls', shortLabel: 'Review', icon: ThumbsUp, stage: 'after_delivery' },
  { key: 'customer_response', label: 'Return: Customer Response', shortLabel: 'Cust Return', icon: PhoneCall, stage: 'return' },
  { key: 'vendor_response', label: 'Return: Vendor Response', shortLabel: 'Vendor Return', icon: Store, stage: 'return' },
  { key: 'rescheduled', label: 'Rescheduled Orders', shortLabel: 'Rescheduled', icon: CalendarClock, stage: 'pre_order' },
  { key: 'cancelled', label: 'Cancelled Orders', shortLabel: 'Cancelled', icon: XCircle, stage: 'return' },
  { key: 'hold', label: 'Hold Orders', shortLabel: 'Hold', icon: Clock, stage: 'return' },
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
  const { simulatedTimeIso } = useSimulatedTime();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [activeStage, setActiveStage] = useState<string>('pre_order');
  const [activeSegment, setActiveSegment] = useState<string>('pending_confirmation');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>({});
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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
        search: searchQuery || undefined,
        sortBy: sortKey || undefined,
        sortOrder: sortDir
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
  }, [page, activeSegment, searchQuery, sortKey, sortDir]);

  useEffect(() => {
    const onUpdate = () => {
      fetchOrders(page);
      commerceApi.getSegmentCounts().then(res => {
        if (res?.data) setSegmentCounts(res.data);
      }).catch(console.error);
    };
    window.addEventListener('orders-updated', onUpdate);
    return () => window.removeEventListener('orders-updated', onUpdate);
  }, [page, activeSegment, searchQuery, sortKey, sortDir]);

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
      collected_by_logistics: `${id}/collected-by-logistics`,
      shipped: `${id}/shipped`,
      pending_review: `${id}/pending-review`,
      customer_response: `${id}/customer-response`,
      vendor_response: `${id}/vendor-response`,
      cancelled: `${id}/cancelled`,
      hold: `${id}/hold`,
    };
    return `/orders/${stagePaths[order.workflowStage] || id}`;
  };

  const handleSort = (key: string) => {
    setPage(1);
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const orderAge = (order: any) => {
    const placedAt = order.createdAt || order.externalCreatedAt || order.sla?.slaCreatedAt;
    if (!placedAt) return '—';
    const now = simulatedTimeIso ? new Date(simulatedTimeIso) : new Date();
    return formatDuration(now.getTime() - new Date(placedAt).getTime()) || '—';
  };

  const renderSortHeader = (key: string, label: string, align: 'left' | 'right' = 'left') => {
    const active = sortKey === key;
    const DirIcon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
    return (
      <th className={`py-3 px-4 ${align === 'right' ? 'text-right' : 'text-left'}`}>
        <button
          onClick={() => handleSort(key)}
          className={`inline-flex items-center gap-1 cursor-pointer hover:text-[#0a0a0a] transition-colors ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-[#0a0a0a]' : ''}`}
          title={`Sort by ${label}`}
        >
          {label}
          <DirIcon className={`w-3.5 h-3.5 ${active ? 'text-[#0a0a0a]' : 'text-[#737373]'}`} />
        </button>
      </th>
    );
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

      case 'collected_by_logistics':
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

      case 'cancelled':
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
              className={`btn-outline text-xs ${isMobile ? 'py-2.5 px-3 min-h-[44px] flex items-center justify-center' : 'px-3 py-1.5'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </Link>
          </div>
        );

      case 'hold':
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
              className={`btn-outline text-xs ${isMobile ? 'py-2.5 px-3 min-h-[44px] flex items-center justify-center' : 'px-3 py-1.5'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </Link>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
      <div className="card-blueprint p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-bold text-[#0a0a0a] tracking-tight">Order Lifecycle Engine</h1>
            <span className="badge-pill badge-pill-solid text-[10px] uppercase">
              {total} Total
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-[#737373] mt-0.5 sm:mt-1">
            Browse and process NepalCan Commerce orders bundled across 4 lifecycle stages.
          </p>
        </div>

        <button
          onClick={() => navigate('/today')}
          className="btn-primary text-xs px-4 py-2 cursor-pointer"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Today's Dashboard</span>
        </button>
      </div>

      {/* 4 Primary Lifecycle Stage Tabs */}
      {/* Mobile: horizontal scroll strip */}
      <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {STAGE_BUNDLES.map((stage) => {
          const isActive = activeStage === stage.key;
          const count = getStageTotalCount(stage.key);
          return (
            <button
              key={stage.key}
              onClick={() => handleStageChange(stage.key)}
              className={`shrink-0 snap-start flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer border ${
                isActive
                  ? 'border-[#0a0a0a] bg-[#ffffff] text-[#0a0a0a] shadow-xs'
                  : 'border-[#e5e5e5] bg-[#fafafa] text-[#737373]'
              }`}
            >
              <span className="whitespace-nowrap">{stage.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isActive ? 'bg-[#dc3545] text-white' : 'bg-[#e5e5e5] text-[#0a0a0a]'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {/* Desktop: 4-col grid with descriptions */}
      <div className="hidden lg:grid grid-cols-4 gap-3">
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
              <p className="text-[11px] text-[#737373] mt-2 line-clamp-2">{stage.description}</p>
            </button>
          );
        })}
      </div>

      {/* Main Order Workspace */}
      <div className="card-blueprint p-5 sm:p-6 space-y-5">
        {/* Sub-segment Filter Tabs & Search Bar */}
        <div className="space-y-3 border-b border-[#e5e5e5] pb-4">
          {/* Mobile: horizontal scroll with short labels */}
          <div className="flex sm:hidden gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            {subSegments.map((seg) => {
              const Icon = seg.icon;
              const isActive = activeSegment === seg.key;
              const count = segmentCounts[seg.key] || 0;
              return (
                <button
                  key={seg.key}
                  onClick={() => { setActiveSegment(seg.key); setPage(1); }}
                  className={`shrink-0 snap-start flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl text-[11px] font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0a0a0a] text-white shadow-2xs font-semibold'
                      : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#e5e5e5]'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span className="whitespace-nowrap">{seg.shortLabel}</span>
                  <span className={`px-1 py-0.2 rounded-full text-[9px] font-bold ${
                    isActive ? 'bg-[#ffffff] text-[#0a0a0a]' : 'bg-[#e5e5e5] text-[#0a0a0a]'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Desktop: wrap with full labels */}
          <div className="hidden sm:flex flex-wrap items-center gap-1.5">
            {subSegments.map((seg) => {
              const Icon = seg.icon;
              const isActive = activeSegment === seg.key;
              const count = segmentCounts[seg.key] || 0;
              return (
                <button
                  key={seg.key}
                  onClick={() => { setActiveSegment(seg.key); setPage(1); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-medium transition-all cursor-pointer min-h-[44px] ${
                    isActive
                      ? 'bg-[#0a0a0a] text-white shadow-2xs font-semibold'
                      : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#e5e5e5]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
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
          {/* Search bar */}
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
                    {renderSortHeader('orderId', 'Order ID')}
                    {renderSortHeader('customer', 'Customer')}
                    {renderSortHeader('vendor', 'Vendor')}
                    {renderSortHeader('totalAmount', 'Total Amount', 'right')}
                    {renderSortHeader('priority', 'Priority')}
                    <th className="py-3 px-4">SLA Window</th>
                    <th className="py-3 px-4">Order Age</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e5]">
                  {orders.map((order: any) => {
                    const customerName = entityName(order.customer?.name) || 'Customer';
                    const vendorName = entityName(order.vendor?.name) || order.vendorName || '—';
                    return (
                      <tr
                        key={order.commerceOrderId || order._id}
                        onClick={() => navigate(getStagePath(order))}
                        className="hover:bg-[#fafafa] transition-colors cursor-pointer"
                      >
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
                          <div className="flex items-center gap-1.5">
                            <PriorityBadge priority={order.priority || 'medium'} />
                            {activeSegment === 'pending_review' && order.reviewMissedAt && (
                              <span className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-semibold uppercase" title={`Didn't pick up · ${new Date(order.reviewMissedAt).toLocaleString()}`}>
                                <PhoneOff className="w-2.5 h-2.5" />
                                No pick-up
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <SLACountdown dueAt={order.dueAt} />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-[#737373]" title={order.createdAt || order.externalCreatedAt ? new Date(order.createdAt || order.externalCreatedAt).toLocaleString() : undefined}>
                          {orderAge(order)}
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
            <div className="md:hidden space-y-2">
              {orders.map((order: any) => {
                const customerName = entityName(order.customer?.name) || 'Customer';
                const vendorName = entityName(order.vendor?.name) || order.vendorName || '—';
                const cs = order.confirmationStatus || 'pending';
                const vs = order.vendorStatus || 'unassigned';

                return (
                  <div
                    key={order.commerceOrderId || order._id}
                    onClick={() => navigate(getStagePath(order))}
                    className="bg-[#ffffff] border border-[#e5e5e5] active:border-[#dc3545] rounded-2xl p-3 space-y-2 shadow-2xs transition-all cursor-pointer"
                  >
                    {/* Row 1: ID + Price + SLA */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-extrabold text-sm text-[#0a0a0a]">
                          #{order.orderId || order.commerceOrderId}
                        </span>
                        <PriorityBadge priority={order.priority || 'medium'} showLabel={false} />
                        {activeSegment === 'pending_review' && order.reviewMissedAt && (
                          <span className="badge-pill bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold" title={new Date(order.reviewMissedAt).toLocaleString()}>
                            No Pick-up
                          </span>
                        )}
                        {order.unrecoverable && (
                          <span className="badge-pill bg-[#737373] text-white border border-[#737373] text-[10px] font-bold">
                            Unrecoverable
                          </span>
                        )}
                        <span className="badge-pill bg-[#fff5f5] text-[#dc3545] border border-[#f8d7da] text-[10px] font-bold">
                          {order.orderStatus || 'Pending'}
                        </span>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className="text-sm font-extrabold text-[#dc3545] font-mono">
                          Rs. {getTotalAmount(order).toLocaleString()}
                        </span>
                        <SLACountdown dueAt={order.dueAt} />
                      </div>
                    </div>

                    {/* Row 2: Customer · Vendor · Age */}
                    <div className="flex items-center gap-1.5 text-[11px] text-[#737373]">
                      <span className="font-semibold text-[#0a0a0a] truncate">{customerName}</span>
                      <span className="shrink-0">·</span>
                      <span className="truncate">{vendorName}</span>
                      <span className="shrink-0">·</span>
                      <span className="shrink-0 whitespace-nowrap">{orderAge(order)}</span>
                    </div>

                    {/* Row 3: Compact status badges */}
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded-full font-semibold border ${
                        cs === 'confirmed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        Cust: {cs}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full font-semibold border ${
                        vs === 'accepted' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        Vend: {vs}
                      </span>
                    </div>

                    {/* Row 4: Touch Action Bar */}
                    <div className="pt-1.5 border-t border-[#f5f5f5]">
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