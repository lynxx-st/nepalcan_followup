import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { commerceApi } from '../services/api';
import Breadcrumbs from '../components/Breadcrumbs';
import { Search, Quote, Eye } from 'lucide-react';

const PAGE_SIZE = 10;

export default function Reviews() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchReviews = async (p: number, q: string) => {
    try {
      setLoading(true);
      const data: any = await commerceApi.getReviews({
        limit: PAGE_SIZE,
        page: p,
        search: q || undefined,
      });
      setReviews(data.data?.reviews || []);
      setTotal(data.data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch reviews', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(page, searchQuery);
  }, [page, searchQuery]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Customer Reviews' }]} />

      {/* Header Card */}
      <div className="card-blueprint p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0a0a0a]">Customer Reviews & Feedback</h1>
            <span className="badge-pill badge-pill-solid text-[10px] uppercase">
              {total} Reviews
            </span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            Post-delivery customer feedback and NPS review entries collected during follow-up calls.
          </p>
        </div>
      </div>

      {/* Search Container */}
      <div className="card-blueprint p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search order #, customer name, phone..."
            className="input-blueprint w-full pl-9 pr-3 py-2 text-xs"
          />
        </div>
      </div>

      {/* Reviews Content */}
      {loading ? (
        <div className="text-center py-12 text-xs text-[#737373] animate-pulse">
          Loading customer reviews...
        </div>
      ) : reviews.length === 0 ? (
        <div className="card-blueprint p-12 text-center space-y-2">
          <Quote className="w-8 h-8 text-[#737373] mx-auto" />
          <h3 className="font-semibold text-sm text-[#0a0a0a]">No Reviews Recorded</h3>
          <p className="text-xs text-[#737373]">Reviews appear here once customer review notes are logged on completed orders.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const reviewObj = typeof r.review === 'object' && r.review ? r.review : { text: String(r.review || '') };

            return (
              <div
                key={r.commerceOrderId}
                onClick={() => navigate(`/orders/${r.commerceOrderId}`)}
                className="card-blueprint p-5 hover:border-[#0a0a0a] transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#0a0a0a]">
                        #{r.orderNumber || r.orderId || r.commerceOrderId}
                      </span>
                      <span className="badge-pill badge-pill-soft text-[10px]">
                        Verified Order
                      </span>
                    </div>
                    <p className="font-bold text-[#0a0a0a] text-sm mt-1">{r.customerName || 'Customer'}</p>
                    {r.customerPhone && <p className="text-xs text-[#737373]">Phone: {r.customerPhone}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#737373]">
                      {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : ''}
                    </span>
                    <span className="btn-outline text-xs px-2.5 py-1">
                      <Eye className="w-3.5 h-3.5" /> View Order
                    </span>
                  </div>
                </div>

                <div className="space-y-2 bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-4">
                  <p className="text-xs text-[#0a0a0a] italic">
                    &ldquo;{reviewObj.text}&rdquo;
                  </p>

                  {reviewObj.platformSatisfied && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-2 border-t border-[#e5e5e5]">
                      <div className="p-2 bg-white rounded-xl border border-[#e5e5e5]">
                        <span className="text-[#737373] block">Platform Satisfied:</span>
                        <span className="font-bold text-[#0a0a0a] uppercase">{reviewObj.platformSatisfied}</span>
                        {reviewObj.platformSatisfiedOther && (
                          <p className="text-[10px] text-[#737373] mt-0.5">{reviewObj.platformSatisfiedOther}</p>
                        )}
                      </div>

                      <div className="p-2 bg-white rounded-xl border border-[#e5e5e5]">
                        <span className="text-[#737373] block">Delivery Satisfied:</span>
                        <span className="font-bold text-[#0a0a0a] uppercase">{reviewObj.deliverySatisfied}</span>
                        {reviewObj.deliverySatisfiedOther && (
                          <p className="text-[10px] text-[#737373] mt-0.5">{reviewObj.deliverySatisfiedOther}</p>
                        )}
                      </div>

                      <div className="p-2 bg-white rounded-xl border border-[#e5e5e5]">
                        <span className="text-[#737373] block">Will Use Again:</span>
                        <span className="font-bold text-[#0a0a0a] uppercase">{reviewObj.willUseAgain}</span>
                        {reviewObj.willUseAgainOther && (
                          <p className="text-[10px] text-[#737373] mt-0.5">{reviewObj.willUseAgainOther}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[#e5e5e5]">
          <p className="text-xs text-[#737373]">Page {page} of {totalPages} ({total} reviews)</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-outline text-xs px-3 py-1.5 disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-outline text-xs px-3 py-1.5 disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}