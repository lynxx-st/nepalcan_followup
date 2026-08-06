import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { taskApi } from '../services/api';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import SLACountdown from '../components/SLACountdown';
import Breadcrumbs from '../components/Breadcrumbs';
import {
  Zap, CheckCircle2, PhoneCall, Phone, MessageSquare,
  ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown, Eye,
  SkipForward, XCircle, Check, RotateCcw, List, GripVertical,
  Clock, MapPin, Tag, DollarSign,
} from 'lucide-react';

type SortKey = 'priority' | 'dueAt' | 'score' | 'type' | 'customerName';
type SortDir = 'asc' | 'desc';

function priorityWeight(p: string) {
  switch (p) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

function SwipeCard({ task, onComplete, onSkip, onReschedule }: { task: any; onComplete: (id: string) => void; onSkip: (id: string) => void; onReschedule: (id: string) => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    setSwiping(true);
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (Math.abs(dx) > Math.abs(dy)) {
      setOffset(Math.max(-120, Math.min(120, dx)));
    }
  };
  const onTouchEnd = () => {
    setSwiping(false);
    if (offset > 80) {
      onComplete(task._id);
      setOffset(0);
    } else if (offset < -80) {
      onSkip(task._id);
      setOffset(0);
    } else {
      setOffset(0);
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setSwiping(true);
    startX.current = e.clientX;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!swiping) return;
    const dx = e.clientX - startX.current;
    setOffset(Math.max(-120, Math.min(120, dx)));
  };
  const onMouseUp = () => {
    setSwiping(false);
    if (offset > 80) {
      onComplete(task._id);
    } else if (offset < -80) {
      onSkip(task._id);
    }
    setOffset(0);
  };

  const rotate = offset * 0.05;
  const orderId = task.orderId || task.sourceOrder?.orderId || task.sourceOrder?.commerceOrderId;
  const customer = task.assigneeName || task.customerPhone || 'Unknown';
  const items = task.sourceOrder?.items?.slice(0, 3) || [];
  const totalAmount = task.sourceOrder?.totalAmount || task.sourceOrder?.commerce?.totalAmount || 0;

  return (
    <div
      ref={cardRef}
      className="relative w-full max-w-md mx-auto bg-[#ffffff] border border-[#e5e5e5] rounded-3xl overflow-hidden shadow-lg select-none"
      style={{ transform: `translateX(${offset}px) rotate(${rotate}deg)`, transition: swiping ? 'none' : 'transform 0.3s ease' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => { if (swiping) { setSwiping(false); setOffset(0); } }}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="text-6xl font-extrabold text-emerald-500/30">✓</div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="text-6xl font-extrabold text-rose-500/30">✗</div>
      </div>

      <div className="relative z-10 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="badge-pill badge-pill-soft text-[10px]">{task.type}</span>
            <h3 className="font-bold text-lg text-[#0a0a0a] mt-1">{customer}</h3>
          </div>
          <span className={`badge-pill text-[10px] uppercase font-bold ${
            task.priority === 'critical' ? 'badge-pill-ember' : 'badge-pill-soft'
          }`}>{task.priority}</span>
        </div>

        {orderId && (
          <Link to={`/orders/${orderId}`} className="block text-xs font-semibold text-[#dc3545] hover:underline">
            #{orderId}
          </Link>
        )}

        <p className="text-xs text-[#0a0a0a] bg-[#fafafa] border border-[#e5e5e5] p-3 rounded-2xl">{task.reason}</p>

        {items.length > 0 && (
          <div className="space-y-1">
            {items.map((it: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-[#737373]">{it.product?.name || it.product?.sku || 'Item'}</span>
                <span className="font-medium text-[#0a0a0a]">{it.quantity}x {it.price ? `₹${it.price}` : ''}</span>
              </div>
            ))}
          </div>
        )}

        {totalAmount > 0 && (
          <div className="flex items-center gap-1 text-xs text-[#737373]">
            <DollarSign className="w-3 h-3" />
            <span>Order total: ₹{totalAmount.toLocaleString()}</span>
          </div>
        )}

        {task.dueAt && (
          <div className="flex items-center gap-1 text-xs text-[#737373]">
            <Clock className="w-3 h-3" />
            <SLACountdown dueAt={task.dueAt} />
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-emerald-50 text-emerald-700 font-semibold text-xs min-h-[44px] cursor-pointer border border-emerald-200">
            <Check className="w-4 h-4" />
            <span>Complete</span>
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-rose-50 text-rose-700 font-semibold text-xs min-h-[44px] cursor-pointer border border-rose-200">
            <XCircle className="w-4 h-4" />
            <span>Skip</span>
          </button>
          <button onClick={() => onReschedule(task._id)} className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-[#fafafa] text-[#0a0a0a] font-semibold text-xs min-h-[44px] cursor-pointer border border-[#e5e5e5]">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NextCall() {
  const navigate = useNavigate();
  const { simulatedTimeIso } = useSimulatedTime();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [view, setView] = useState<'list' | 'swipe'>('list');
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [swiping, setSwiping] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data: any = await taskApi.getNextAdvanced(20);
      const items = data.data?.task ? [data.data] : data.data?.tasks || [];
      setTasks(items);
    } catch {
      setError('Failed to load next tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const sorted = useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      let va: any, vb: any;
      switch (sortKey) {
        case 'priority':
          va = priorityWeight(a.task?.priority);
          vb = priorityWeight(b.task?.priority);
          break;
        case 'dueAt':
          va = a.task?.dueAt ? new Date(a.task.dueAt).getTime() : Infinity;
          vb = b.task?.dueAt ? new Date(b.task.dueAt).getTime() : Infinity;
          break;
        case 'score':
          va = a.score ?? 0;
          vb = b.score ?? 0;
          break;
        case 'type':
          va = a.task?.type || '';
          vb = b.task?.type || '';
          break;
        case 'customerName':
          va = a.task?.assigneeName || '';
          vb = b.task?.assigneeName || '';
          break;
        default:
          va = 0; vb = 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [tasks, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
      await taskApi.complete(taskId, { notes: 'Completed from Next Call', durationMinutes: 0 });
      toast.success('Task completed');
      loadTasks();
    } catch {
      toast.error('Failed to complete task');
    }
  };

  const handleSkip = async (taskId: string) => {
    try {
      await taskApi.skip(taskId, { notes: 'Skipped from Next Call' });
      toast.info('Task skipped');
      loadTasks();
    } catch {
      toast.error('Failed to skip task');
    }
  };

  const handleReschedule = (taskId: string) => {
    toast.info('Reschedule — coming in Phase 16');
  };

  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortKey !== field) return <ArrowUpDown className="w-3 h-3 text-[#737373]" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0a0a0a]" /> : <ArrowDown className="w-3 h-3 text-[#0a0a0a]" />;
  };

  if (loading && !tasks.length) {
    return (
      <div className="flex items-center justify-center h-64 text-[#737373] text-sm animate-pulse">
        Loading next calls...
      </div>
    );
  }

  if (error && !tasks.length) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4 animate-in">
        <h2 className="text-lg font-bold text-[#0a0a0a]">Failed to load</h2>
        <p className="text-xs text-[#737373]">{error}</p>
        <button onClick={loadTasks} className="btn-primary text-xs px-5 py-2.5">Retry</button>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4 animate-in">
        <div className="w-16 h-16 rounded-2xl bg-[#0a0a0a] text-white mx-auto flex items-center justify-center font-bold shadow-xs">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-[#0a0a0a]">All Calls Completed!</h2>
        <p className="text-xs text-[#737373]">No pending tasks require immediate follow-up.</p>
        <button onClick={() => navigate('/today')} className="btn-primary text-xs px-5 py-2.5">Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 animate-in">
      <Breadcrumbs items={[{ label: 'Next Call' }]} />

      <div className="card-blueprint p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/today')} className="p-2 rounded-2xl bg-[#fafafa] border border-[#e5e5e5] hover:bg-[#e5e5e5] cursor-pointer">
            <ArrowLeft className="w-4 h-4 text-[#0a0a0a]" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#0a0a0a]">Next Call</h1>
            <p className="text-xs text-[#737373]">{tasks.length} task{tasks.length !== 1 ? 's' : ''} queued</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-medium transition-all cursor-pointer ${
              view === 'list' ? 'bg-[#0a0a0a] text-white' : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
          <button
            onClick={() => setView('swipe')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-medium transition-all cursor-pointer ${
              view === 'swipe' ? 'bg-[#0a0a0a] text-white' : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a]'
            }`}
          >
            <GripVertical className="w-3.5 h-3.5" />
            Swipe
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="card-blueprint overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e5e5e5] text-[#737373] font-semibold">
                  {[
                    { key: 'type', label: 'Type' },
                    { key: 'customerName', label: 'Contact' },
                    { key: 'priority', label: 'Priority' },
                    { key: 'dueAt', label: 'SLA' },
                    { key: 'score', label: 'Score' },
                  ].map((col) => (
                    <th key={col.key} className="py-3 px-4 cursor-pointer select-none" onClick={() => handleSort(col.key as SortKey)}>
                      <span className="flex items-center gap-1">
                        {col.label}
                        <SortIcon field={col.key as SortKey} />
                      </span>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e5]">
                {sorted.map((item: any) => {
                  const task = item.task;
                  const orderId = task.orderId || task.sourceOrder?.orderId || task.sourceOrder?.commerceOrderId;
                  const customer = task.assigneeName || task.customerPhone || 'Unknown';
                  return (
                    <tr key={task._id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="py-3 px-4">
                        <span className="badge-pill badge-pill-soft text-[10px]">{task.type}</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#0a0a0a]">{customer}</td>
                      <td className="py-3 px-4">
                        <span className={`badge-pill text-[10px] uppercase font-bold ${
                          task.priority === 'critical' ? 'badge-pill-ember' : 'badge-pill-soft'
                        }`}>{task.priority}</span>
                      </td>
                      <td className="py-3 px-4">
                        {task.dueAt ? <SLACountdown dueAt={task.dueAt} /> : <span className="text-[#737373]">—</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#737373]">{item.score ?? '—'}</td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {task.customerPhone && task.customerPhone !== 'N/A' && (
                            <a href={`tel:${task.customerPhone}`} className="p-2 rounded-xl hover:bg-[#fafafa] text-[#0a0a0a] cursor-pointer" title="Call Customer">
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button onClick={() => navigate(`/tasks/${task._id}`)} className="p-2 rounded-xl hover:bg-[#fafafa] text-[#0a0a0a] cursor-pointer" title="View Task">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleComplete(task._id)} className="p-2 rounded-xl hover:bg-[#f0fdf4] text-emerald-700 cursor-pointer" title="Complete">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleSkip(task._id)} className="p-2 rounded-xl hover:bg-[#fef2f2] text-rose-700 cursor-pointer" title="Skip">
                            <SkipForward className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3 p-4">
            {sorted.map((item: any) => {
              const task = item.task;
              return (
                <div key={task._id} className="bg-[#ffffff] border border-[#e5e5e5] rounded-2xl p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="badge-pill badge-pill-soft text-[10px]">{task.type}</span>
                      <p className="font-semibold text-sm text-[#0a0a0a] mt-1">{task.assigneeName || task.customerPhone || 'Unknown'}</p>
                      <p className="text-[10px] text-[#737373]">{task.reason?.substring(0, 60)}</p>
                    </div>
                    <span className={`badge-pill text-[10px] uppercase font-bold ${
                      task.priority === 'critical' ? 'badge-pill-ember' : 'badge-pill-soft'
                    }`}>{task.priority}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#f5f5f5]">
                    {task.dueAt && <SLACountdown dueAt={task.dueAt} />}
                    <div className="flex gap-1">
                      <button onClick={() => handleComplete(task._id)} className="p-2 rounded-xl hover:bg-[#f0fdf4] text-emerald-700 cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleSkip(task._id)} className="p-2 rounded-xl hover:bg-[#fef2f2] text-rose-700 cursor-pointer"><SkipForward className="w-3.5 h-3.5" /></button>
                      <button onClick={() => navigate(`/tasks/${task._id}`)} className="p-2 rounded-xl hover:bg-[#fafafa] text-[#0a0a0a] cursor-pointer"><Eye className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {sorted.length === 0 ? (
            <div className="text-center py-12 text-xs text-[#737373]">No more tasks to swipe.</div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs text-[#737373] font-medium">Swipe right to complete, left to skip</p>
              {sorted.slice(0, 3).map((item: any, idx: number) => (
                <div key={item.task._id} className={`w-full max-w-md transition-opacity ${idx > 0 ? 'opacity-50 scale-95' : ''}`}>
                  <SwipeCard
                    task={item.task}
                    onComplete={handleComplete}
                    onSkip={handleSkip}
                    onReschedule={handleReschedule}
                  />
                </div>
              ))}
              {sorted.length > 3 && (
                <p className="text-xs text-[#737373]">{sorted.length - 3} more tasks in queue</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}