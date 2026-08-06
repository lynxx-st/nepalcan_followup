import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { commerceApi, noteApi, taskApi } from '../services/api';
import { entityName } from '../utils/order';
import Breadcrumbs from '../components/Breadcrumbs';
import LogisticsTimeline from '../components/LogisticsTimeline';
import {
  PhoneCall, CheckCircle2, XCircle, Clock, Calendar, AlertTriangle,
  PhoneOff, User, Store, PackageCheck, ArrowLeft,
  X, Edit2, FileText, Send, ShoppingBag, MapPin, Package, RefreshCw,
  Info, MessageSquare,
} from 'lucide-react';

const callPhone = (phone: string) => { window.location.href = `tel:${phone}`; };

const vendorOutcomes = [
  { label: 'Vendor Accepted', color: 'btn-primary', value: 'accepted', icon: CheckCircle2 },
  { label: 'Vendor Delayed', color: 'btn-outline text-amber-700 hover:bg-amber-50', value: 'delayed', icon: Clock },
  { label: 'Vendor Rescheduled', color: 'btn-outline text-rose-700 hover:bg-rose-50', value: 'rescheduled', icon: RotateCcw },
  { label: 'Schedule Dispatch', color: 'btn-outline', value: 'schedule_dispatch', icon: Calendar },
  { label: 'No Answer', color: 'btn-secondary', value: 'no_answer', icon: PhoneOff },
  { label: 'Call Later', color: 'btn-outline', value: 'call_later', icon: PhoneCall },
];

export default function OrderConfirmedUnprocessed() {
  const { commerceOrderId } = useParams<{ commerceOrderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vendorStatus, setVendorStatus] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneType, setPhoneType] = useState<'customer' | 'vendor'>('vendor');

  const [showVendorDatePicker, setShowVendorDatePicker] = useState(false);
  const [vendorScheduleDate, setVendorScheduleDate] = useState('');

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusNote, setStatusNote] = useState('');

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const detailRes: any = await commerceApi.getDetail(commerceOrderId!);
      const o = (detailRes as any).data;
      setOrder(o);
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

   const handleVendorOutcome = async (value: string) => {
    if (value === 'accepted') {
      await handleVendorAccepted();
    } else if (value === 'delayed') {
      setShowVendorDatePicker(true);
    } else {
      setVendorStatus(value);
      await updateStatus({ vendorStatus: value, note: `Vendor status updated to ${value}` });
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
      await updateStatus({ vendorStatus: 'rescheduled', note: `Vendor dispatch rescheduled for ${vendorScheduleDate}` });
      toast.success(`Vendor dispatch scheduled for ${vendorScheduleDate}`);
      setShowVendorDatePicker(false);
      setVendorScheduleDate('');
    } catch (err) {
      toast.error('Failed to schedule vendor call');
    } finally {
      setSaving(false);
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
  const vs = vendorStatus || order.vendorStatus || 'unassigned';
  const os = order.orderStatus || order.commerce?.orderStatus || 'Pending';

  const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.price || 0), 0);
  const deliveryCharge = order.deliveryChargeBreakdown?.customerDeliveryCharge || 0;
  const codFee = (order.paymentMethod === 'COD' || order.paymentMethod === 'Cash') ? 10 : 0;
  const computedTotal = subtotal + deliveryCharge + codFee;

  const isVendorAccepted = vs === 'accepted';
  const timeToDelivery = order.timeToDeliveryMs;

  return (
    <div className="space-y-4 pb-20 animate-in">
      <Breadcrumbs items={[
        { label: 'Orders', to: '/orders' },
        { label: 'Confirmed Unprocessed' },
        { label: `#${order.orderId || order.commerceOrderId}` }
      ]} />

      {/* Header */}
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
              <span className="badge-pill bg-amber-500 text-white text-[11px] font-semibold uppercase">
                Confirmed Unprocessed
              </span>
            </div>
            <p className="text-[12px] text-[#737373] mt-0.5 font-medium">
              Created {new Date(order.createdAt || Date.now()).toLocaleDateString()} · Payment: <span className="font-semibold text-[#0a0a0a]">{order.paymentMethod || 'COD'} ({order.paymentStatus || 'Pending'})</span>
              {timeToDelivery != null && (
                <span className="ml-2 text-[#dc3545] font-semibold">Delivered in {Math.floor(timeToDelivery / 86400000)}d {Math.floor((timeToDelivery % 86400000) / 3600000)}h</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {vendorPhone !== 'N/A' && (
            <button
              onClick={() => callPhone(vendorPhone)}
              className="btn-primary text-xs px-3.5 py-1.5 cursor-pointer min-h-[36px]"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Call Vendor</span>
            </button>
          )}
          {customerPhone !== 'N/A' && (
            <button
              onClick={() => callPhone(customerPhone)}
              className="btn-outline text-xs px-3.5 py-1.5 cursor-pointer min-h-[36px]"
            >
              <User className="w-3.5 h-3.5" />
              <span>Call Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* LEFT: Product Info */}
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

          <div className="space-y-2 max-h-36 overflow-y-auto divide-y divide-[#f5f5f5]">
            {items.map((item: any, idx: number) => {
              const product = item.product || {};
              const title = product.title || product.productName || item.title || item.name || `Item #${idx + 1}`;
              const imageUrl = product.productImages?.[0]?.url || item.image || item.imageUrl;
              const price = item.price || 0;
              const qty = item.quantity || 1;
              return (
                <div key={idx} className="pt-2 first:pt-0 flex items-center gap-2.5 text-xs">
                  {imageUrl ? (
                    <img src={imageUrl} alt={title} className="w-10 h-10 object-cover rounded-xl border border-[#e5e5e5] shrink-0 bg-[#fafafa]" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-[#737373]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs text-[#0a0a0a] truncate">{title}</p>
                    <p className="text-[11px] text-[#737373] mt-0.5">Qty: {qty} × Rs. {price.toLocaleString()}</p>
                  </div>
                  <span className="font-bold text-xs text-[#0a0a0a] shrink-0">Rs. {(qty * price).toLocaleString()}</span>
                </div>
              );
            })}
          </div>

          <div className="bg-[#fafafa] p-2.5 rounded-2xl border border-[#e5e5e5] space-y-1 text-[11px]">
            <div className="flex justify-between text-[#737373]"><span>Subtotal:</span><span className="font-medium text-[#0a0a0a]">Rs. {subtotal.toLocaleString()}</span></div>
            {deliveryCharge > 0 && <div className="flex justify-between text-[#737373]"><span>Delivery Charge:</span><span className="font-medium text-[#0a0a0a]">Rs. {deliveryCharge.toLocaleString()}</span></div>}
            {codFee > 0 && <div className="flex justify-between text-[#737373]"><span>COD Handling:</span><span className="font-medium text-[#0a0a0a]">Rs. {codFee.toLocaleString()}</span></div>}
            <div className="flex justify-between text-xs font-bold text-[#0a0a0a] pt-1 border-t border-[#e5e5e5]"><span>Total:</span><span className="text-[#dc3545]">Rs. {(order.totalAmount || computedTotal).toLocaleString()}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[#fafafa] p-2 rounded-xl border border-[#e5e5e5]">
              <div className="flex justify-between items-center text-[10px] text-[#737373] uppercase font-bold"><span>Customer</span><button onClick={() => { setNewPhone(customerPhone); setPhoneType('customer'); setShowPhoneEdit(true); }} className="text-[#dc3545] hover:underline cursor-pointer">Edit</button></div>
              <p className="font-semibold text-[#0a0a0a] truncate">{customerName}</p>
              <p className="text-[#737373] truncate">{customerPhone}</p>
            </div>
            <div className="bg-[#fafafa] p-2 rounded-xl border border-[#e5e5e5]">
              <div className="flex justify-between items-center text-[10px] text-[#737373] uppercase font-bold"><span>Vendor</span><button onClick={() => { setNewPhone(vendorPhone); setPhoneType('vendor'); setShowPhoneEdit(true); }} className="text-[#dc3545] hover:underline cursor-pointer">Edit</button></div>
              <p className="font-semibold text-[#0a0a0a] truncate">{vendorName}</p>
              <p className="text-[#737373] truncate">{vendorPhone}</p>
            </div>
          </div>
        </div>

        {/* RIGHT: Vendor Call Module */}
        <div className="lg:col-span-7 card-blueprint p-4 space-y-3 bg-[#ffffff]">
          <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
              <Store className="w-4 h-4 text-amber-600" />
              Vendor Confirmation Module
            </h2>
            <span className="badge-pill bg-amber-500 text-white font-medium text-[10px]">
              {isVendorAccepted ? '✓ Accepted' : 'Pending Vendor Call'}
            </span>
          </div>

          <p className="text-xs text-[#737373]">
            Customer has confirmed the order. Call the vendor to accept and arrange dispatch.
          </p>

          <div className="p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0a0a0a] flex items-center gap-1.5">
                <Store className="w-4 h-4 text-amber-600" />
                Vendor Status: {vs}
              </span>
            </div>

            {!isVendorAccepted ? (
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
            ) : (
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
            )}
          </div>

          {/* Status Recording Module (visible when vendor accepted) */}
          {isVendorAccepted && (
            <div className="pt-3 border-t border-[#e5e5e5]">
              <h3 className="text-xs font-bold text-[#737373] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Status Recording
              </h3>
              <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-3 space-y-2 text-xs">
                <p className="text-[#0a0a0a] font-medium">Why is this order still unprocessed after vendor accepted?</p>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Enter reason for delay (e.g., waiting for stock, pending dispatch schedule)..."
                  rows={2}
                  className="input-blueprint w-full text-xs resize-none"
                />
                <button
                  onClick={async () => {
                    if (!statusNote.trim()) return;
                    await updateStatus({ note: statusNote });
                    toast.success('Status recorded');
                    setStatusNote('');
                    setShowStatusModal(false);
                  }}
                  disabled={saving || !statusNote.trim()}
                  className="btn-primary text-xs px-4 py-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Save Status</span>
                </button>
              </div>
            </div>
          )}
          {order.externalStatusHistory && order.externalStatusHistory.length > 0 && (
            <div className="pt-3 border-t border-[#e5e5e5]">
              <h3 className="text-xs font-bold text-[#737373] uppercase tracking-wider mb-2">Logistics Timeline</h3>
              <LogisticsTimeline
                events={order.externalStatusHistory}
                externalLogisticsOrderId={order.externalLogisticsOrderId || order.externalNonHeavyLogisticsId}
              />
            </div>
          )}
        </div>
      </div>

      {/* Notes Section */}
      <div className="card-blueprint p-4 space-y-3 bg-[#ffffff]">
        <h3 className="text-xs font-bold text-[#0a0a0a] flex items-center gap-2 uppercase tracking-wider border-b border-[#e5e5e5] pb-2">
          <FileText className="w-3.5 h-3.5 text-[#dc3545]" />
          Order Notes & Audit Log
        </h3>
        <form onSubmit={handleAddNote} className="flex gap-2">
          <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Type note or call summary..." className="input-blueprint flex-1 text-xs" />
          <button type="submit" disabled={noteSaving || !noteText.trim()} className="btn-primary text-xs px-4 py-1.5 cursor-pointer disabled:opacity-50 min-h-[36px]">
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
                <p className="text-[10px] text-[#737373]">{n.actorName || n.actor || 'System'} · {new Date(n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Vendor Schedule Modal */}
      {showVendorDatePicker && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in-fast" onClick={() => { setShowVendorDatePicker(false); setVendorScheduleDate(''); }}>
          <div className="bg-[#ffffff] card-blueprint p-6 max-w-sm w-full space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#0a0a0a]">Schedule Vendor Dispatch</h3>
              <button onClick={() => { setShowVendorDatePicker(false); setVendorScheduleDate(''); }} className="p-1 rounded-xl hover:bg-[#f5f5f5] cursor-pointer"><X className="w-4 h-4 text-[#737373]" /></button>
            </div>
            <input type="date" value={vendorScheduleDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setVendorScheduleDate(e.target.value)} className="input-blueprint w-full text-xs" />
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => { setShowVendorDatePicker(false); setVendorScheduleDate(''); }} className="btn-secondary text-xs px-3 py-1.5 cursor-pointer">Cancel</button>
              <button onClick={handleVendorScheduleConfirm} disabled={saving || !vendorScheduleDate} className="btn-primary text-xs px-4 py-1.5 cursor-pointer disabled:opacity-50">{saving ? 'Scheduling...' : 'Schedule Dispatch'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Phone Edit Modal */}
      {showPhoneEdit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in-fast" onClick={() => setShowPhoneEdit(false)}>
          <div className="bg-[#ffffff] card-blueprint p-6 max-w-sm w-full space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#0a0a0a]">Update {phoneType === 'customer' ? 'Customer' : 'Vendor'} Phone</h3>
              <button onClick={() => setShowPhoneEdit(false)} className="p-1 rounded-xl hover:bg-[#f5f5f5] cursor-pointer"><X className="w-4 h-4 text-[#737373]" /></button>
            </div>
            <input type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Enter phone number..." className="input-blueprint w-full text-xs" />
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setShowPhoneEdit(false)} className="btn-secondary text-xs px-3 py-1.5 cursor-pointer">Cancel</button>
              <button onClick={handleSavePhone} className="btn-primary text-xs px-4 py-1.5 cursor-pointer">Save Phone</button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Mobile Action Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-2.5 bg-[#ffffff]/95 backdrop-blur-md border-t border-[#e5e5e5] flex items-center justify-around gap-2 z-40 shadow-lg">
        {vendorPhone !== 'N/A' && (
          <button onClick={() => callPhone(vendorPhone)} className="btn-primary text-xs flex-1 py-2.5 font-bold justify-center min-h-[44px]">
            <Store className="w-3.5 h-3.5" />
            <span>Call Vendor</span>
          </button>
        )}
        {customerPhone !== 'N/A' && (
          <button onClick={() => callPhone(customerPhone)} className="btn-outline text-xs flex-1 py-2.5 justify-center min-h-[44px]">
            <User className="w-3.5 h-3.5" />
            <span>Call Customer</span>
          </button>
        )}
      </div>
    </div>
  );
}