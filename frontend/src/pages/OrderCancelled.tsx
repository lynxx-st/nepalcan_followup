import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { commerceApi, noteApi } from '../services/api';
import { entityName } from '../utils/order';
import Breadcrumbs from '../components/Breadcrumbs';
import {
  PhoneCall, CheckCircle2, XCircle, PhoneOff, User, ArrowLeft,
  X, FileText, Send, ShoppingBag, Package, RotateCcw, Ban,
} from 'lucide-react';

const callPhone = (phone: string) => { window.location.href = `tel:${phone}`; };

const customerOutcomes = [
  { label: 'Order Recovered', value: 'recovered', icon: CheckCircle2, cls: 'btn-primary' },
  { label: 'Confirm Cancellation', value: 'lost', icon: XCircle, cls: 'btn-secondary text-red-600' },
  { label: 'No Answer', value: 'no_answer', icon: PhoneOff, cls: 'btn-outline' },
  { label: 'Call Later', value: 'call_later', icon: PhoneCall, cls: 'btn-outline' },
];

export default function OrderCancelled() {
  const { commerceOrderId } = useParams<{ commerceOrderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [newPhone, setNewPhone] = useState('');

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const detailRes: any = await commerceApi.getDetail(commerceOrderId!);
      setOrder((detailRes as any).data);
    } catch (err) {
      console.error('Failed to load order detail', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaign = async () => {
    try {
      const res: any = await commerceApi.getOrders({ segment: 'cancelled', limit: 1, search: commerceOrderId });
      const found = (res?.data?.orders || []).find((o: any) => o.commerceOrderId === commerceOrderId);
      if (found?.recoveryCampaign) setCampaign(found.recoveryCampaign);
    } catch { /* campaign is optional context */ }
  };

  useEffect(() => {
    if (commerceOrderId) { fetchDetail(); fetchCampaign(); }
  }, [commerceOrderId]);

  useEffect(() => {
    if (!commerceOrderId) return;
    const onUpdate = () => { fetchDetail(); fetchCampaign(); };
    window.addEventListener('orders-updated', onUpdate);
    return () => window.removeEventListener('orders-updated', onUpdate);
  }, [commerceOrderId]);

  const handleCustomerOutcome = async (value: string) => {
    setSaving(true);
    try {
      if (value === 'recovered') {
        // Restore order to Pending so it re-enters the normal workflow;
        // backend records the recovery campaign with recoveredBy = current user.
        await commerceApi.updateStatus(commerceOrderId!, {
          orderStatus: 'Pending',
          note: 'Order recovered via customer call — cancellation reversed',
        });
        toast.success('Order recovered — moved back to Pending');
      } else if (value === 'lost') {
        await commerceApi.updateStatus(commerceOrderId!, {
          note: 'Customer confirmed cancellation via call',
        });
        toast.success('Cancellation confirmed');
      } else {
        await commerceApi.updateStatus(commerceOrderId!, {
          note: `Recovery call outcome: ${value}`,
        });
        toast.success('Call outcome logged');
      }
      await fetchDetail();
    } catch (err) {
      console.error('Failed to update status', err);
      toast.error('Failed to save outcome');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkUnrecoverable = async () => {
    setSaving(true);
    try {
      await commerceApi.updateStatus(commerceOrderId!, {
        unrecoverable: true,
        note: 'Marked as unrecoverable — no further recovery attempts',
      });
      toast.success('Order marked unrecoverable');
      await fetchDetail();
      await fetchCampaign();
    } catch (err) {
      console.error('Failed to mark unrecoverable', err);
      toast.error('Failed to save status');
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
      await commerceApi.updatePhone(commerceOrderId, newPhone.trim(), 'customer');
      toast.success('Customer phone updated');
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
        <button onClick={() => navigate('/orders')} className="btn-primary text-xs cursor-pointer">Return to Orders</button>
      </div>
    );
  }

  const customerName = entityName(order.customer?.name) || 'Customer';
  const customerPhone = order.customerPhone || order.customer?.phone || 'N/A';
  const items = order.items || order.commerce?.items || [];
  const notes = order.notes || [];
  const cancelReason = order.commerce?.cancelledReason || order.cancelledReason || 'Not specified';
  const cancelledBy = order.commerce?.cancelledBy || order.cancelledBy || '';

  const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.price || 0), 0);
  const deliveryCharge = order.deliveryChargeBreakdown?.customerDeliveryCharge || 0;
  const codFee = (order.paymentMethod === 'COD' || order.paymentMethod === 'Cash') ? 10 : 0;
  const computedTotal = subtotal + deliveryCharge + codFee;

  return (
    <div className="space-y-4 pb-20 animate-in">
      <Breadcrumbs items={[
        { label: 'Orders', to: '/orders' },
        { label: 'Cancelled Orders' },
        { label: `#${order.orderId || order.commerceOrderId}` }
      ]} />

      {/* Header */}
      <div className="card-blueprint p-4 flex flex-wrap items-center justify-between gap-3 bg-[#ffffff]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/orders')} className="p-2 rounded-2xl bg-[#f5f5f5] border border-[#e5e5e5] hover:bg-[#fff5f5] transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4 text-[#0a0a0a]" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#0a0a0a] tracking-tight">Order #{order.orderId || order.commerceOrderId}</h1>
              <span className={`badge-pill text-[11px] font-semibold uppercase ${order.unrecoverable ? 'bg-[#737373] text-white border border-[#737373]' : 'bg-[#e7000b] text-white'}`}>
                {order.unrecoverable ? 'Unrecoverable' : 'Cancelled'}
              </span>
            </div>
            <p className="text-[12px] text-[#737373] mt-0.5 font-medium">
              Created {new Date(order.createdAt || Date.now()).toLocaleDateString()} · Payment: <span className="font-semibold text-[#0a0a0a]">{order.paymentMethod || 'COD'} ({order.paymentStatus || 'Pending'})</span>
            </p>
          </div>
        </div>

        {customerPhone !== 'N/A' && (
          <button onClick={() => callPhone(customerPhone)} className="btn-primary text-xs px-3.5 py-1.5 cursor-pointer min-h-[44px]">
            <User className="w-3.5 h-3.5" />
            <span>Call Customer</span>
          </button>
        )}
      </div>

      {/* Cancellation Info */}
      <div className="card-blueprint p-4 bg-[#ffffff] border-l-4 border-l-[#e7000b]">
        <div className="flex items-start gap-2 text-xs">
          <XCircle className="w-4 h-4 text-[#e7000b] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#0a0a0a]">Cancellation Reason: {cancelReason}</p>
            {cancelledBy && <p className="text-[#737373] mt-0.5">Cancelled by: {cancelledBy}</p>}
            {campaign?.recoveredBy && (
              <p className="text-emerald-700 font-semibold mt-0.5">Recovered by: {campaign.recoveredBy}</p>
            )}
          </div>
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
            <span className="text-xs font-bold text-[#dc3545]">Total: Rs. {(order.totalAmount || computedTotal).toLocaleString()}</span>
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
                    <div className="w-10 h-10 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] flex items-center justify-center shrink-0"><Package className="w-4 h-4 text-[#737373]" /></div>
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

          <div className="bg-[#fafafa] p-2 rounded-xl border border-[#e5e5e5] text-[11px]">
            <div className="flex justify-between items-center text-[10px] text-[#737373] uppercase font-bold"><span>Customer</span><button onClick={() => { setNewPhone(customerPhone); setShowPhoneEdit(true); }} className="text-[#dc3545] hover:underline cursor-pointer">Edit</button></div>
            <p className="font-semibold text-[#0a0a0a] truncate">{customerName}</p>
            <p className="text-[#737373] truncate">{customerPhone}</p>
          </div>
        </div>

        {/* RIGHT: Customer Call Module (recovery) */}
        <div className="lg:col-span-7 card-blueprint p-4 space-y-3 bg-[#ffffff]">
          <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-[#e7000b]" />
              Customer Recovery Call Module
            </h2>
            <span className="badge-pill bg-[#e7000b] text-white font-medium text-[10px]">Recovery</span>
          </div>

          <p className="text-xs text-[#737373]">
            Call the customer to understand the cancellation and attempt recovery. Log the outcome after the call:
          </p>

          <div className="p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0a0a0a] flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#e7000b]" />
                Customer: {customerName}
              </span>
              {customerPhone !== 'N/A' && (
                <button onClick={() => callPhone(customerPhone)} className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]">
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Now</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {customerOutcomes.map((out) => {
                const Icon = out.icon;
                return (
                  <button
                    key={out.value}
                    onClick={() => handleCustomerOutcome(out.value)}
                    disabled={saving}
                    className={`${out.cls} text-xs font-medium px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 min-h-[44px]`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{out.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#e5e5e5]">
              {order.unrecoverable ? (
                <p className="text-[11px] text-[#737373] bg-[#f5f5f5] border border-[#e5e5e5] rounded-xl p-2">
                  This order is marked <span className="font-bold text-[#0a0a0a]">unrecoverable</span>. No further recovery attempts will be made.
                </p>
              ) : (
                <button
                  onClick={handleMarkUnrecoverable}
                  disabled={saving}
                  className="btn-outline text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 min-h-[44px] text-[#737373] hover:bg-[#f5f5f5]"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Mark Unrecoverable</span>
                </button>
              )}
            </div>
          </div>
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
          <button type="submit" disabled={noteSaving || !noteText.trim()} className="btn-primary text-xs px-4 py-1.5 cursor-pointer disabled:opacity-50 min-h-[44px]">
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

      {/* Phone Edit Modal */}
      {showPhoneEdit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in-fast" onClick={() => setShowPhoneEdit(false)}>
          <div className="bg-[#ffffff] card-blueprint p-6 max-w-sm w-full space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#0a0a0a]">Update Customer Phone</h3>
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
        {customerPhone !== 'N/A' && (
          <button onClick={() => callPhone(customerPhone)} className="btn-primary text-xs flex-1 py-2.5 font-bold justify-center min-h-[44px]">
            <User className="w-3.5 h-3.5" />
            <span>Call Customer</span>
          </button>
        )}
      </div>
    </div>
  );
}
