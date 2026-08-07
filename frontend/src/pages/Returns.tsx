import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { commerceApi } from '../services/api';
import Breadcrumbs from '../components/Breadcrumbs';
import ImageZoom from '../components/ImageZoom';
import {
  RotateCcw, PhoneCall, Store, CheckCircle2, XCircle, Search,
  Eye, Package, FileText, Image as ImageIcon, Clock, ArrowLeft,
} from 'lucide-react';

const PAGE_SIZE = 10;

export default function Returns() {
  const navigate = useNavigate();
  const [activeStage, setActiveStage] = useState<'customer_response' | 'vendor_response'>('customer_response');
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<{ customer_response: number; vendor_response: number }>({
    customer_response: 0,
    vendor_response: 0,
  });
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fetchReturns = async (p: number, stage: string, q: string) => {
    try {
      setLoading(true);
      const res: any = await commerceApi.getReturns({
        stage,
        page: p,
        limit: PAGE_SIZE,
        search: q || undefined,
      });
      const data = res.data || {};
      setReturns(data.returns || []);
      setTotal(data.total || 0);
      if (data.counts) setCounts(data.counts);
    } catch (err) {
      console.error('Failed to fetch returns', err);
      toast.error('Failed to load return requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns(page, activeStage, searchQuery);
  }, [page, activeStage, searchQuery]);

  const handleUpdateStatus = async (returnId: string, data: Record<string, any>) => {
    try {
      await commerceApi.updateReturnStatus(returnId, data);
      toast.success('Return status updated');
      fetchReturns(page, activeStage, searchQuery);
    } catch {
      toast.error('Failed to update return status');
    }
  };

  const handleSyncReturns = async () => {
    try {
      toast.info('Syncing return requests...');
      await commerceApi.syncReturns();
      toast.success('Returns synced!');
      fetchReturns(page, activeStage, searchQuery);
    } catch {
      toast.error('Failed to sync returns');
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Return & Recovery Engine' }]} />

      {/* Header Container */}
      <div className="card-blueprint p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0a0a0a] tracking-tight">Return Management Engine</h1>
            <span className="badge-pill badge-pill-solid text-[10px] uppercase">
              {total} Requests
            </span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            Flexible follow-up: contact customer or vendor first — statuses can be edited at any step.
          </p>
        </div>

        <button
          onClick={handleSyncReturns}
          className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Sync Returns</span>
        </button>
      </div>

      {/* Workflow Tabs */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setActiveStage('customer_response'); setPage(1); }}
          className={`card-blueprint p-4 text-left transition-all cursor-pointer ${
            activeStage === 'customer_response'
              ? 'border-[#0a0a0a] shadow-xs bg-[#ffffff] ring-1 ring-[#0a0a0a]'
              : 'hover:border-[#737373] bg-[#fafafa]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-[#0a0a0a]">
              <PhoneCall className="w-4 h-4 text-[#dc3545]" />
              1. Customer Response
            </span>
            <span className="badge-pill badge-pill-solid text-[11px] font-bold">
              {counts.customer_response}
            </span>
          </div>
          <p className="text-[11px] text-[#737373] mt-2">
            Call customer to verify return reason, condition & attachments.
          </p>
        </button>

        <button
          onClick={() => { setActiveStage('vendor_response'); setPage(1); }}
          className={`card-blueprint p-4 text-left transition-all cursor-pointer ${
            activeStage === 'vendor_response'
              ? 'border-[#0a0a0a] shadow-xs bg-[#ffffff] ring-1 ring-[#0a0a0a]'
              : 'hover:border-[#737373] bg-[#fafafa]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-[#0a0a0a]">
              <Store className="w-4 h-4 text-amber-600" />
              2. Vendor Response
            </span>
            <span className="badge-pill badge-pill-solid text-[11px] font-bold">
              {counts.vendor_response}
            </span>
          </div>
          <p className="text-[11px] text-[#737373] mt-2">
            Contact vendor for return acceptance & pickup dispatch.
          </p>
        </button>
      </div>

      {/* Main Workspace */}
      <div className="card-blueprint p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search order #, customer, reason..."
              className="input-blueprint w-full pl-9 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-[#737373] animate-pulse">
            Loading return requests...
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-12 bg-[#fafafa] rounded-2xl border border-[#e5e5e5]">
            <CheckCircle2 className="w-8 h-8 text-[#737373] mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-[#0a0a0a]">No Returns in Stage</h3>
            <p className="text-xs text-[#737373] mt-1">No return requests currently in this stage.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {returns.map((ret: any) => {
              const orderInfo = ret.order || {};
              const vendor = orderInfo.vendor || ret.vendor || {};
              const customer = orderInfo.customerProfile || ret.customerProfile || {};
              const items = ret.items || [];
              const attachments = ret.attachments || [];

              return (
                <div
                  key={ret._id}
                  className="bg-[#ffffff] border border-[#e5e5e5] rounded-2xl p-5 space-y-4 shadow-2xs hover:border-[#0a0a0a] transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#f5f5f5] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#0a0a0a]">
                          Order #{ret.orderId || orderInfo.orderId || 'N/A'}
                        </span>
                        <span className="badge-pill bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          Return: {ret.status || 'Initiated'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#0a0a0a] mt-1">
                        Customer: {customer.name || 'N/A'} ({ret.customerPhone || customer.phone || 'No phone'})
                      </p>
                      <p className="text-xs text-[#737373]">
                        Vendor: {vendor.name || 'N/A'}
                      </p>
                      {ret.timeToDeliveryMs != null && (
                        <p className="text-[10px] text-[#dc3545] font-semibold mt-0.5">
                          Delivered in {Math.floor(ret.timeToDeliveryMs / 86400000)}d {Math.floor((ret.timeToDeliveryMs % 86400000) / 3600000)}h
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-[#737373]">
                        Requested: {ret.createdAt ? new Date(ret.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Return Details & Items */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#0a0a0a]">Return Reason:</p>
                      <p className="text-xs text-[#0a0a0a] bg-[#fafafa] p-2.5 rounded-xl border border-[#e5e5e5]">
                        "{ret.returnReason || 'No reason provided'}"
                      </p>

                      {attachments.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-[#737373] mb-1.5 flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5" /> Attachments ({attachments.length}):
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {attachments.map((att: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => setZoomedImage(att.url)}
                                className="block group relative"
                              >
                                <img
                                  src={att.url}
                                  alt={att.name || 'attachment'}
                                  className="w-16 h-16 object-cover rounded-xl border border-[#e5e5e5] group-hover:opacity-80 transition-opacity cursor-pointer"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#0a0a0a]">Return Items ({items.length}):</p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {items.map((it: any, idx: number) => {
                          const prod = it.product || {};
                          return (
                            <div key={idx} className="bg-[#fafafa] p-2 rounded-xl border border-[#e5e5e5] flex items-center justify-between text-xs">
                              <span className="font-semibold text-[#0a0a0a] truncate">{prod.productName || 'Item'}</span>
                              <span className="font-mono text-[#dc3545]">Qty: {it.quantity || 1} × Rs. {it.price || 0}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Follow-up Order Toggle */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#f5f5f5]">
                    <span className="text-[11px] font-bold text-[#737373] uppercase tracking-wider">Follow up:</span>
                    <button
                      onClick={() => ret.followUpOrder !== 'customer_first' && handleUpdateStatus(ret._id, { followUpOrder: 'customer_first' })}
                      className={`text-xs px-3 py-1.5 rounded-xl border cursor-pointer font-semibold min-h-[36px] ${
                        ret.followUpOrder === 'customer_first'
                          ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                          : 'bg-[#f5f5f5] text-[#0a0a0a] border-[#e5e5e5]'
                      }`}
                    >
                      <PhoneCall className="w-3 h-3 inline mr-1" />
                      Customer First
                    </button>
                    <button
                      onClick={() => ret.followUpOrder !== 'vendor_first' && handleUpdateStatus(ret._id, { followUpOrder: 'vendor_first' })}
                      className={`text-xs px-3 py-1.5 rounded-xl border cursor-pointer font-semibold min-h-[36px] ${
                        ret.followUpOrder === 'vendor_first'
                          ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                          : 'bg-[#f5f5f5] text-[#0a0a0a] border-[#e5e5e5]'
                      }`}
                    >
                      <Store className="w-3 h-3 inline mr-1" />
                      Vendor First
                    </button>
                  </div>

                  {/* Current Statuses */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={`px-2.5 py-1 rounded-full font-bold ${ret.customerResponseStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : ret.customerResponseStatus === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-800'}`}>
                      Customer: {ret.customerResponseStatus}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full font-bold ${ret.vendorResponseStatus === 'accepted' ? 'bg-emerald-100 text-emerald-800' : ret.vendorResponseStatus === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-800'}`}>
                      Vendor: {ret.vendorResponseStatus}
                    </span>
                  </div>

                  {/* Customer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#f5f5f5]">
                    <a href={`tel:${ret.customerPhone || customer.phone}`} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 min-h-[44px]">
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Call Customer</span>
                    </a>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateStatus(ret._id, { customerResponseStatus: 'rejected' })}
                        className="btn-secondary text-xs px-4 py-2 font-bold text-red-600 min-h-[44px]"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject Return</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(ret._id, { customerResponseStatus: 'confirmed' })}
                        className="btn-primary text-xs px-4 py-2 font-bold min-h-[44px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm</span>
                      </button>
                    </div>
                  </div>

                  {/* Vendor Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#f5f5f5]">
                    <a href={`tel:${vendor.phone}`} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 min-h-[44px]">
                      <Store className="w-3.5 h-3.5" />
                      <span>Call Vendor</span>
                    </a>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateStatus(ret._id, { vendorResponseStatus: 'rejected' })}
                        className="btn-secondary text-xs px-4 py-2 font-bold text-red-600 min-h-[44px]"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Vendor Rejected</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(ret._id, { vendorResponseStatus: 'accepted' })}
                        className="btn-primary text-xs px-4 py-2 font-bold min-h-[44px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Vendor Accepted</span>
                      </button>
                    </div>
                  </div>

                  {/* Return History */}
                  {(ret.returnHistory?.length > 0) && (
                    <details className="pt-1 text-xs">
                      <summary className="text-[11px] font-bold text-[#737373] cursor-pointer uppercase tracking-wider">
                        History ({ret.returnHistory.length})
                      </summary>
                      <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                        {ret.returnHistory.map((h: any, idx: number) => (
                          <div key={idx} className="bg-[#fafafa] border border-[#e5e5e5] p-2 rounded-xl text-[11px]">
                            <p className="font-semibold text-[#0a0a0a]">
                              {h.field}: {h.from || '—'} → {h.to}
                            </p>
                            <p className="text-[#737373] mt-0.5">
                              {h.actorName || 'staff'} · {h.changedAt ? new Date(h.changedAt).toLocaleString() : ''}
                              {h.note ? ` · "${h.note}"` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4 border-t border-[#e5e5e5]">
            <p className="text-xs text-[#737373]">
              Page {page} of {Math.ceil(total / PAGE_SIZE)} ({total} requests)
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

      {/* Image Zoom Lightbox */}
      {zoomedImage && (
        <ImageZoom src={zoomedImage} onClose={() => setZoomedImage(null)} />
      )}
    </div>
  );
}