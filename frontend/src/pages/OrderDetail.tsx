import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { commerceApi, noteApi, taskApi } from '../services/api';
import { entityName } from '../utils/order';
import {
  PhoneCall, CheckCircle2, XCircle, Clock, Calendar, AlertTriangle,
  PhoneOff, User, Store, PackageCheck, ThumbsUp, ArrowLeft,
  X,
} from 'lucide-react';

const callPhone = (phone: string) => { window.location.href = `tel:${phone}`; };

const customerOutcomes = [
  { label: '✓ Confirmed', color: 'bg-emerald-600 hover:bg-emerald-500 text-white', value: 'confirmed', icon: CheckCircle2 },
  { label: '❌ Cancel', color: 'bg-rose-600 hover:bg-rose-500 text-white', value: 'rejected', icon: XCircle },
  { label: '📅 Schedule call...', color: 'bg-indigo-600 hover:bg-indigo-500 text-white', value: 'schedule_call', icon: Calendar },
  { label: '📵 No Answer', color: 'bg-slate-600 hover:bg-slate-500 text-white', value: 'no_answer', icon: PhoneOff },
  { label: '📞 Call Later', color: 'bg-amber-600 hover:bg-amber-500 text-white', value: 'call_later', icon: Clock },
];

const vendorOutcomes = [
  { label: '✓ Accepted', color: 'bg-emerald-600 hover:bg-emerald-500 text-white', value: 'accepted', icon: CheckCircle2 },
  { label: '⏳ Delayed', color: 'bg-amber-600 hover:bg-amber-500 text-white', value: 'delayed', icon: Clock },
  { label: '📅 Schedule dispatch...', color: 'bg-indigo-600 hover:bg-indigo-500 text-white', value: 'schedule_dispatch', icon: Calendar },
  { label: '📵 No Answer', color: 'bg-slate-600 hover:bg-slate-500 text-white', value: 'no_answer', icon: PhoneOff },
  { label: '📞 Call Later', color: 'bg-amber-600 hover:bg-amber-500 text-white', value: 'call_later', icon: PhoneCall },
];

export default function OrderDetail() {
  const { commerceOrderId } = useParams<{ commerceOrderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerStatus, setCustomerStatus] = useState<string | null>(null);
  const [vendorStatus, setVendorStatus] = useState<string | null>(null);
  const [customerCalling, setCustomerCalling] = useState(false);
  const [vendorCalling, setVendorCalling] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewText, setReviewText] = useState('');

  const [showCustomerDatePicker, setShowCustomerDatePicker] = useState(false);
  const [customerScheduleDate, setCustomerScheduleDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [showVendorDatePicker, setShowVendorDatePicker] = useState(false);
  const [vendorScheduleDate, setVendorScheduleDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  useEffect(() => {
    const fetch = async () => {
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
    if (commerceOrderId) fetch();
  }, [commerceOrderId]);

  useEffect(() => {
    if (!commerceOrderId) return;
    const onUpdate = () => {
      commerceApi.getDetail(commerceOrderId).then((detailRes: any) => {
        const o = detailRes.data;
        setOrder(o);
        setCustomerStatus(o.confirmationStatus || 'pending');
        setVendorStatus(o.vendorStatus || 'unassigned');
      }).catch(console.error);
    };
    window.addEventListener('orders-updated', onUpdate);
    return () => window.removeEventListener('orders-updated', onUpdate);
  }, [commerceOrderId]);

  const updateStatus = async (data: Record<string, any>) => {
    setSaving(true);
    try {
      await commerceApi.updateStatus(commerceOrderId!, data);
    } catch (err) {
      console.error('Failed to update status', err);
      toast.error('Failed to save status');
    } finally {
      setSaving(false);
    }
  };

  const handleCustomerOutcome = async (value: string) => {
    setCustomerCalling(false);
    if (value === 'confirmed') {
      setCustomerStatus('confirmed');
      await updateStatus({ confirmationStatus: 'confirmed', note: 'Customer confirmed order' });
      toast.success('Customer confirmed ✓');
    } else if (value === 'rejected') {
      setCustomerStatus('rejected');
      await updateStatus({ confirmationStatus: 'rejected', orderStatus: 'Cancelled', note: 'Customer cancelled order' });
      toast.warning('Order marked as cancelled');
    } else if (value === 'schedule_call') {
      setShowCustomerDatePicker(true);
    } else if (value === 'rescheduled') {
      setCustomerStatus('rescheduled');
      await updateStatus({ confirmationStatus: 'rescheduled', note: 'Customer requested tomorrow' });
      if (order.activeTaskId) {
        const tomorrow = new Date(Date.now() + 86400000);
        await taskApi.schedule(order.activeTaskId, tomorrow.toISOString().split('T')[0]);
        toast.success('Task rescheduled for tomorrow');
      } else {
        toast('Rescheduled — no active task to schedule');
      }
    } else {
      setCustomerStatus(value);
      toast(`Customer: ${value}`);
    }
  };

  const handleCustomerScheduleConfirm = async () => {
    if (!customerScheduleDate) return;
    if (!order.activeTaskId) {
      toast('No active task to schedule');
      setShowCustomerDatePicker(false);
      return;
    }
    try {
      await taskApi.schedule(order.activeTaskId, customerScheduleDate);
      setCustomerStatus('rescheduled');
      await updateStatus({ confirmationStatus: 'rescheduled', note: `Customer requested callback on ${new Date(customerScheduleDate).toLocaleDateString()}` });
      toast.success(`Call scheduled for ${new Date(customerScheduleDate).toLocaleDateString()}`);
    } catch (err) {
      console.error('Failed to schedule task', err);
      toast.error('Failed to schedule call');
    } finally {
      setShowCustomerDatePicker(false);
    }
  };

  const handleCustomerScheduleCancel = () => {
    setShowCustomerDatePicker(false);
  };

  const handleSaveReview = async () => {
    if (!reviewText.trim()) return;
    setSaving(true);
    try {
      await updateStatus({ review: reviewText.trim(), note: `Customer review: ${reviewText.trim()}` });
      setReviewing(false);
      setReviewText('');
      const detailRes: any = await commerceApi.getDetail(commerceOrderId!);
      setOrder((detailRes as any).data);
      toast.success('Review saved ✓');
    } catch {
      toast.error('Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  const handleVendorOutcome = async (value: string) => {
    setVendorCalling(false);
    if (value === 'accepted') {
      setVendorStatus('accepted');
      await updateStatus({ vendorStatus: 'accepted', note: 'Vendor accepted order' });
      toast.success('Vendor accepted ✓');
    } else if (value === 'delayed') {
      setVendorStatus('delayed');
      await updateStatus({ vendorStatus: 'delayed', note: 'Vendor reported delay' });
      toast.warning('Vendor delayed');
    } else if (value === 'schedule_dispatch') {
      setShowVendorDatePicker(true);
    } else {
      setVendorStatus(value);
      toast(`Vendor: ${value}`);
    }
  };

  const handleVendorScheduleConfirm = async () => {
    if (!vendorScheduleDate) return;
    try {
      const res = await taskApi.getByOrder(order.commerceOrderId, 'pending');
      const tasks = res.data;
      const vendorTask = tasks.find((t: any) => t.type === 'vendor-call' || t.type === 'vendor-delay');
      if (!vendorTask) {
        toast('No vendor task found — assign vendor first');
        setShowVendorDatePicker(false);
        return;
      }
      await taskApi.schedule(vendorTask._id, vendorScheduleDate);
      setVendorStatus('rescheduled');
      await updateStatus({ vendorStatus: 'rescheduled', note: `Vendor scheduled dispatch on ${new Date(vendorScheduleDate).toLocaleDateString()}` });
      toast.success(`Dispatch scheduled for ${new Date(vendorScheduleDate).toLocaleDateString()}`);
    } catch (err) {
      console.error('Failed to schedule vendor task', err);
      toast.error('Failed to schedule dispatch');
    } finally {
      setShowVendorDatePicker(false);
    }
  };

  const handleVendorScheduleCancel = () => {
    setShowVendorDatePicker(false);
  };

  const handleMarkDone = async () => {
    setSaving(true);
    try {
      await commerceApi.updateStatus(commerceOrderId!, {
        orderStatus: 'Processing',
        note: 'Customer confirmed, vendor accepted — marked as done',
      });
      setOrder((prev: any) => ({ ...prev, orderStatus: 'Processing' }));
      toast.success('Order marked as done ✓');
    } catch (err) {
      toast.error('Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500 text-lg">Loading order details...</div>;
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Order not found</p>
        <Link to="/orders" className="text-red-600 hover:underline mt-4 inline-block">← Back to Orders</Link>
      </div>
    );
  }

  const cs = customerStatus || order.confirmationStatus || 'pending';
  const vs = vendorStatus || order.vendorStatus || 'unassigned';
  const os = order.commerce?.orderStatus || order.orderStatus || 'Pending';
  const isDelivered = ['Delivered', 'Shipped', 'Return Delivered'].includes(os);
  const vendor = order.vendor && typeof order.vendor === 'object' ? order.vendor : (order.vendorInfo || {});
  const customer = typeof order.customer === 'object' && order.customer !== null ? order.customer : (order.customerProfile || {});
  const items = order.items || [];
  const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.price || 0), 0);
  const deliveryCharge = order.deliveryChargeBreakdown?.customerDeliveryCharge || 0;
  const codFee = (order.paymentMethod === 'COD' || order.paymentMethod === 'Cash') ? 10 : 0;
  const computedTotal = subtotal + deliveryCharge + codFee;

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in">
      <Link to="/orders" className="text-red-600 hover:underline text-sm inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-red-600 font-mono bg-red-50 px-4 py-1.5 rounded-xl border-2 border-red-200">
              #{order.orderNumber || order.commerceOrderId}
            </span>
            <div className="flex gap-2 flex-wrap">
              <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                os === 'Cancelled' ? 'bg-red-100 text-red-700' :
                os === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                os === 'Processing' ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }`}>{os}</span>
              {cs === 'confirmed' && (
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">Customer Confirmed</span>
              )}
              {vs === 'accepted' && (
                <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-bold">Vendor Accepted</span>
              )}
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="space-y-0.5">
              <div className="text-slate-500">Products: <span className="font-mono font-bold text-slate-800">Rs {subtotal}</span></div>
              {deliveryCharge > 0 && <div className="text-slate-500">{os === 'Pending' && order.dispatchMode === 'Pickup' ? 'Pickup' : os === 'Pending' && order.dispatchMode === 'Drop' ? 'Drop-off' : 'Delivery'}: <span className="font-mono font-bold text-slate-800">Rs {deliveryCharge}</span></div>}
              {codFee > 0 && <div className="text-slate-500">COD Fee: <span className="font-mono font-bold text-slate-800">Rs {codFee}</span></div>}
              <div className="text-base font-black font-mono text-slate-900 pt-0.5 border-t border-slate-200">Rs {computedTotal}</div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{order.paymentMethod || '-'} · {order.paymentStatus || '-'}</div>
          </div>
        </div>
        {order.dispatchMode && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2 pt-3 border-t border-slate-100">
            <span className="font-semibold">🛵 {order.shippingType || '-'}</span>
            {order.shippingAddress?.branch?.name && <span>· From: {order.shippingAddress.branch.name}</span>}
            <span>· {order.dispatchMode}</span>
          </div>
        )}
      </div>

      {order.lastSyncChanges && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3 text-sm flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Updated:</span>
          <span className="text-xs text-indigo-800">{order.lastSyncChanges}</span>
        </div>
      )}

      {cs === 'rescheduled' && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl px-5 py-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-extrabold text-amber-900">Please alert vendor</p>
            <p className="text-xs text-amber-700 mt-0.5">Customer rescheduled this order — call the vendor and update them on the new schedule.</p>
          </div>
        </div>
      )}

      {vs === 'rescheduled' && (
        <div className="bg-indigo-50 border-2 border-indigo-400 rounded-2xl px-5 py-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-extrabold text-indigo-900">Please alert customer</p>
            <p className="text-xs text-indigo-700 mt-0.5">Vendor rescheduled dispatch — call the customer and update them on the new schedule.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <User className="w-5 h-5 text-red-600" />
            <h2 className="font-extrabold text-slate-900">Customer</h2>
            <span className={`ml-auto text-[10px] font-black px-2.5 py-0.5 rounded-full ${
              cs === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
              cs === 'rejected' ? 'bg-rose-100 text-rose-800' :
              'bg-amber-100 text-amber-800'
            }`}>{cs}</span>
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-bold text-slate-900">{customer.name || entityName(order.customer) || '-'}</p>
            <p className="text-slate-600 font-mono text-xs">{customer.phone || order.customerPhone || '-'}</p>
            {customer.email && <p className="text-slate-500 text-xs">{customer.email}</p>}
            {(order.shippingAddress) && (
              <p className="text-slate-500 text-xs mt-2">
                {order.shippingAddress.address || order.shippingAddress.city || ''}
              </p>
            )}
          </div>

          {isDelivered ? (
            <div className="space-y-3">
              {order.review ? (
                <div className="flex items-start gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <ThumbsUp className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">Customer review recorded</p>
                    <p className="text-[11px] text-emerald-600 mt-1">{order.review}</p>
                  </div>
                </div>
              ) : reviewing ? (
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-500">Call customer & record their review:</p>
                  <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)}
                    placeholder="What did the customer say about the delivery?"
                    rows={3}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <div className="flex gap-2">
                    <button onClick={handleSaveReview} disabled={saving || !reviewText.trim()}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg disabled:opacity-50 cursor-pointer">
                      {saving ? 'Saving...' : 'Save Review'}
                    </button>
                    <button onClick={() => { setReviewing(false); setReviewText(''); }}
                      className="text-xs text-slate-400 hover:text-slate-600 px-3 cursor-pointer">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { callPhone(customer.phone || order.customerPhone); setReviewing(true); }}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-extrabold text-sm px-4 py-3 rounded-xl shadow-md transition-all cursor-pointer">
                  <PhoneCall className="w-5 h-5" /> Call Customer &amp; Get Review
                </button>
              )}
            </div>
          ) : (
            <>
          {cs === 'pending' && !customerCalling && (
            <button onClick={() => { callPhone(customer.phone || order.customerPhone); setCustomerCalling(true); }}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm px-4 py-3 rounded-xl shadow-md transition-all cursor-pointer">
              <PhoneCall className="w-5 h-5" /> Call Customer
            </button>
          )}
          {vs === 'rescheduled' && !customerCalling && (
            <button onClick={() => { callPhone(customer.phone || order.customerPhone); setCustomerCalling(true); }}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-4 py-3 rounded-xl shadow-md transition-all cursor-pointer">
              <PhoneCall className="w-5 h-5" /> Call Customer &amp; Update Schedule
            </button>
          )}

          {showCustomerDatePicker && (
            <div className="space-y-2 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
              <p className="text-xs font-bold text-indigo-700 mb-2">Schedule callback date:</p>
              <input type="date" value={customerScheduleDate} onChange={(e) => setCustomerScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-2">
                <button onClick={handleCustomerScheduleConfirm}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg cursor-pointer">
                  Schedule
                </button>
                <button onClick={handleCustomerScheduleCancel}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-lg cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {customerCalling && (
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-500 mb-2">Select outcome:</p>
              <div className="grid grid-cols-2 gap-2">
                {customerOutcomes.map((out) => {
                  const Icon = out.icon;
                  return (
                    <button key={out.value} onClick={() => handleCustomerOutcome(out.value)}
                      disabled={saving}
                      className={`flex items-center justify-center gap-1.5 font-bold text-xs p-2.5 rounded-xl shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer ${out.color} ${saving ? 'opacity-50' : ''}`}>
                      <Icon className="w-4 h-4" /> {out.label}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setCustomerCalling(false)}
                className="text-xs text-slate-400 hover:text-slate-600 pt-1 cursor-pointer">Cancel</button>
            </div>
          )}

          {cs === 'confirmed' && !customerCalling && (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold">Customer confirmed this order</span>
            </div>
          )}

          {cs === 'rejected' && !customerCalling && (
            <div className="flex items-start gap-2 text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Customer cancelled</p>
                <p className="text-[11px] text-rose-600 mt-1">⚠️ Please make hold in NepalCan system</p>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Store className="w-5 h-5 text-red-600" />
            <h2 className="font-extrabold text-slate-900">Vendor</h2>
            <span className={`ml-auto text-[10px] font-black px-2.5 py-0.5 rounded-full ${
              vs === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
              vs === 'delayed' ? 'bg-amber-100 text-amber-800' :
              'bg-slate-100 text-slate-600'
            }`}>{vs}</span>
          </div>

          <div className="space-y-1 text-sm">
          <p className="font-bold text-slate-900">{vendor.name || order.vendorName || '-'}</p>
          <p className="text-slate-600 font-mono text-xs">{vendor.phone || order.vendorPhone || '-'}</p>
            {vendor.email && <p className="text-slate-500 text-xs">{vendor.email}</p>}
            {order.dispatchMode && <p className="text-slate-500 text-xs mt-2">Dispatch: {order.dispatchMode}</p>}
          </div>

          {vs === 'unassigned' && cs === 'pending' && (
            <div className="flex items-center gap-2 text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <Clock className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold">Waiting for customer confirmation first</span>
            </div>
          )}

          {cs === 'confirmed' && (vs === 'unassigned' || vs === 'assigned') && !vendorCalling && (
            <button onClick={() => { callPhone(vendor.phone || order.vendorPhone); setVendorCalling(true); }}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-sm px-4 py-3 rounded-xl shadow-md transition-all cursor-pointer">
              <PhoneCall className="w-5 h-5" /> Call Vendor
            </button>
          )}
          {cs === 'rescheduled' && !vendorCalling && (
            <button onClick={() => { callPhone(vendor.phone || order.vendorPhone); setVendorCalling(true); }}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm px-4 py-3 rounded-xl shadow-md transition-all cursor-pointer">
              <PhoneCall className="w-5 h-5" /> Call Vendor &amp; Update Schedule
            </button>
          )}

          {showVendorDatePicker && (
            <div className="space-y-2 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
              <p className="text-xs font-bold text-indigo-700 mb-2">Schedule dispatch date:</p>
              <input type="date" value={vendorScheduleDate} onChange={(e) => setVendorScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-2">
                <button onClick={handleVendorScheduleConfirm}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg cursor-pointer">
                  Schedule
                </button>
                <button onClick={handleVendorScheduleCancel}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-lg cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {vendorCalling && (
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-500 mb-2">Select outcome:</p>
              <div className="grid grid-cols-2 gap-2">
                {vendorOutcomes.map((out) => {
                  const Icon = out.icon;
                  return (
                    <button key={out.value} onClick={() => handleVendorOutcome(out.value)}
                      disabled={saving}
                      className={`flex items-center justify-center gap-1.5 font-bold text-xs p-2.5 rounded-xl shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer ${out.color} ${saving ? 'opacity-50' : ''}`}>
                      <Icon className="w-4 h-4" /> {out.label}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setVendorCalling(false)}
                className="text-xs text-slate-400 hover:text-slate-600 pt-1 cursor-pointer">Cancel</button>
            </div>
          )}

          {vs === 'accepted' && !vendorCalling && (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold">Vendor accepted this order</span>
            </div>
          )}

          {vs === 'delayed' && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
              <Clock className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold">Vendor reported a delay</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Store className="w-5 h-5 text-red-600" />
          <h2 className="font-extrabold text-slate-900">Logistics</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {order.destinationBranch?.name && (
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Destination Branch</p>
              <p className="font-bold text-slate-900">{order.destinationBranch.name}</p>
            </div>
          )}
          {order.externalNonHeavyLogisticsId && (
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Logistics ID</p>
              <p className="font-mono text-slate-800">{order.externalNonHeavyLogisticsId}</p>
            </div>
          )}
          {order.pickupTicketId && (
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Pickup Ticket</p>
              <p className="font-mono text-slate-800">{order.pickupTicketId}</p>
            </div>
          )}
          {order.externalDeliveryStatus && (
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Delivery Status</p>
              <p className="text-slate-800">{order.externalDeliveryStatus}</p>
            </div>
          )}
          {order.externalDeliveryEvent && (
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Delivery Event</p>
              <p className="font-mono text-xs text-slate-500">{order.externalDeliveryEvent}</p>
            </div>
          )}
        </div>
        {!order.externalNonHeavyLogisticsId && !order.externalDeliveryStatus && (
          <p className="text-xs text-slate-400">No logistics data synced yet.</p>
        )}
      </div>

      {cs === 'confirmed' && vs === 'accepted' && os !== 'Processing' && (
        <div className="bg-white rounded-2xl border-2 border-emerald-300 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ThumbsUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-extrabold text-slate-900">Both customer & vendor confirmed</h3>
          </div>
          <p className="text-xs text-slate-500">Mark this order as done to proceed with processing.</p>
          <button onClick={handleMarkDone} disabled={saving}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm px-6 py-3 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50">
            <PackageCheck className="w-5 h-5" /> {saving ? 'Saving...' : '✓ Mark as Done'}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-5">
          <h3 className="font-extrabold text-slate-900 mb-3">Products ({items.length})</h3>
          <div className="space-y-3">
            {items.map((item: any, i: number) => {
              const product = item.product || {};
              return (
                <div key={i} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  {product.productImages?.[0]?.url && (
                    <img src={product.productImages[0].url} alt={product.productName || ''}
                      className="w-16 h-16 object-cover rounded-lg border shrink-0" />
                  )}
                  <div>
                    <p className="font-bold text-sm text-slate-900">{product.productName || 'Product'}</p>
                    <p className="text-xs text-slate-500">Qty: {item.quantity || 1} × Rs {item.price || 0}</p>
                    <p className="text-sm font-bold text-slate-800">Rs {(item.quantity || 1) * (item.price || 0)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Products Subtotal</span>
              <span className="font-mono font-bold">Rs {subtotal}</span>
            </div>
            {deliveryCharge > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>{os === 'Pending' && order.dispatchMode === 'Pickup' ? 'Pickup Charge' : os === 'Pending' && order.dispatchMode === 'Drop' ? 'Drop-off Charge' : 'Delivery Charge'}</span>
                <span className="font-mono font-bold">Rs {deliveryCharge}</span>
              </div>
            )}
            {codFee > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>COD Handling Fee</span>
                <span className="font-mono font-bold">Rs {codFee}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 font-black text-base pt-1 border-t border-slate-300">
              <span>Total</span>
              <span className="font-mono">Rs {computedTotal}</span>
            </div>
          </div>
        </div>
      )}

      {order.statusHistory?.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-5">
          <h3 className="font-extrabold text-slate-900 text-sm mb-3">Status History</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {order.statusHistory.map((h: any, i: number) => (
              <div key={i} className="flex gap-3 text-sm items-start">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-red-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-slate-800 text-xs">{h.comment || `${h.actorName} updated status`}</p>
                  <p className="text-[10px] text-slate-400">{h.changedAt ? new Date(h.changedAt).toLocaleString() : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-5">
        <h3 className="font-extrabold text-slate-900 text-sm mb-3">Order Notes</h3>
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {(order.notes || []).length === 0 && (
            <p className="text-xs text-slate-400">No notes yet.</p>
          )}
          {(order.notes || []).map((n: any, i: number) => (
            <div key={i} className="flex gap-3 text-sm items-start">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-slate-800 text-xs">{n.comment || n.note || n.message}</p>
                <p className="text-[10px] text-slate-400">{n.actorName || n.actor || n.addedBy || n.authorName || 'staff'} · {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!noteText.trim()) return;
          setNoteSaving(true);
          try {
            await noteApi.addOrderNote(commerceOrderId!, noteText);
            const detailRes: any = await commerceApi.getDetail(commerceOrderId!);
            setOrder((detailRes as any).data);
            setNoteText('');
          } catch { toast.error('Failed to add note'); }
          finally { setNoteSaving(false); }
        }} className="flex gap-2">
          <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            className="flex-1 bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button type="submit" disabled={noteSaving || !noteText.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer">
            {noteSaving ? '...' : 'Add'}
          </button>
        </form>
      </div>
    </div>
  );
}
