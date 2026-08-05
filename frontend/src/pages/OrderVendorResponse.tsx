import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { commerceApi, noteApi } from '../services/api';
import { entityName } from '../utils/order';
import Breadcrumbs from '../components/Breadcrumbs';
import {
  PhoneCall, CheckCircle2, XCircle, ArrowLeft,
  X, Edit2, FileText, Send, ShoppingBag, Package,
  RotateCcw, ImageIcon, Store,
} from 'lucide-react';

const callPhone = (phone: string) => { window.location.href = `tel:${phone}`; };

export default function OrderVendorResponse() {
  const { commerceOrderId } = useParams<{ commerceOrderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneType, setPhoneType] = useState<'customer' | 'vendor'>('vendor');

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

  const updateStatus = async (data: Record<string, any>) => {
    setSaving(true);
    try {
      await commerceApi.updateStatus(commerceOrderId!, data);
      toast.success('Return status updated');
      await fetchDetail();
    } catch (err) {
      console.error('Failed to update status', err);
      toast.error('Failed to update return status');
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-[#dc3545] font-semibold text-xs animate-pulse">
        Loading return request...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="card-blueprint p-6 text-center space-y-3">
        <h2 className="text-sm font-bold text-[#0a0a0a]">Return Not Found</h2>
        <p className="text-xs text-[#737373]">The return request could not be retrieved.</p>
        <button onClick={() => navigate('/returns')} className="btn-primary text-xs cursor-pointer">Return to Returns</button>
      </div>
    );
  }

  const customerName = entityName(order.customer?.name) || 'Customer';
  const customerPhone = order.customerPhone || order.customer?.phone || 'N/A';
  const vendorName = entityName(order.vendor?.name) || order.vendorName || 'Vendor';
  const vendorPhone = order.vendorPhone || order.vendor?.phone || 'N/A';
  const items = order.items || order.commerce?.items || [];
  const notes = order.notes || [];
  const returnReason = order.returnReason || 'No reason provided';
  const attachments = order.attachments || [];
  const orderInfo = order.order || {};

  return (
    <div className="space-y-4 pb-20 animate-in">
      <Breadcrumbs items={[
        { label: 'Returns', to: '/returns' },
        { label: 'Vendor Response' },
        { label: `#${order.orderId || orderInfo.orderId || commerceOrderId}` }
      ]} />

      {/* Header */}
      <div className="card-blueprint p-4 flex flex-wrap items-center justify-between gap-3 bg-[#ffffff]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/returns')} className="p-2 rounded-2xl bg-[#f5f5f5] border border-[#e5e5e5] hover:bg-[#fff5f5] transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4 text-[#0a0a0a]" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#0a0a0a] tracking-tight">
                Return #{order.orderId || orderInfo.orderId || commerceOrderId}
              </h1>
              <span className="badge-pill bg-amber-500 text-white text-[11px] font-semibold uppercase">Vendor Response</span>
            </div>
            <p className="text-[12px] text-[#737373] mt-0.5 font-medium">
              Step 2 of 2 — Obtain vendor approval & dispatch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {vendorPhone !== 'N/A' && (
            <button onClick={() => callPhone(vendorPhone)} className="btn-primary text-xs px-3.5 py-1.5 cursor-pointer min-h-[36px]">
              <Store className="w-3.5 h-3.5" />
              <span>Call Vendor</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* LEFT: Return Details */}
        <div className="lg:col-span-5 card-blueprint p-4 space-y-3 bg-[#ffffff]">
          <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-[#dc3545]" />
              Return Details
            </h2>
            <span className="badge-pill bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
              {order.status || 'Initiated'}
            </span>
          </div>

          {/* Customer Info */}
          <div className="bg-[#fafafa] p-3 rounded-2xl border border-[#e5e5e5] space-y-1.5">
            <p className="text-xs font-bold text-[#0a0a0a]">{customerName}</p>
            <p className="text-xs text-[#737373]">{customerPhone}</p>
            <p className="text-xs text-[#737373]">Vendor: {vendorName}</p>
          </div>

          {/* Return Reason */}
          <div>
            <p className="text-xs font-bold text-[#0a0a0a] mb-1">Return Reason</p>
            <p className="text-xs text-[#0a0a0a] bg-white p-3 rounded-2xl border border-[#e5e5e5]">"{returnReason}"</p>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#737373] mb-1.5 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5" /> Attachments ({attachments.length}):
              </p>
              <div className="flex gap-2 flex-wrap">
                {attachments.map((att: any, idx: number) => (
                  <a key={idx} href={att.url} target="_blank" rel="noreferrer" className="block group">
                    <img src={att.url} alt={att.name || 'attachment'} className="w-16 h-16 object-cover rounded-xl border border-[#e5e5e5] group-hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          {items.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#0a0a0a] mb-1.5">Return Items ({items.length}):</p>
              <div className="space-y-1.5">
                {items.map((it: any, idx: number) => {
                  const prod = it.product || {};
                  return (
                    <div key={idx} className="bg-white p-2 rounded-xl border border-[#e5e5e5] flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#0a0a0a] truncate">{prod.productName || 'Item'}</span>
                      <span className="font-mono text-[#dc3545]">Qty: {it.quantity || 1} × Rs. {it.price || 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Vendor Response Actions */}
        <div className="lg:col-span-7 card-blueprint p-4 space-y-3 bg-[#ffffff]">
          <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
              <Store className="w-4 h-4 text-amber-600" />
              Vendor Response Module
            </h2>
            <span className="badge-pill bg-amber-500 text-white font-medium text-[10px]">Step 2</span>
          </div>

          <p className="text-xs text-[#737373]">
            Contact the vendor to obtain return acceptance and arrange pickup dispatch.
          </p>

          {/* Call Button */}
          <div className="p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl space-y-3">
            {vendorPhone !== 'N/A' && (
              <button onClick={() => callPhone(vendorPhone)} className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 min-h-[44px]">
                <Store className="w-3.5 h-3.5" />
                <span>Call Vendor</span>
              </button>
            )}

            {/* Outcome Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={() => updateStatus({ vendorResponseStatus: 'accepted' })}
                className="btn-outline text-xs px-4 py-2 cursor-pointer text-emerald-800 bg-emerald-50 border-emerald-300 font-bold min-h-[44px]"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Vendor Accepted</span>
              </button>
              <button
                onClick={() => updateStatus({ vendorResponseStatus: 'rejected' })}
                className="btn-secondary text-xs px-4 py-2 cursor-pointer text-red-600 font-bold min-h-[44px]"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Vendor Rejected</span>
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center gap-2 text-[10px] text-[#737373]">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">✓</span>
            <span className="flex-1 h-px bg-[#e5e5e5]"></span>
            <span className="w-6 h-6 rounded-full bg-[#dc3545] text-white flex items-center justify-center font-bold">2</span>
            <span>Vendor Response</span>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="card-blueprint p-4 space-y-3 bg-[#ffffff]">
        <h3 className="text-xs font-bold text-[#0a0a0a] flex items-center gap-2 uppercase tracking-wider border-b border-[#e5e5e5] pb-2">
          <FileText className="w-3.5 h-3.5 text-[#dc3545]" />
          Notes & Audit Log
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
        <button
          onClick={() => updateStatus({ vendorResponseStatus: 'accepted' })}
          className="btn-outline text-xs flex-1 py-2.5 text-emerald-700 border-emerald-300 bg-emerald-50 font-bold justify-center min-h-[44px]"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Accept</span>
        </button>
        <button
          onClick={() => updateStatus({ vendorResponseStatus: 'rejected' })}
          className="btn-secondary text-xs flex-1 py-2.5 text-red-600 font-bold justify-center min-h-[44px]"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Reject</span>
        </button>
      </div>
    </div>
  );
}