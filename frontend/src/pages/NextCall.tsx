import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { taskApi } from '../services/api';
import SLACountdown from '../components/SLACountdown';
import Breadcrumbs from '../components/Breadcrumbs';
import TaskOutcomeSheet, { QueueItem } from '../components/TaskOutcomeSheet';
import {
  STAGE_META, STAGE_ORDER, taskStage, orderStagePath, orderStageMeta, TASK_LABEL,
} from '../utils/lifecycle';
import { workflowStageToQueue } from '../utils/lifecycle';
import {
  completeTaskWithOutcome, skipTaskWithNote, rescheduleTaskTo,
} from '../utils/taskActions';
import { entityName } from '../utils/order';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronUp, GripVertical, List, Phone, SkipForward,
} from 'lucide-react';

// ── Card data helpers ──────────────────────────────────────────────
function personOf(order: any, task: any) {
  const raw = order?.customer;
  const customer = raw && typeof raw === 'object' ? raw : {};
  const vendor = order?.vendor && typeof order.vendor === 'object' ? order.vendor : {};
  const name =
    (typeof raw === 'string' ? raw : '') ||
    order?.customerName ||
    customer.name ||
    order?.customerProfile?.name ||
    '';
  const phone = `${customer.phone || order?.customerPhone || order?.customerProfile?.phone || task?.customerPhone || ''}`.replace(/^[^0-9+]+/, '');
  const vendorName = vendor.name || order?.vendorName || '';
  const vendorPhone = `${vendor.phone || order?.vendorPhone || ''}`.replace(/^[^0-9+]+/, '');
  const branch = order?.branch || order?.commerce?.branch || order?.commerce?.sender?.name || '';
  return { name: name || phone || 'Customer', phone, vendorName, vendorPhone, branch };
}

function orderOf(item: QueueItem): string {
  return String(item.order?.commerceOrderId || item.task?.orderNumber || item.task?.sourceOrder?.orderId || '');
}

function orderData(item: QueueItem) {
  const o = item.order;
  const amount = Number(o?.commerce?.totalAmount || o?.totalAmount || item.task?.sourceOrder?.totalAmount || 0);
  const items = o?.commerce?.items || o?.items || [];
  const qty = items.reduce((a: number, i: any) => a + Number(i.quantity || 1), 0);
  const productNames = items.map((i: any) => i.product?.name || i.product?.sku || i.sku || 'Item').filter(Boolean);
  const origin = entityName(o?.commerce?.originBranch || o?.originBranch);
  const dest = entityName(o?.commerce?.destinationBranch || o?.destinationBranch);
  const route = origin && dest ? `${origin} → ${dest}` : origin || dest || '';
  const payment = o?.commerce?.paymentMethod || '';
  return { amount, qty, route, payment, products: productNames };
}

function modulePathOf(item: QueueItem): string | null {
  const orderNo = orderOf(item);
  if (!orderNo) return null;
  return `${orderStagePath(orderNo, item.order?.workflowStage)}?returnTo=/next`;
}

function StageBadge({ item }: { item: QueueItem }) {
  const ws = item.order?.workflowStage;
  if (ws) {
    const m = orderStageMeta(ws);
    const returnlike = ws === 'cancelled' || ws === 'customer_response' || ws === 'vendor_response';
    return <span className={`badge-pill text-[10px] uppercase font-bold ${returnlike ? 'badge-pill-ember' : 'badge-pill-soft'}`}>{m.short}</span>;
  }
  const s = (item.stage || taskStage(item.task?.type)) as keyof typeof STAGE_META;
  return <span className="badge-pill badge-pill-soft text-[10px] uppercase">{STAGE_META[s]?.short || s}</span>;
}

function MetaChips({ item }: { item: QueueItem }) {
  const task = item.task;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <StageBadge item={item} />
      <span className="badge-pill badge-pill-soft text-[11px] capitalize">{TASK_LABEL[task.type || '']?.short || task.type || 'task'}</span>
    </div>
  );
}

interface CardFooterProps {
  item: QueueItem;
  onOutcome: (i: QueueItem) => void;
  onSkip: (i: QueueItem) => void;
  path: string | null;
}

function CardFooter({ item, onOutcome, onSkip, path }: CardFooterProps) {
  const { name: _n, phone } = personOf(item.order, item.task);
  return (
    <div className="flex items-center gap-2 pt-3 mt-0.5 border-t border-[#f5f5f5]">
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex items-center justify-center gap-1.5 rounded-2xl border border-[#e5e5e5] text-[#0a0a0a] font-semibold text-xs px-3.5 py-2.5 min-h-[44px] cursor-pointer"
        >
          <Phone className="w-3.5 h-3.5" />
          Call
        </a>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onSkip(item); }}
          className="pointer-events-auto flex items-center justify-center gap-1 rounded-2xl border border-[#e5e5e5] text-[#737373] hover:text-[#0a0a0a] hover:border-[#0a0a0a] font-semibold text-xs px-3 py-2.5 min-h-[44px] cursor-pointer"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Skip
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOutcome(item); }}
          className="pointer-events-auto flex items-center justify-center gap-1 rounded-2xl border border-[#e5e5e5] text-[#0a0a0a] font-semibold text-xs px-3.5 py-2.5 min-h-[44px] cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          Done
        </button>
        {path && (
          <a
            href={path}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto flex items-center justify-center gap-1 rounded-2xl bg-[#0a0a0a] text-white font-semibold text-xs px-4 py-2.5 min-h-[44px] cursor-pointer"
          >
            Open
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function TaskListCard({ item, onOutcome, onSkip }: { item: QueueItem; onOutcome: (i: QueueItem, queueKey: string) => void; onSkip: (i: QueueItem) => void }) {
  const task = item.task;
  const path = modulePathOf(item);
  const { name, phone, vendorName, vendorPhone, branch } = personOf(item.order, task);
  const orderNo = orderOf(item);
  const { amount, qty, route, payment, products } = orderData(item);
  const workflowStage = item.order?.workflowStage || '';
  const queueKey = workflowStageToQueue(workflowStage);

  return (
    <div className="relative bg-white border border-[#e5e5e5] rounded-[24px] overflow-hidden transition-all hover:border-[#0a0a0a]/40">
      {path && <a href={path} target="_blank" rel="noopener noreferrer" aria-label={`Open ${orderNo || 'order'}`} className="absolute inset-0 z-10 rounded-[24px]" />}
      <div className="relative z-20 pointer-events-none flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <MetaChips item={item} />
          {task.dueAt && <SLACountdown dueAt={task.dueAt} />}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-[17px] text-[#0a0a0a] tracking-tight leading-snug">{name}</h3>
            {amount > 0 && <span className="shrink-0 text-sm font-bold text-[#0a0a0a]">Rs {amount.toLocaleString()}</span>}
          </div>
          <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-xs text-[#737373]">
            {orderNo && <span className="font-semibold text-[#0a0a0a]">#{orderNo}</span>}
            {route && <span>{route}</span>}
            {branch && <span className="bg-[#f5f5f5] px-2 py-0.5 rounded-md">{branch}</span>}
          </div>
        </div>

        {products.length && <p className="text-[12px] text-[#0a0a0a] bg-[#fafafa] border border-[#e5e5e5] p-2 rounded-lg">{products.join(', ')}</p>}
        {task.reason && <p className="text-[13px] text-[#737373] leading-relaxed line-clamp-2">{task.reason}</p>}

        <div className="flex items-center gap-2 pt-3 mt-0.5 border-t border-[#f5f5f5]">
          <div className="flex items-center gap-x-3 text-xs text-[#737373] flex-1 min-w-0">
            {phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{phone}</span>}
            {vendorName && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#e5e5e5]" />{vendorName}</span>}
            {vendorPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{vendorPhone}</span>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onSkip(item); }}
              className="pointer-events-auto flex items-center justify-center gap-1 rounded-2xl border border-[#e5e5e5] text-[#737373] hover:text-[#0a0a0a] hover:border-[#0a0a0a] font-semibold text-xs px-3 py-2.5 min-h-[44px] cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Skip
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onOutcome(item, queueKey); }}
              className="pointer-events-auto flex items-center justify-center gap-1 rounded-2xl border border-[#e5e5e5] text-[#0a0a0a] font-semibold text-xs px-3.5 py-2.5 min-h-[44px] cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Done
            </button>
            {path && (
              <a
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto flex items-center justify-center gap-1 rounded-2xl bg-[#0a0a0a] text-white font-semibold text-xs px-4 py-2.5 min-h-[44px] cursor-pointer"
              >
                Open
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SwipeCard({ item, onOpen, onOutcome, onSkip, onReschedule }: { item: QueueItem; onOpen: (i: QueueItem) => void; onOutcome: (i: QueueItem, queueKey: string) => void; onSkip: (i: QueueItem) => void; onReschedule: (i: QueueItem) => void }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0 });
  const offsetRef = useRef(offset);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const onStart = (cx: number, cy: number) => {
    setDragging(true);
    start.current = { x: cx, y: cy };
  };
  const onMove = (cx: number, cy: number) => {
    if (!dragging) return;
    setOffset({ x: cx - start.current.x, y: cy - start.current.y });
  };
  const onEnd = () => {
    if (!dragging) return;
    setDragging(false);
    const { x, y } = offsetRef.current;
    if (Math.abs(x) > 80 && Math.abs(x) > Math.abs(y)) {
      x > 0 ? onOpen(item) : onSkip(item);
    } else if (y < -80 && Math.abs(y) > Math.abs(x)) {
      onReschedule(item);
    }
    setOffset({ x: 0, y: 0 });
  };

  const rotate = offset.x * 0.06;
  const task = item.task;
  const path = modulePathOf(item);
  const { name, phone, vendorName, vendorPhone, branch } = personOf(item.order, task);
  const orderNo = orderOf(item);
  const { amount, qty, route, payment, products } = orderData(item);
  const workflowStage = item.order?.workflowStage || '';
  const queueKey = workflowStageToQueue(workflowStage);

  return (
    <div
      className="relative w-full max-w-md mx-auto bg-white border border-[#e5e5e5] rounded-[28px] overflow-hidden shadow-xl select-none"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg)`, transition: dragging ? 'none' : 'transform 0.3s ease' }}
      onTouchStart={(e) => onStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => onMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={onEnd}
      onMouseDown={(e) => onStart(e.clientX, e.clientY)}
      onMouseMove={(e) => dragging && onMove(e.clientX, e.clientY)}
      onMouseUp={onEnd}
      onMouseLeave={() => { setDragging(false); setOffset({ x: 0, y: 0 }); }}
    >
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-30 transition-opacity ${offset.x > 0 ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-2xl font-extrabold text-[#0a0a0a] border-4 border-[#0a0a0a] rounded-2xl px-4 py-2 -rotate-12">OPEN</span>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-30 transition-opacity ${offset.x < 0 ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-2xl font-extrabold text-rose-600 border-4 border-rose-600 rounded-2xl px-4 py-2 rotate-12">SKIP</span>
      </div>
      <div className={`absolute inset-x-0 top-4 flex justify-center pointer-events-none z-30 transition-opacity ${offset.y < 0 ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-xs font-bold text-[#0a0a0a] bg-white/90 border border-[#e5e5e5] rounded-2xl px-3 py-1.5 flex items-center gap-1">
          <ChevronUp className="w-3.5 h-3.5" /> Reschedule
        </span>
      </div>

      {path && <a href={path} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10 rounded-[28px]" />}

      <div className="relative z-20 p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <MetaChips item={item} />
          {task.dueAt && <SLACountdown dueAt={task.dueAt} />}
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="font-bold text-2xl text-[#0a0a0a] tracking-tight leading-snug">{name}</h3>
          <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-xs text-[#737373]">
            {orderNo && <span className="font-semibold text-[#0a0a0a]">#{orderNo}</span>}
            {route && <span>{route}</span>}
            {branch && <span className="bg-[#f5f5f5] px-2 py-0.5 rounded-md">{branch}</span>}
          </div>
        </div>

        {products.length && <p className="text-[12px] text-[#0a0a0a] bg-[#fafafa] border border-[#e5e5e5] p-2 rounded-lg">{products.join(', ')}</p>}
        {task.reason && (
          <p className="text-[13px] text-[#0a0a0a] bg-[#fafafa] border border-[#e5e5e5] p-3 rounded-xl leading-relaxed">{task.reason}</p>
        )}

        <div className="flex items-center gap-x-4 text-xs text-[#737373]">
          {amount > 0 && <span className="font-bold text-[#0a0a0a] text-sm">Rs {amount.toLocaleString()}</span>}
          {qty > 0 && <span>{qty} items</span>}
          {payment && <span className="capitalize">{payment}</span>}
        </div>

        <div className="flex items-center gap-2 pt-1">
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center justify-center gap-1.5 border border-[#e5e5e5] text-[#0a0a0a] font-semibold text-xs px-4 py-2.5 min-h-[44px] rounded-2xl cursor-pointer shrink-0">
              <Phone className="w-3.5 h-3.5" />
              Call
            </a>
          )}
          <button onClick={() => onOpen(item)} className="flex-1 flex items-center justify-center gap-1.5 bg-[#0a0a0a] text-white font-semibold text-xs py-2.5 min-h-[44px] rounded-2xl cursor-pointer">
            Open order
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button onClick={() => onOutcome(item, queueKey)} className="flex items-center gap-1 text-[11px] font-medium text-[#737373] hover:text-[#0a0a0a] min-h-[44px] px-3 cursor-pointer">
            <Check className="w-3.5 h-3.5" /> Log outcome
          </button>
          <button onClick={() => onReschedule(item)} className="flex items-center gap-1 text-[11px] font-medium text-[#737373] hover:text-[#0a0a0a] min-h-[44px] px-3 cursor-pointer">
            <GripVertical className="w-3.5 h-3.5" /> Reschedule
          </button>
        </div>

        <p className="text-center text-[10px] text-[#737373] uppercase tracking-wide pt-1">
          Swipe right to open · left to skip · up to reschedule
        </p>
      </div>
    </div>
  );
}

function StageChips({ counts, active, onSelect }: { counts: Record<string, number>; active: string; onSelect: (k: string) => void }) {
  const chips = [
    { key: 'all', label: 'All queues', count: counts.all },
    ...STAGE_ORDER.map((s) => ({ key: s, label: STAGE_META[s].label, count: counts[s] })),
  ];
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {chips.map((c) => {
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onSelect(c.key)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer border ${
              isActive ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]' : 'bg-white text-[#0a0a0a] border-[#e5e5e5] hover:border-[#0a0a0a]'
            }`}
          >
            <span>{c.label}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white text-[#0a0a0a]' : 'bg-[#f5f5f5] text-[#737373]'}`}>
              {c.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function NextCall() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo') || '/today';
  const taskParam = params.get('task');

  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'swipe'>('list');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sheetItem, setSheetItem] = useState<QueueItem | null>(null);
  const [sheetStart, setSheetStart] = useState<'outcome' | 'reschedule'>('outcome');
  const [counts, setCounts] = useState<Record<string, number>>({ all: 0, preOrder: 0, processing: 0, afterDelivery: 0, return: 0 });

  const usedTaskRef = useRef(false);

  useEffect(() => {
    const s = params.get('stage');
    if (s) setStageFilter(s);
  }, []);

  const loadQueue = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res: any = await taskApi.getNextAdvanced(50);
      const tasks = res?.data?.tasks || [];
      setItems(tasks);
      const c = { all: tasks.length, preOrder: 0, processing: 0, afterDelivery: 0, return: 0 };
      for (const t of tasks) {
        const s = t.stage || taskStage(t.task?.type);
        if (c[s] !== undefined) c[s]++;
      }
      setCounts(c);
      if (taskParam && !usedTaskRef.current) {
        usedTaskRef.current = true;
        const found = tasks.find((t: any) => String(t.task?._id) === taskParam);
        if (found) {
          setView('swipe');
          setSheetItem(found);
        }
      }
    } catch {
      if (!silent) setError('Failed to load next calls');
    } finally {
      setLoading(false);
    }
  }, [taskParam]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const visible = useMemo(
    () => items.filter((i) => stageFilter === 'all' || (i.stage || taskStage(i.task?.type)) === stageFilter),
    [items, stageFilter]
  );

  const patchQueue = (removed: QueueItem) => {
    setItems((prev) => prev.filter((i) => i.task?._id !== removed.task?._id));
    loadQueue(true);
  };

  const handleComplete = async (item: QueueItem, label: string, code?: string) => {
    const ok = await completeTaskWithOutcome(item, label, code);
    if (ok) {
      setSheetItem(null);
      patchQueue(item);
    }
  };

  const handleSkip = async (item: QueueItem) => {
    setSheetItem(null);
    const ok = await skipTaskWithNote(item.task);
    if (ok) patchQueue(item);
  };

  const handleReschedule = async (item: QueueItem, date: string) => {
    const ok = await rescheduleTaskTo(item.task, date);
    if (ok) patchQueue(item);
  };

  const openOutcome = (item: QueueItem, queueKey: string) => {
    setSheetStart('outcome');
    setSheetItem({ ...item, queueKey });
  };

  const openReschedule = (item: QueueItem) => {
    setSheetStart('reschedule');
    setSheetItem(item);
  };

  const openModule = (item: QueueItem) => {
    const p = modulePathOf(item);
    if (p) navigate(p);
  };

  const onStageSelect = (k: string) => {
    setStageFilter(k);
    navigate(k === 'all' ? '/next' : `/next?stage=${k}`, { replace: true });
  };

  if (loading && !items.length) {
    return (
      <div className="flex items-center justify-center h-64 text-[#737373] text-sm animate-pulse">
        Loading your call queue…
      </div>
    );
  }

  if (error && !items.length) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <h2 className="text-lg font-bold text-[#0a0a0a]">Failed to load</h2>
        <p className="text-xs text-[#737373]">{error}</p>
        <button onClick={() => loadQueue()} className="btn-primary text-xs px-5 py-2.5 cursor-pointer">Retry</button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4 animate-in">
        <div className="w-16 h-16 rounded-2xl bg-[#0a0a0a] text-white mx-auto flex items-center justify-center font-bold">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-[#0a0a0a]">All Calls Completed</h2>
        <p className="text-xs text-[#737373]">No pending tasks require immediate follow-up.</p>
        <button onClick={() => navigate('/today')} className="btn-primary text-xs px-5 py-2.5 cursor-pointer">Return to Dashboard</button>
      </div>
    );
  }

  const deck = view === 'swipe' ? visible.slice(0, 3) : [];

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Next Call Workstation' }]} />

      <div className="max-w-7xl card-blueprint p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(returnTo)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-[#fafafa] border border-[#e5e5e5] hover:bg-[#e5e5e5] cursor-pointer" aria-label="Back to Today's Work">
              <ArrowLeft className="w-4 h-4 text-[#0a0a0a]" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#0a0a0a] tracking-tight">Next Call</h1>
              <p className="text-xs text-[#737373]">{items.length} queued · {visible.length} in view</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-2xl text-xs font-medium transition-all cursor-pointer ${
                view === 'list' ? 'bg-[#0a0a0a] text-white' : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setView('swipe')}
              className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-2xl text-xs font-medium transition-all cursor-pointer ${
                view === 'swipe' ? 'bg-[#0a0a0a] text-white' : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a]'
              }`}
            >
              <GripVertical className="w-3.5 h-3.5" />
              Swipe
            </button>
          </div>
        </div>

        <StageChips counts={counts} active={stageFilter} onSelect={onStageSelect} />
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-[24px] border border-[#e5e5e5]">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <h3 className="font-semibold text-sm text-[#0a0a0a]">Queue cleared</h3>
          <p className="text-xs text-[#737373] mt-1">No calls left in this stage.</p>
          <button onClick={() => onStageSelect('all')} className="btn-secondary text-xs px-5 py-2.5 mt-4 cursor-pointer">View all queues</button>
        </div>
      ) : view === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map((item) => (
            <TaskListCard key={item.task._id} item={item} onOutcome={openOutcome} onSkip={handleSkip} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 pt-2">
          <p className="text-xs text-[#737373] font-medium">Swipe right to open · left to skip · up to reschedule</p>
          <div className="w-full max-w-md">
            {deck.map((item, idx) => (
              <div
                key={item.task._id}
                className={`transition-all ${idx === 0
                  ? ''
                  : idx === 1
                    ? 'opacity-50 scale-[0.97] -mt-10 pointer-events-none'
                    : 'opacity-20 scale-[0.93] -mt-14 pointer-events-none'}`}
              >
                <SwipeCard item={item} onOpen={openModule} onOutcome={openOutcome} onSkip={handleSkip} onReschedule={openReschedule} />
              </div>
            ))}
          </div>
          {visible.length > 3 && (
            <p className="text-xs text-[#737373]">{visible.length - 3} more in this queue</p>
          )}
        </div>
      )}

      <TaskOutcomeSheet
        item={sheetItem}
        onClose={() => setSheetItem(null)}
        onComplete={handleComplete}
        onSkip={handleSkip}
        onReschedule={handleReschedule}
        initialReschedule={sheetStart === 'reschedule'}
      />
    </div>
  );
}