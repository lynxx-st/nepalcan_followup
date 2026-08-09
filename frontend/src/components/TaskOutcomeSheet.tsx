import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PhoneCall, X, RotateCcw, CalendarDays, Check } from 'lucide-react';
import OutcomeButtons from './OutcomeButtons';
import { orderIdOf, customerNameOf, customerPhoneOf } from '../utils/taskActions';
import SLACountdown from './SLACountdown';

export interface QueueItem {
  task: any;
  order?: any | null;
  score?: number;
  factors?: any;
  stage?: string;
  queueKey?: string;
}

interface TaskOutcomeSheetProps {
  item: QueueItem | null;
  onClose: () => void;
  onComplete: (item: QueueItem, label: string, code?: string) => void;
  onSkip: (item: QueueItem) => void;
  onReschedule: (item: QueueItem, date: string) => void;
  initialReschedule?: boolean;
}

export default function TaskOutcomeSheet({ item, onClose, onComplete, onSkip, onReschedule, initialReschedule }: TaskOutcomeSheetProps) {
  const [isReschedule, setIsReschedule] = useState(false);
  const [date, setDate] = useState(() => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10));

  useEffect(() => {
    setIsReschedule(!!initialReschedule);
  }, [item?.task?._id, initialReschedule]);

  useEffect(() => {
    if (!item) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [item, onClose]);

  const task = item?.task;
  if (!task) return null;

  const type = task.type || 'customer-confirmation';
  const queueKey = item?.queueKey || type;
  const orderId = orderIdOf(item);
  const name = customerNameOf(item.order, task);
  const phone = customerPhoneOf(item.order, task);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full mx-auto max-w-md rounded-t-[24px] md:rounded-[24px] bg-white shadow-2xl border md:border-[#e5e5e5] p-5 sm:p-6 max-h-[88vh] md:max-h-[80vh] overflow-y-auto animate-in-up">
        <div className="mx-auto w-10 h-1 rounded-full bg-[#e5e5e5] md:hidden mb-4" />

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge-pill badge-pill-soft text-[11px] capitalize">{type}</span>
            {task.priority && (
              <span className={`badge-pill text-[10px] uppercase font-bold ${task.priority === 'critical' ? 'badge-pill-ember' : 'badge-pill-soft'}`}>
                {task.priority}
              </span>
            )}
            {task.dueAt && <SLACountdown dueAt={task.dueAt} />}
          </div>
          <button onClick={onClose} className="p-2 rounded-2xl text-[#737373] hover:bg-[#f5f5f5] cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-base font-bold text-[#0a0a0a] leading-snug">{name}</p>
        <div className="flex items-center gap-2 text-xs mt-1 flex-wrap">
          {orderId && (
            <Link to={`/orders/${orderId}`} className="font-semibold text-[#0a0a0a] hover:underline">
              #{orderId}
            </Link>
          )}
          {task.taskNumber && <span className="text-[#737373]">· {task.taskNumber}</span>}
        </div>

        {task.reason && (
          <p className="text-xs text-[#0a0a0a] bg-[#fafafa] border border-[#e5e5e5] p-3 rounded-xl mt-3">{task.reason}</p>
        )}

        {isReschedule ? (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-[#0a0a0a]">Reschedule to</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#f5f5f5] border border-transparent focus:border-[#e5e5e5] focus:bg-white rounded-2xl px-4 py-3 text-sm text-[#0a0a0a] outline-none cursor-pointer"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { onReschedule(item, date); onClose(); }}
                className="flex-1 btn-primary font-semibold text-xs py-3 justify-center cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Confirm
              </button>
              <button onClick={() => setIsReschedule(false)} className="btn-secondary text-xs px-4 py-3 cursor-pointer">Back</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-wide text-[#737373] mt-4 mb-2">Log call outcome</p>
            <OutcomeButtons taskType={queueKey} onSelectOutcome={(label, code) => onComplete(item, label, code)} />

            <div className="flex items-center gap-2 pt-4 mt-1 border-t border-[#f5f5f5]">
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center justify-center gap-2 rounded-2xl border border-[#e5e5e5] text-[#0a0a0a] font-semibold text-xs px-4 py-3 min-h-[44px] cursor-pointer">
                  <PhoneCall className="w-4 h-4" />
                  Call
                </a>
              )}
              <button onClick={() => setIsReschedule(true)} className="flex items-center justify-center gap-2 rounded-2xl border border-[#e5e5e5] text-[#0a0a0a] font-semibold text-xs px-4 py-3 min-h-[44px] cursor-pointer ml-auto">
                <RotateCcw className="w-4 h-4" />
                Reschedule
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}