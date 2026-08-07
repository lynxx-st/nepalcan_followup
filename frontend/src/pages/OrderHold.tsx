import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { commerceApi, noteApi } from '../services/api';
import { entityName } from '../utils/order';
import Breadcrumbs from '../components/Breadcrumbs';
import {
  PhoneCall, PhoneOff, User, Store, ArrowLeft, PauseCircle,
  X, FileText, Send, ShoppingBag, Package, CheckCircle2,
} from 'lucide-react';

const callPhone = (phone: string) => { window.location.href = `tel:${phone}`; };

export default function OrderHold() {
  const { commerceOrderId } = useParams<{ commerceOrderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneType, setPhoneType] = useState<'customer' | 'vendor'>('customer');

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

  useEffect(() => {
    if (commerceOrderId) fetchDetail();
  }, [commerceOrderId]);

  useEffect(() => {
    if (!commerceOrderId) return;
    const onUpdate = () => { fetchDetail(); };
    window.addEventListener('orders-updated', onUpdate);
    return () => window.removeEventListener('orders-updated', onUpdate);
  }, [commerceOrderId]);

  const handleResume = async () => {
    setSaving(true);
    try {
      await commerceApi.updateStatus(commerceOrderId!, {
        orderStatus: 'Pending',
        note: 'Hold released — order resumed to Pending',
      });
      toast.success('Order resumed — moved back to Pending');
      await fetchDetail();
    } catch (err) {
      console.error('Failed to resume order', err);
      toast.error('Failed to resume order');
    } finally {
      setSaving(false);
    }
  };

  const handleLogCall = async (outcome: string) => {
    setSaving(true);
    try {
      await commerceApi.updateStatus(commerceOrderId!, { note: `Hold follow-up call: ${outcome}` });
      toast.success('Call outcome logged');
      await fetchDetail();
    } catch {
      toast.error('Failed to log outcome');
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
        <button onClick={() => navigate('/orders')} className="btn-primary text-xs cursor-pointer">Return to Orders</button>
      </div>
    );
  }

  const customerName = entityName(order.customer?.name) || 'Customer';
  const customerPhone = order.customerPhone || order.customer?.phone || 'N/A';
  const vendorName = entityName(order.vendor?.name) || order.vendorName || 'Vendor';
  const vendorPhone = order.vendorPhone || order.vendor?.phone || 'N/A';
  const items = order.items || order.commerce?.items || [];
  const notes = order.notes || [];

  const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.price || 0), 0);
  const deliveryCharge = order.deliveryChargeBreakdown?.customerDeliveryCharge || 0;
  const codFee = (order.paymentMethod === 'COD' || order.paymentMethod === 'Cash') ? 10 : 0;
  const computedTotal = subtotal + deliveryCharge + codFee;

  return (
    <div className="space-y-4 pb-20 animate-in">
      <Breadcrumbs items={[
        { label: 'Orders', to: '/orders' },
        { label: 'Hold Orders' },
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
              <span className="badge-pill bg-amber-500 text-white text-[11px] font-semibold uppercase">On Hold</span>
            </div>
            <p className="text-[12px] text-[#737373] mt-0.5 font-medium">
              Created {new Date(order.createdAt || Date.now()).toLocaleDateString()} · Payment: <span className="font-semibold text-[#0a0a0a]">{order.paymentMethod || 'COD'} ({order.paymentStatus || 'Pending'})</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {customerPhone !== 'N/A' && (
            <button onClick={() => callPhone(customerPhone)} className="btn-outline text-xs px-3.5 py-1.5 cursor-pointer min-h-[44px]">
              <User className="w-3.5 h-3.5" />
              <span>Call Customer</span>
            </button>
          )}
          {vendorPhone !== 'N/A' && (
            <button onClick={() => callPhone(vendorPhone)} className="btn-primary text-xs px-3.5 py-1.5 cursor-pointer min-h-[44px]">
              <Store className="w-3.5 h-3.5" />
              <span>Call Vendor</span>
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

        {/* RIGHT: Hold Follow-up Module */}
        <div className="lg:col-span-7 card-blueprint p-4 space-y-3 bg-[#ffffff]">
          <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
              <PauseCircle className="w-4 h-4 text-amber-600" />
              Hold Follow-up Module
            </h2>
            <span className="badge-pill bg-amber-500 text-white font-medium text-[10px]">Paused</span>
          </div>

          <p className="text-xs text-[#737373]">
            This order is on hold. Follow up with the customer to resolve the hold reason, then resume the order:
          </p>

          <div className="p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {customerPhone !== 'N/A' && (
                <button onClick={() => callPhone(customerPhone)} className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]">
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Customer</span>
                </button>
              )}
              <button onClick={() => handleLogCall('no_answer')} disabled={saving} className="btn-outline text-xs px-3 py-1.5 cursor-pointer flex items-center gap-1 min-h-[44px]">
                <PhoneOff className="w-3.5 h-3.5" />
                <span>No Answer</span>
              </button>
              <button onClick={() => handleLogCall('call_later')} disabled={saving} className="btn-outline text-xs px-3 py-1.5 cursor-pointer flex items-center gap-1 min-h-[44px]">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Later</span>
              </button>
            </div>

            <div className="pt-2 border-t border-[#e5e5e5]">
              <button onClick={handleResume} disabled={saving} className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px] disabled:opacity-50">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{saving ? 'Resuming...' : 'Release Hold & Resume Order'}</span>
              </button>
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
        {customerPhone !== 'N/A' && (
          <button onClick={() => callPhone(customerPhone)} className="btn-primary text-xs flex-1 py-2.5 font-bold justify-center min-h-[44px]">
            <User className="w-3.5 h-3.5" />
            <span>Call Customer</span>
          </button>
        )}
        {vendorPhone !== 'N/A' && (
          <button onClick={() => callPhone(vendorPhone)} className="btn-outline text-xs flex-1 py-2.5 justify-center min-h-[44px]">
            <Store className="w-3.5 h-3.5" />
            <span>Call Vendor</span>
          </button>
        )}
      </div>
    </div>
  );
}
