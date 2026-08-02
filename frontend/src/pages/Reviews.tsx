import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { commerceApi } from '../services/api';
import { Star, Search, Quote } from 'lucide-react';

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
    <div className="space-y-6 pb-12 animate-in">
      <div className="bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-600 text-white rounded-2xl p-6 border border-amber-400 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
            <Star className="w-6 h-6 fill-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Customer Reviews</h1>
            <p className="text-sm text-amber-100 mt-1">Reviews recorded against orders.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search order #, customer, phone..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 font-bold">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-2">
          <Quote className="w-10 h-10 text-amber-400 mx-auto" />
          <p className="font-bold text-slate-700">No reviews yet</p>
          <p className="text-xs">Reviews appear here once a customer review is recorded on an order.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.commerceOrderId}
              onClick={() => navigate(`/orders/${r.commerceOrderId}`)}
              className="bg-white rounded-2xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all p-4 cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 font-mono">
                      #{r.orderNumber || r.commerceOrderId}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{r.customerName || '-'}</p>
                    {r.customerPhone && <p className="text-xs text-slate-500 font-mono">{r.customerPhone}</p>}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : ''}
                </span>
              </div>
              <p className="text-sm text-slate-700 italic bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 mt-3">
                &ldquo;{r.review}&rdquo;
              </p>
            </div>
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 text-slate-600 hover:border-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
            ←
          </button>
          <span className="px-2 text-xs font-bold text-slate-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 text-slate-600 hover:border-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
            →
          </button>
        </div>
      )}
    </div>
  );
}
