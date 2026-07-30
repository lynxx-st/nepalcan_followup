import { TaskQueue } from '../types';
import { PhoneOff, Clock, CheckCircle2, XCircle, Calendar, AlertTriangle, Tag, Zap, Sparkles, PhoneCall } from 'lucide-react';

interface OutcomeButtonsProps {
  queue: TaskQueue;
  onSelect: (outcome: string, note?: string) => void;
}

const ICONS = { PhoneOff, Clock, CheckCircle2, XCircle, Calendar, AlertTriangle, Tag, Zap, Sparkles, PhoneCall };

const COMMON: ButtonDef[] = [
  { label: '📵 No Answer', color: 'bg-slate-600 hover:bg-slate-500 text-white', icon: 'PhoneOff', outcome: 'No Answer' },
  { label: '📞 Call Later', color: 'bg-amber-600 hover:bg-amber-500 text-white', icon: 'Clock', outcome: 'Call Later' },
];

interface ButtonDef { label: string; color: string; icon: string; outcome: string }

const BUTTONS: Partial<Record<TaskQueue, ButtonDef[]>> = {
  'customer-confirmation': [
    { label: '✓ Confirmed', color: 'bg-emerald-600 hover:bg-emerald-500 text-white', icon: 'CheckCircle2', outcome: 'Customer Confirmed' },
    { label: '❌ Rejected', color: 'bg-rose-600 hover:bg-rose-500 text-white', icon: 'XCircle', outcome: 'Customer Rejected' },
    { label: '📅 Tomorrow', color: 'bg-indigo-600 hover:bg-indigo-500 text-white', icon: 'Calendar', outcome: 'Requested Tomorrow' },
    { label: '⚠️ Wrong #', color: 'bg-slate-800 hover:bg-slate-700 text-white', icon: 'AlertTriangle', outcome: 'Wrong Number' },
  ],
  'cancelled-recovery': [
    { label: '🎉 Recovered!', color: 'bg-emerald-600 hover:bg-emerald-500 text-white', icon: 'CheckCircle2', outcome: 'Order Recovered' },
    { label: '🏷️ 10% Coupon', color: 'bg-purple-600 hover:bg-purple-500 text-white', icon: 'Tag', outcome: 'Offered 10% Discount Coupon' },
    { label: '🚚 Express', color: 'bg-blue-600 hover:bg-blue-500 text-white', icon: 'Zap', outcome: 'Upgraded to Express Dispatch' },
    { label: '🔒 Lost', color: 'bg-slate-700 hover:bg-slate-600 text-white', icon: 'XCircle', outcome: 'Marked as Lost' },
  ],
  'vendor-call': [
    { label: '✓ Vendor Reminded', color: 'bg-blue-600 hover:bg-blue-500 text-white', icon: 'PhoneCall', outcome: 'Vendor Reminded' },
    { label: '✓ Accepted', color: 'bg-emerald-600 hover:bg-emerald-500 text-white', icon: 'CheckCircle2', outcome: 'Vendor Accepted' },
    { label: '⏳ Delayed 24h', color: 'bg-amber-600 hover:bg-amber-500 text-white', icon: 'Clock', outcome: 'Vendor Delayed' },
    { label: '🔥 Escalated', color: 'bg-rose-600 hover:bg-rose-500 text-white', icon: 'AlertTriangle', outcome: 'Escalated to Supervisor' },
  ],
  'vendor-delay': [
    { label: '✓ Vendor Reminded', color: 'bg-blue-600 hover:bg-blue-500 text-white', icon: 'PhoneCall', outcome: 'Vendor Reminded' },
    { label: '✓ Accepted', color: 'bg-emerald-600 hover:bg-emerald-500 text-white', icon: 'CheckCircle2', outcome: 'Vendor Accepted' },
    { label: '⏳ Delayed 24h', color: 'bg-amber-600 hover:bg-amber-500 text-white', icon: 'Clock', outcome: 'Vendor Delayed' },
    { label: '🔥 Escalated', color: 'bg-rose-600 hover:bg-rose-500 text-white', icon: 'AlertTriangle', outcome: 'Escalated to Supervisor' },
  ],
  'review-call': [
    { label: '⭐ 5-Star Review', color: 'bg-yellow-600 hover:bg-yellow-500 text-white', icon: 'Sparkles', outcome: 'Collected 5-Star Review' },
    { label: '📝 Feedback', color: 'bg-blue-600 hover:bg-blue-500 text-white', icon: 'CheckCircle2', outcome: 'Feedback Recorded' },
    { label: '⚠️ Issue', color: 'bg-rose-600 hover:bg-rose-500 text-white', icon: 'AlertTriangle', outcome: 'Customer Reported Issue' },
  ],
  'escalation': [
    { label: '✓ Resolved', color: 'bg-emerald-600 hover:bg-emerald-500 text-white', icon: 'CheckCircle2', outcome: 'Issue Resolved' },
    { label: '🏷️ Refund Approved', color: 'bg-indigo-600 hover:bg-indigo-500 text-white', icon: 'Tag', outcome: 'Refund Approved' },
    { label: '📵 No Response', color: 'bg-slate-700 hover:bg-slate-600 text-white', icon: 'PhoneOff', outcome: 'No Response' },
  ],
};

const ActionButton = ({ label, color, icon, onClick }: ButtonDef & { onClick: () => void }) => {
  const Icon = ICONS[icon as keyof typeof ICONS];
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center justify-center gap-2 font-bold text-xs p-3 rounded-xl shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer ${color}`}>
      {Icon && <Icon className="w-4 h-4" />}
      <span className="truncate">{label}</span>
    </button>
  );
};

export default function OutcomeButtons({ queue, onSelect }: OutcomeButtonsProps) {
  const specific = BUTTONS[queue] || [];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {[...specific, ...COMMON].map((btn) => (
        <ActionButton key={btn.outcome} {...btn} onClick={() => onSelect(btn.outcome)} />
      ))}
    </div>
  );
}
