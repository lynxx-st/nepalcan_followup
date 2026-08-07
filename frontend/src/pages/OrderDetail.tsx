import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { commerceApi, noteApi, taskApi } from '../services/api';
import { entityName, formatDuration } from '../utils/order';
import Breadcrumbs from '../components/Breadcrumbs';
import LogisticsTimeline from '../components/LogisticsTimeline';
import ReviewModal from '../components/ReviewModal';
import {
  PhoneCall, CheckCircle2, XCircle, Clock, Calendar, AlertTriangle,
  PhoneOff, User, Store, PackageCheck, ThumbsUp, ArrowLeft,
  X, Edit2, FileText, Send, ShoppingBag, MapPin, Package, RefreshCw, Truck,
  RotateCcw, ImageIcon, MessageSquare, CalendarClock
} from 'lucide-react';

const callPhone = (phone: string) => { window.location.href = `tel:${phone}`; };

const customerOutcomes = [
  { label: 'Confirmed', color: 'btn-primary', value: 'confirmed', icon: CheckCircle2 },
  { label: 'Cancel', color: 'btn-destructive', value: 'rejected', icon: XCircle },
  { label: 'Schedule Call', color: 'btn-outline', value: 'schedule_call', icon: Calendar },
  { label: 'No Answer', color: 'btn-secondary', value: 'no_answer', icon: PhoneOff },
  { label: 'Call Later', color: 'btn-outline', value: 'call_later', icon: Clock },
];

const vendorOutcomes = [
  { label: 'Vendor Accepted', color: 'btn-primary', value: 'accepted', icon: CheckCircle2 },
  { label: 'Vendor Delayed', color: 'btn-outline text-amber-700 hover:bg-amber-50', value: 'delayed', icon: Clock },
  { label: 'Schedule Dispatch', color: 'btn-outline', value: 'schedule_dispatch', icon: Calendar },
  { label: 'No Answer', color: 'btn-secondary', value: 'no_answer', icon: PhoneOff },
  { label: 'Call Later', color: 'btn-outline', value: 'call_later', icon: PhoneCall },
];

const getVariantLabel = (item: any): string | null => {
  if (!item) return null;
  const v = item.variant || item.variantTitle || item.variant_title || item.variantName || item.product?.variant || item.product?.variantTitle;
  if (!v) return null;
  if (typeof v === 'string') return (v !== 'Default Title' && v.trim() !== '') ? v : null;
  if (typeof v === 'object') {
    if (v.option && typeof v.option === 'string' && v.option !== 'Default Title') return v.option;
    if (v.title && typeof v.title === 'string' && v.title !== 'Default Title') return v.title;
    if (v.name && typeof v.name === 'string' && v.name !== 'Default Title') return v.name;
    if (v.variantTitle && typeof v.variantTitle === 'string' && v.variantTitle !== 'Default Title') return v.variantTitle;
    const options = [v.option1, v.option2, v.option3].filter(Boolean);
    if (options.length > 0) return options.join(' / ');
    if (v.attributes && typeof v.attributes === 'object') {
      const attrs = Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`);
      if (attrs.length > 0) return attrs.join(', ');
    }
  }
  return null;
};

export default function OrderDetail() {
  const { commerceOrderId } = useParams<{ commerceOrderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerStatus, setCustomerStatus] = useState<string | null>(null);
  const [vendorStatus, setVendorStatus] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneType, setPhoneType] = useState<'customer' | 'vendor'>('customer');

  const [showReviewModal, setShowReviewModal] = useState(false);

  const [showCustomerDatePicker, setShowCustomerDatePicker] = useState(false);
  const [customerScheduleDate, setCustomerScheduleDate] = useState('');

  const [showVendorDatePicker, setShowVendorDatePicker] = useState(false);
  const [vendorScheduleDate, setVendorScheduleDate] = useState('');

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const detailRes: any = await commerceApi.getDetail(commerceOrderId!);
      const o = (detailRes as any).data;
      setOrder(o);
      setCustomerStatus(o.confirmationStatus || 'pending');
      setVendorStatus(o.vendorStatus || 'unassigned');
    } catch (err) {
      console.error('Failed to load order detail', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (commerceOrderId) fetchDetail();
  }, [commerceOrderId]);

  useEffect(() => {
    if (!commerceOrderId) return;
    const onUpdate = () => { fetchDetail(); };
    window.addEventListener('orders-updated', onUpdate);
    return () => window.removeEventListener('orders-updated', onUpdate);
  }, [commerceOrderId]);

  const updateStatus = async (data: Record<string, any>) => {
    setSaving(true);
    try {
      await commerceApi.updateStatus(commerceOrderId!, data);
      toast.success('Order status updated');
      await fetchDetail();
    } catch (err) {
      console.error('Failed to update status', err);
      toast.error('Failed to save status');
    } finally {
      setSaving(false);
    }
  };

  const handleCustomerOutcome = async (value: string) => {
    if (value === 'confirmed') {
      setCustomerStatus('confirmed');
      await updateStatus({ confirmationStatus: 'confirmed', note: 'Customer confirmed order' });
      toast.success('Customer Confirmed — Step 2 Vendor Call active.');
    } else if (value === 'rejected') {
      setCustomerStatus('rejected');
      await updateStatus({ confirmationStatus: 'rejected', orderStatus: 'Cancelled', note: 'Customer cancelled order' });
    } else if (value === 'schedule_call') {
      setShowCustomerDatePicker(true);
    } else {
      setCustomerStatus(value);
      await updateStatus({ confirmationStatus: value, note: `Customer status updated to ${value}` });
    }
  };

  const handleVendorOutcome = async (value: string) => {
    if (value === 'accepted') {
      setVendorStatus('accepted');
      await updateStatus({ vendorStatus: 'accepted', note: 'Vendor accepted order' });
      toast.success('Vendor Accepted!');
    } else if (value === 'delayed') {
      setVendorStatus('delayed');
      await updateStatus({ vendorStatus: 'delayed', note: 'Vendor reported dispatch delay' });
    } else if (value === 'schedule_dispatch') {
      setShowVendorDatePicker(true);
    } else {
      setVendorStatus(value);
      await updateStatus({ vendorStatus: value, note: `Vendor status updated to ${value}` });
    }
  };

  const handleCustomerScheduleConfirm = async () => {
    if (!customerScheduleDate) {
      toast.error('Please select a date');
      return;
    }
    try {
      setSaving(true);
      if (order?.activeTaskId) {
        await taskApi.schedule(order.activeTaskId, customerScheduleDate);
      }
      setCustomerStatus('rescheduled');
      await updateStatus({ confirmationStatus: 'rescheduled', note: `Customer call rescheduled for ${customerScheduleDate}`, scheduledAt: customerScheduleDate });
      toast.success(`Customer call scheduled for ${customerScheduleDate}`);
      setShowCustomerDatePicker(false);
      setCustomerScheduleDate('');
    } catch (err) {
      toast.error('Failed to schedule customer call');
    } finally {
      setSaving(false);
    }
  };

  const handleVendorScheduleConfirm = async () => {
    if (!vendorScheduleDate) {
      toast.error('Please select a date');
      return;
    }
    try {
      setSaving(true);
      if (order?.activeTaskId) {
        await taskApi.schedule(order.activeTaskId, vendorScheduleDate);
      }
      setVendorStatus('rescheduled');
      await updateStatus({ vendorStatus: 'rescheduled', note: `Vendor dispatch rescheduled for ${vendorScheduleDate}`, scheduledAt: vendorScheduleDate });
      toast.success(`Vendor dispatch scheduled for ${vendorScheduleDate}`);
      setShowVendorDatePicker(false);
      setVendorScheduleDate('');
    } catch (err) {
      toast.error('Failed to schedule vendor call');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkDone = async () => {
    setSaving(true);
    try {
      await updateStatus({
        confirmationStatus: 'confirmed',
        vendorStatus: 'accepted',
        note: 'Customer confirmed & vendor accepted — marked as done',
      });
      toast.success('Order marked as done');
    } catch {
      toast.error('Failed to update order status');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReview = async (reviewData: any) => {
    try {
      await updateStatus({
        review: reviewData,
        note: 'Review collected via review modal',
      });
      toast.success('Review saved');
    } catch {
      toast.error('Failed to save review');
      throw new Error('Save failed');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !commerceOrderId) return;
    try {
      setNoteSaving(true);
      await noteApi.addOrderNote(commerceOrderId, noteText.trim());
      setNoteText('');
      toast.success('Note added');
      fetchDetail();
    } catch {
      toast.error('Failed to add note');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleSavePhone = async () => {
    if (!newPhone.trim() || !commerceOrderId) return;
    try {
      await commerceApi.updatePhone(commerceOrderId, newPhone.trim(), phoneType);
      toast.success(`${phoneType === 'customer' ? 'Customer' : 'Vendor'} phone updated`);
      setShowPhoneEdit(false);
      fetchDetail();
    } catch {
      toast.error('Failed to update phone');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-[#dc3545] font-semibold text-xs animate-pulse">
        Loading order details...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="card-blueprint p-6 text-center space-y-3">
        <h2 className="text-sm font-bold text-[#0a0a0a]">Order Not Found</h2>
        <p className="text-xs text-[#737373]">The requested order record could not be retrieved.</p>
        <button onClick={() => navigate('/orders')} className="btn-primary text-xs cursor-pointer">
          Return to Orders
        </button>
      </div>
    );
  }

  const customerName = entityName(order.customer?.name) || 'Customer';
  const customerPhone = order.customerPhone || order.customer?.phone || 'N/A';
  const vendorName = entityName(order.vendor?.name) || order.vendorName || 'Vendor';
  const vendorPhone = order.vendorPhone || order.vendor?.phone || 'N/A';
  const items = order.items || order.commerce?.items || [];
  const notes = order.notes || [];
  const cs = customerStatus || order.confirmationStatus || 'pending';
  const vs = vendorStatus || order.vendorStatus || 'unassigned';
  const os = order.orderStatus || order.commerce?.orderStatus || 'Pending';
  const stage = order.workflowStage || 'other';

  const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.price || 0), 0);
  const deliveryCharge = order.deliveryChargeBreakdown?.customerDeliveryCharge || 0;
  const codFee = (order.paymentMethod === 'COD' || order.paymentMethod === 'Cash') ? 10 : 0;
  const computedTotal = subtotal + deliveryCharge + codFee;

  const isCustomerConfirmed = cs === 'confirmed';
  const isVendorAccepted = vs === 'accepted';
  const isBothConfirmed = isCustomerConfirmed && isVendorAccepted;
  const isCancelled = cs === 'rejected' || os === 'Cancelled';
  const isProcessingOrShipped = ['Processing', 'Shipped', 'Delivered'].includes(os);

  const reviewObj = typeof order.review === 'object' ? order.review : { text: order.review || '' };

  return (
    <div className="space-y-4 pb-20 animate-in">
      <Breadcrumbs items={[
        { label: 'Orders', to: '/orders' },
        { label: `#${order.orderId || order.commerceOrderId}` }
      ]} />

      {/* TOP HEADER BAR */}
      <div className="card-blueprint p-4 flex flex-wrap items-center justify-between gap-3 bg-[#ffffff]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/orders')}
            className="p-2 rounded-2xl bg-[#f5f5f5] border border-[#e5e5e5] hover:bg-[#fff5f5] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#0a0a0a]" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#0a0a0a] tracking-tight">
                Order #{order.orderId || order.commerceOrderId}
              </h1>
              <span className={`badge-pill text-[11px] font-semibold uppercase ${
                isCancelled ? 'bg-red-50 text-red-700 border border-red-200' :
                isProcessingOrShipped ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                'badge-pill-soft'
              }`}>
                {os}
              </span>
            </div>
            <p className="text-[12px] text-[#737373] mt-0.5 font-medium">
              Created {new Date(order.createdAt || Date.now()).toLocaleDateString()} · Payment: <span className="font-semibold text-[#0a0a0a]">{order.paymentMethod || 'COD'} ({order.paymentStatus || 'Pending'})</span>
            </p>
            {order.deliveredAt && (
              <p className="text-[12px] text-[#737373] mt-0.5 font-medium">
                Delivered {new Date(order.deliveredAt).toLocaleString()} · <span className="font-semibold text-emerald-700">Time to delivery: {formatDuration(order.timeToDeliveryMs)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Quick Call Actions */}
        <div className="flex items-center gap-2">
          {customerPhone !== 'N/A' && (
            <button
              onClick={() => callPhone(customerPhone)}
              className="btn-primary text-xs px-3.5 py-1.5 cursor-pointer min-h-[36px]"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call Customer</span>
            </button>
          )}
          {vendorPhone !== 'N/A' && (
            <button
              onClick={() => callPhone(vendorPhone)}
              className="btn-outline text-xs px-3.5 py-1.5 cursor-pointer min-h-[36px]"
            >
              <Store className="w-3.5 h-3.5 text-[#dc3545]" />
              <span>Call Vendor</span>
            </button>
          )}
        </div>
      </div>

      {/* DUAL-COLUMN VIEWPORT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* LEFT: Compact Order & Product Info Card */}
        <div className="lg:col-span-5 card-blueprint p-4 space-y-3 bg-[#ffffff]">
          <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-[#dc3545]" />
              Products ({items.length})
            </h2>
            <span className="text-xs font-bold text-[#dc3545]">
              Total: Rs. {(order.totalAmount || computedTotal).toLocaleString()}
            </span>
          </div>

          {/* Compact Product List */}
          <div className="space-y-2 max-h-36 overflow-y-auto divide-y divide-[#f5f5f5]">
            {items.map((item: any, idx: number) => {
              const product = item.product || {};
              const title = product.title || product.productName || item.title || item.name || `Item #${idx + 1}`;
              const imageUrl = product.productImages?.[0]?.url || item.image || item.imageUrl;
              const price = item.price || 0;
              const qty = item.quantity || 1;
              const variantLabel = getVariantLabel(item);

              return (
                <div key={idx} className="pt-2 first:pt-0 flex items-center gap-2.5 text-xs">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-10 h-10 object-cover rounded-xl border border-[#e5e5e5] shrink-0 bg-[#fafafa]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-[#737373]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs text-[#0a0a0a] truncate">{title}</p>
                    {variantLabel && (
                      <span className="inline-block text-[10px] font-medium text-[#0a0a0a] bg-[#f5f5f5] px-1.5 py-0.5 rounded border border-[#e5e5e5] mt-0.5">
                        Variant: {variantLabel}
                      </span>
                    )}
                    <p className="text-[11px] text-[#737373] mt-0.5">
                      Qty: {qty} × Rs. {price.toLocaleString()}
                    </p>
                  </div>
                  <span className="font-bold text-xs text-[#0a0a0a] shrink-0">
                    Rs. {(qty * price).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Financial Breakdown Table */}
          <div className="bg-[#fafafa] p-2.5 rounded-2xl border border-[#e5e5e5] space-y-1 text-[11px]">
            <div className="flex justify-between text-[#737373]">
              <span>Subtotal:</span>
              <span className="font-medium text-[#0a0a0a]">Rs. {subtotal.toLocaleString()}</span>
            </div>
            {deliveryCharge > 0 && (
              <div className="flex justify-between text-[#737373]">
                <span>Delivery Charge:</span>
                <span className="font-medium text-[#0a0a0a]">Rs. {deliveryCharge.toLocaleString()}</span>
              </div>
            )}
            {codFee > 0 && (
              <div className="flex justify-between text-[#737373]">
                <span>COD Handling:</span>
                <span className="font-medium text-[#0a0a0a]">Rs. {codFee.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-bold text-[#0a0a0a] pt-1 border-t border-[#e5e5e5]">
              <span>Total Amount:</span>
              <span className="text-[#dc3545]">Rs. {(order.totalAmount || computedTotal).toLocaleString()}</span>
            </div>
          </div>

          {/* Customer & Vendor Contact Chips */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[#fafafa] p-2 rounded-xl border border-[#e5e5e5]">
              <div className="flex justify-between items-center text-[10px] text-[#737373] uppercase font-bold">
                <span>Customer</span>
                <button onClick={() => { setNewPhone(customerPhone); setPhoneType('customer'); setShowPhoneEdit(true); }} className="text-[#dc3545] hover:underline cursor-pointer">Edit</button>
              </div>
              <p className="font-semibold text-[#0a0a0a] truncate">{customerName}</p>
              <p className="text-[#737373] truncate">{customerPhone}</p>
            </div>

            <div className="bg-[#fafafa] p-2 rounded-xl border border-[#e5e5e5]">
              <div className="flex justify-between items-center text-[10px] text-[#737373] uppercase font-bold">
                <span>Vendor</span>
                <button onClick={() => { setNewPhone(vendorPhone); setPhoneType('vendor'); setShowPhoneEdit(true); }} className="text-[#dc3545] hover:underline cursor-pointer">Edit</button>
              </div>
              <p className="font-semibold text-[#0a0a0a] truncate">{vendorName}</p>
              <p className="text-[#737373] truncate">{vendorPhone}</p>
            </div>
          </div>
        </div>

        {/* RIGHT: Workflow Confirmation Actions Card (DYNAMIC ACCORDING TO TASK STAGE) */}
        <div className="lg:col-span-7 card-blueprint p-4 space-y-3 bg-[#ffffff]">

          {/* 0. RESCHEDULED STAGE -> SHOW RESCHEDULE INFO + RESUME ACTIONS */}
          {stage === 'rescheduled' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373]">
                  Rescheduled Module
                </h2>
                <span className="badge-pill bg-amber-500 text-white font-medium text-[10px]">
                  Rescheduled
                </span>
              </div>
              <div className="p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-[#0a0a0a] font-bold">
                  <CalendarClock className="w-4 h-4 text-amber-600" />
                  {cs === 'rescheduled' ? 'Customer call' : 'Vendor dispatch'} rescheduled
                  {order.rescheduledAt ? ` for ${new Date(order.rescheduledAt).toLocaleString()}` : ''}
                </div>
                <p className="text-[11px] text-[#737373]">
                  Current status — Customer: <span className="font-semibold text-[#0a0a0a]">{cs}</span> · Vendor: <span className="font-semibold text-[#0a0a0a]">{vs}</span>
                </p>
                {(() => {
                  const lastNote = [...(order.statusHistory || [])].reverse().find((h: any) => String(h.comment || h.note || '').toLowerCase().includes('reschedul'));
                  return lastNote?.comment ? (
                    <p className="text-[11px] text-[#737373] bg-[#ffffff] border border-[#e5e5e5] rounded-xl p-2">{lastNote.comment}</p>
                  ) : null;
                })()}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {customerPhone !== 'N/A' && (
                    <button onClick={() => callPhone(customerPhone)} className="btn-outline text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]">
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Call Customer</span>
                    </button>
                  )}
                  {vendorPhone !== 'N/A' && (
                    <button onClick={() => callPhone(vendorPhone)} className="btn-outline text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]">
                      <Store className="w-3.5 h-3.5" />
                      <span>Call Vendor</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="pt-1">
                <p className="text-[11px] text-[#737373] mb-2">Resume the flow after the follow-up call:</p>
                <div className="flex flex-wrap gap-1.5">
                  {cs === 'rescheduled' && (
                    <button
                      onClick={() => handleCustomerOutcome('confirmed')}
                      disabled={saving}
                      className="btn-primary text-xs px-3 py-1.5 cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Customer Confirmed</span>
                    </button>
                  )}
                  {vs === 'rescheduled' && (
                    <button
                      onClick={() => handleVendorOutcome('accepted')}
                      disabled={saving}
                      className="btn-outline text-xs px-3 py-1.5 cursor-pointer text-emerald-800 bg-emerald-50 border-emerald-300 font-bold flex items-center gap-1.5 min-h-[44px]"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Mark Vendor Accepted</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : stage === 'confirmed_unprocessed' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373]">
                  Confirmed Unprocessed — Vendor Task Module
                </h2>
                <span className="badge-pill bg-amber-500 text-white font-medium text-[10px]">
                  Call Vendor Required
                </span>
              </div>
              <p className="text-xs text-[#737373]">
                Customer order is confirmed. Call vendor to accept and arrange pickup dispatch:
              </p>
              <div className="p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0a0a0a] flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-amber-600" />
                    Vendor Confirmation: {vs}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {vendorOutcomes.map((out) => {
                    const Icon = out.icon;
                    return (
                      <button
                        key={out.value}
                        onClick={() => handleVendorOutcome(out.value)}
                        disabled={saving}
                        className={`${out.color} text-xs font-medium px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{out.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : stage === 'collected_by_logistics' ? (
            /* COLLECTED BY LOGISTICS STAGE -> SHOW LOGISTICS STATUS & TIMELINE, AWAITING SHIPMENT */
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-purple-600" />
                  Collected by Logistics — Awaiting Shipment
                </h2>
                <span className="badge-pill bg-purple-600 text-white font-medium text-[10px]">
                  Collected
                </span>
              </div>
              <p className="text-xs text-[#737373]">
                Logistics has collected the parcel from the vendor. Follow up until it is marked shipped:
              </p>
              <LogisticsTimeline
                events={order.externalStatusHistory}
                externalLogisticsOrderId={order.externalLogisticsOrderId || order.externalNonHeavyLogisticsId}
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {vendorPhone !== 'N/A' && (
                  <button
                    onClick={() => callPhone(vendorPhone)}
                    className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Call Vendor (Logistics)</span>
                  </button>
                )}
                {customerPhone !== 'N/A' && (
                  <button
                    onClick={() => callPhone(customerPhone)}
                    className="btn-outline text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call Customer</span>
                  </button>
                )}
              </div>
            </div>
          ) : stage === 'shipped' ? (
            /* 2. SHIPPED STAGE -> SHOW LOGISTICS STATUS & TIMELINE FROM ORDER API */
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-purple-600" />
                  Shipped Order Logistics Status Module
                </h2>
                <span className="badge-pill bg-purple-600 text-white font-medium text-[10px]">
                  In Transit
                </span>
              </div>
              <LogisticsTimeline
                events={order.externalStatusHistory}
                externalLogisticsOrderId={order.externalLogisticsOrderId || order.externalNonHeavyLogisticsId}
              />
            </div>
          ) : stage === 'pending_review' ? (
            /* 3. PENDING REVIEW STAGE -> CALL CUSTOMER & GET REVIEW */
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
                  <ThumbsUp className="w-4 h-4 text-amber-600" />
                  Post-Delivery Review Follow-up Module
                </h2>
                <span className="badge-pill bg-emerald-600 text-white font-medium text-[10px]">
                  Delivered
                </span>
              </div>
              <p className="text-xs text-[#737373]">
                Order delivered. Call customer to collect feedback and survey answers:
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {customerPhone !== 'N/A' && (
                  <button
                    onClick={() => callPhone(customerPhone)}
                    className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Call Customer</span>
                  </button>
                )}
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="btn-outline text-xs text-amber-700 border-amber-300 bg-amber-50 px-4 py-2 cursor-pointer flex items-center gap-1.5 font-bold"
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>Get Review</span>
                </button>
              </div>

              {reviewObj.text && (
                <div className="mt-3 p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-[#0a0a0a]">Saved Review & Feedback:</p>
                  <p className="text-xs text-[#0a0a0a] italic bg-white p-2.5 rounded-xl border border-[#e5e5e5]">
                    "{reviewObj.text}"
                  </p>
                  {reviewObj.platformSatisfied && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="p-2 bg-white rounded-xl border border-[#e5e5e5]">
                        <span className="text-[#737373]">Platform Satisfied: </span>
                        <span className="font-bold text-[#0a0a0a] uppercase">{reviewObj.platformSatisfied}</span>
                        {reviewObj.platformSatisfiedOther && <p className="text-[10px] text-[#737373] mt-0.5">{reviewObj.platformSatisfiedOther}</p>}
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-[#e5e5e5]">
                        <span className="text-[#737373]">Delivery Satisfied: </span>
                        <span className="font-bold text-[#0a0a0a] uppercase">{reviewObj.deliverySatisfied}</span>
                        {reviewObj.deliverySatisfiedOther && <p className="text-[10px] text-[#737373] mt-0.5">{reviewObj.deliverySatisfiedOther}</p>}
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-[#e5e5e5] sm:col-span-2">
                        <span className="text-[#737373]">Will Use Again: </span>
                        <span className="font-bold text-[#0a0a0a] uppercase">{reviewObj.willUseAgain}</span>
                        {reviewObj.willUseAgainOther && <p className="text-[10px] text-[#737373] mt-0.5">{reviewObj.willUseAgainOther}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (stage === 'customer_response' || stage === 'vendor_response') ? (
            /* 4. RETURN FOLLOW-UP MODULE (CUSTOMER RESPONSE OR VENDOR RESPONSE) */
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-[#dc3545]" />
                  Return Follow-up Module ({stage === 'customer_response' ? 'Step 1: Customer' : 'Step 2: Vendor'})
                </h2>
                <span className="badge-pill bg-[#dc3545] text-white font-medium text-[10px]">
                  Return Request
                </span>
              </div>

              <div className="p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl space-y-3">
                {stage === 'customer_response' ? (
                  <>
                    <p className="text-xs text-[#737373]">
                      Step 1: Call customer to verify return request and item condition:
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {customerPhone !== 'N/A' && (
                        <button
                          onClick={() => callPhone(customerPhone)}
                          className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Call Customer</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleCustomerOutcome('confirmed')}
                        className="btn-outline text-xs px-4 py-2 cursor-pointer text-emerald-800 bg-emerald-50 border-emerald-300 font-bold min-h-[44px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm Return Request</span>
                      </button>
                      <button
                        onClick={() => handleCustomerOutcome('rejected')}
                        className="btn-secondary text-xs px-4 py-2 cursor-pointer text-red-600 font-bold min-h-[44px]"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject Return Request</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-[#737373]">
                      Step 2: Call vendor to obtain return acceptance & dispatch pickup:
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {vendorPhone !== 'N/A' && (
                        <button
                          onClick={() => callPhone(vendorPhone)}
                          className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                        >
                          <Store className="w-3.5 h-3.5" />
                          <span>Call Vendor</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleVendorOutcome('accepted')}
                        className="btn-outline text-xs px-4 py-2 cursor-pointer text-emerald-800 bg-emerald-50 border-emerald-300 font-bold min-h-[44px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Vendor Accepted</span>
                      </button>
                      <button
                        onClick={() => handleVendorOutcome('delayed')}
                        className="btn-secondary text-xs px-4 py-2 cursor-pointer font-bold min-h-[44px]"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Vendor Rejected</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : stage === 'cancelled' ? (
            /* CANCELLED STAGE -> CUSTOMER RECOVERY CALL MODULE ONLY */
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-[#e7000b]" />
                  Customer Recovery Call Module
                </h2>
                <span className="badge-pill bg-[#e7000b] text-white font-medium text-[10px]">
                  Cancelled
                </span>
              </div>
              <div className="p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl space-y-2 text-xs">
                <p className="font-bold text-[#0a0a0a]">
                  Cancellation Reason: {order.commerce?.cancelledReason || order.cancelledReason || 'Not specified'}
                </p>
                {(order.commerce?.cancelledBy || order.cancelledBy) && (
                  <p className="text-[11px] text-[#737373]">Cancelled by: {order.commerce?.cancelledBy || order.cancelledBy}</p>
                )}
              </div>
              <p className="text-xs text-[#737373]">
                Call the customer to understand the cancellation and attempt recovery:
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {customerPhone !== 'N/A' && (
                  <button
                    onClick={() => callPhone(customerPhone)}
                    className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call Customer</span>
                  </button>
                )}
              </div>
            </div>
          ) : stage === 'hold' ? (
            /* HOLD STAGE -> CUSTOMER FOLLOW-UP MODULE */
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Hold Follow-up Module
                </h2>
                <span className="badge-pill bg-amber-500 text-white font-medium text-[10px]">
                  On Hold
                </span>
              </div>
              <p className="text-xs text-[#737373]">
                This order is on hold. Follow up with the customer to resolve the hold reason:
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {customerPhone !== 'N/A' && (
                  <button
                    onClick={() => callPhone(customerPhone)}
                    className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call Customer</span>
                  </button>
                )}
                {vendorPhone !== 'N/A' && (
                  <button
                    onClick={() => callPhone(vendorPhone)}
                    className="btn-outline text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Call Vendor</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* DEFAULT PRE-PROCESSING STAGE (STEP 1 & STEP 2) */
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373]">
                  Confirmation Flow Engine
                </h2>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className={`px-2.5 py-0.5 rounded-full font-medium ${isCustomerConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-50 text-[#dc3545]'}`}>
                    1. Cust: {cs}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full font-medium ${isVendorAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    2. Vendor: {vs}
                  </span>
                </div>
              </div>

              {/* STEP 1: Customer Confirmation Actions */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                isCustomerConfirmed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-[#fafafa] border-[#e5e5e5]'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#0a0a0a] flex items-center gap-1.5">
                    <User className={`w-4 h-4 ${isCustomerConfirmed ? 'text-emerald-600' : 'text-[#dc3545]'}`} />
                    Step 1: Customer Confirmation
                  </span>
                  {isCustomerConfirmed ? (
                    <span className="badge-pill bg-emerald-600 text-white font-medium text-[10px]">
                      ✓ Customer Confirmed
                    </span>
                  ) : (
                    <span className="badge-pill bg-[#dc3545] text-white font-medium text-[10px]">
                      Pending Call
                    </span>
                  )}
                </div>

                {!isCustomerConfirmed ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#737373]">Log customer response after call:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {customerOutcomes.map((out) => {
                        const Icon = out.icon;
                        return (
                          <button
                            key={out.value}
                            onClick={() => handleCustomerOutcome(out.value)}
                            disabled={saving}
                            className={`${out.color} text-xs font-medium px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{out.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-emerald-900">
                    <span className="text-[11px]">Customer order verified. Step 2 Vendor Confirmation is active below.</span>
                    <button onClick={() => setCustomerStatus('pending')} className="text-[10px] font-bold underline text-emerald-700 cursor-pointer">Re-open</button>
                  </div>
                )}
              </div>

              {/* STEP 2: Vendor Confirmation Actions */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                isVendorAccepted ? 'bg-emerald-50/50 border-emerald-200' : isCustomerConfirmed ? 'bg-[#fafafa] border-[#e5e5e5]' : 'bg-[#fafafa] border-[#e5e5e5] opacity-75'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#0a0a0a] flex items-center gap-1.5">
                    <Store className={`w-4 h-4 ${isVendorAccepted ? 'text-emerald-600' : 'text-amber-600'}`} />
                    Step 2: Vendor Confirmation
                  </span>
                  {isVendorAccepted ? (
                    <span className="badge-pill bg-emerald-600 text-white font-medium text-[10px]">
                      ✓ Vendor Accepted
                    </span>
                  ) : isCustomerConfirmed ? (
                    <span className="badge-pill bg-amber-500 text-white font-medium text-[10px]">
                      Active Step
                    </span>
                  ) : (
                    <span className="badge-pill badge-pill-soft text-[10px]">
                      Pending Step 1
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] text-[#737373]">Log vendor response after call:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {vendorOutcomes.map((out) => {
                      const Icon = out.icon;
                      return (
                        <button
                          key={out.value}
                          onClick={() => handleVendorOutcome(out.value)}
                          disabled={saving}
                          className={`${out.color} text-xs font-medium px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{out.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* BOTH CONFIRMED BANNER */}
              {isBothConfirmed && os !== 'Processing' && os !== 'Shipped' && (
                <div className="p-3 bg-[#fff5f5] border border-[#f8d7da] rounded-2xl flex items-center justify-between gap-3 animate-in">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-[#dc3545]" />
                    <p className="text-xs font-bold text-[#0a0a0a]">Both Customer & Vendor Confirmed!</p>
                  </div>
                  <button
                    onClick={handleMarkDone}
                    disabled={saving}
                    className="btn-primary text-xs px-4 py-2 font-semibold cursor-pointer disabled:opacity-50 min-h-[36px]"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>✓ Mark as Done</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* LOWER SECTION: Order Call Notes & History */}
      <div className="card-blueprint p-4 space-y-3 bg-[#ffffff]">
        <h3 className="text-xs font-bold text-[#0a0a0a] flex items-center gap-2 uppercase tracking-wider border-b border-[#e5e5e5] pb-2">
          <FileText className="w-3.5 h-3.5 text-[#dc3545]" />
          Order Notes & Audit Log
        </h3>

        <form onSubmit={handleAddNote} className="flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Type note or call summary..."
            className="input-blueprint flex-1 text-xs"
          />
          <button
            type="submit"
            disabled={noteSaving || !noteText.trim()}
            className="btn-primary text-xs px-4 py-1.5 cursor-pointer disabled:opacity-50 min-h-[36px]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        </form>

        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="text-xs text-[#737373] py-2">No notes recorded yet.</p>
          ) : (
            notes.map((n: any, idx: number) => (
              <div key={idx} className="bg-[#fafafa] border border-[#e5e5e5] p-2.5 rounded-xl text-xs space-y-0.5">
                <p className="text-[#0a0a0a] font-medium">{n.note || n.comment}</p>
                <p className="text-[10px] text-[#737373]">
                  {n.actorName || n.actor || 'System'} · {new Date(n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSubmit={handleSaveReview}
          orderId={order.orderId || order.commerceOrderId}
        />
      )}

      {/* Customer Date Picker Modal */}
      {showCustomerDatePicker && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in-fast" onClick={() => { setShowCustomerDatePicker(false); setCustomerScheduleDate(''); }}>
          <div className="bg-[#ffffff] card-blueprint p-6 max-w-sm w-full space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#0a0a0a]">Schedule Customer Callback</h3>
              <button onClick={() => { setShowCustomerDatePicker(false); setCustomerScheduleDate(''); }} className="p-1 rounded-xl hover:bg-[#f5f5f5] cursor-pointer">
                <X className="w-4 h-4 text-[#737373]" />
              </button>
            </div>
            <input
              type="date"
              value={customerScheduleDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setCustomerScheduleDate(e.target.value)}
              className="input-blueprint w-full text-xs"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setShowCustomerDatePicker(false); setCustomerScheduleDate(''); }}
                className="btn-secondary text-xs px-3 py-1.5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomerScheduleConfirm}
                disabled={saving || !customerScheduleDate}
                className="btn-primary text-xs px-4 py-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Scheduling...' : 'Schedule Call'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Date Picker Modal */}
      {showVendorDatePicker && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in-fast" onClick={() => { setShowVendorDatePicker(false); setVendorScheduleDate(''); }}>
          <div className="bg-[#ffffff] card-blueprint p-6 max-w-sm w-full space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#0a0a0a]">Schedule Vendor Dispatch</h3>
              <button onClick={() => { setShowVendorDatePicker(false); setVendorScheduleDate(''); }} className="p-1 rounded-xl hover:bg-[#f5f5f5] cursor-pointer">
                <X className="w-4 h-4 text-[#737373]" />
              </button>
            </div>
            <input
              type="date"
              value={vendorScheduleDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setVendorScheduleDate(e.target.value)}
              className="input-blueprint w-full text-xs"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setShowVendorDatePicker(false); setVendorScheduleDate(''); }}
                className="btn-secondary text-xs px-3 py-1.5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleVendorScheduleConfirm}
                disabled={saving || !vendorScheduleDate}
                className="btn-primary text-xs px-4 py-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Scheduling...' : 'Schedule Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phone Edit Modal */}
      {showPhoneEdit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in-fast">
          <div className="bg-[#ffffff] card-blueprint p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-[#0a0a0a]">
              Update {phoneType === 'customer' ? 'Customer' : 'Vendor'} Contact Phone
            </h3>
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Enter phone number..."
              className="input-blueprint w-full text-xs"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowPhoneEdit(false)}
                className="btn-secondary text-xs px-3 py-1.5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePhone}
                className="btn-primary text-xs px-4 py-1.5 cursor-pointer"
              >
                Save Phone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Mobile Action Bar (<640px) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-2.5 bg-[#ffffff]/95 backdrop-blur-md border-t border-[#e5e5e5] flex items-center justify-around gap-2 z-40 shadow-lg">
        {customerPhone !== 'N/A' && (
          <button
            onClick={() => callPhone(customerPhone)}
            className="btn-primary text-xs flex-1 py-2.5 font-bold justify-center min-h-[44px]"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call</span>
          </button>
        )}
        {stage === 'pending_review' ? (
          <button
            onClick={() => setShowReviewModal(true)}
            className="btn-outline text-xs flex-1 py-2.5 text-amber-700 border-amber-300 bg-amber-50 font-bold justify-center min-h-[44px]"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Review</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => handleCustomerOutcome('confirmed')}
              className="btn-outline text-xs flex-1 py-2.5 text-emerald-700 border-emerald-300 bg-emerald-50 font-bold justify-center min-h-[44px]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirm</span>
            </button>
            <button
              onClick={() => handleVendorOutcome('accepted')}
              className="btn-outline text-xs flex-1 py-2.5 text-amber-700 border-amber-300 bg-amber-50 font-bold justify-center min-h-[44px]"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Vendor</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}