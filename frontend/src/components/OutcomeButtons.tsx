import { PhoneOff, Clock, CheckCircle2, XCircle, CalendarDays, AlertTriangle, Tag, Zap, Sparkles, PhoneCall, MessageSquare } from 'lucide-react';

interface OutcomeButtonsProps {
  queue?: string;
  taskType?: string;
  onSelect?: (outcome: string, code?: string) => void;
  onSelectOutcome?: (outcome: string, code?: string) => void;
  disabled?: boolean;
}

const ICONS = { PhoneOff, Clock, CheckCircle2, XCircle, CalendarDays, AlertTriangle, Tag, Zap, Sparkles, PhoneCall, MessageSquare };

type Tone = 'solid' | 'ghost' | 'outline' | 'ember';

interface ButtonDef {
  label: string;
  tone: Tone;
  icon: string;
  outcome: string;
  code?: string;
}

const COMMON: ButtonDef[] = [
  { label: 'No Answer', tone: 'ghost', icon: 'PhoneOff', outcome: 'No Answer', code: 'no-answer' },
  { label: 'Call Later', tone: 'ghost', icon: 'Clock', outcome: 'Call Later', code: 'call-later' },
];

const BUTTONS: Record<string, ButtonDef[]> = {
  'customer-confirmation': [
    { label: 'Confirmed', tone: 'solid', icon: 'CheckCircle2', outcome: 'Customer Confirmed', code: 'customer-confirmed' },
    { label: 'Rejected', tone: 'ember', icon: 'XCircle', outcome: 'Customer Rejected', code: 'customer-rejected' },
    { label: 'Tomorrow', tone: 'outline', icon: 'CalendarDays', outcome: 'Requested Tomorrow', code: 'requested-tomorrow' },
    { label: 'Wrong Number', tone: 'ghost', icon: 'AlertTriangle', outcome: 'Wrong Number', code: 'wrong-number' },
  ],
  'cancelled-recovery': [
    { label: 'Recovered', tone: 'solid', icon: 'CheckCircle2', outcome: 'Order Recovered', code: 'recovered' },
    { label: 'Lost', tone: 'ember', icon: 'XCircle', outcome: 'Marked as Lost', code: 'lost' },
    { label: '10% Coupon', tone: 'outline', icon: 'Tag', outcome: 'Offered 10% Discount Coupon' },
    { label: 'Express Ship', tone: 'ghost', icon: 'Zap', outcome: 'Upgraded to Express Dispatch' },
  ],
  'vendor-call': [
    { label: 'Accepted', tone: 'solid', icon: 'CheckCircle2', outcome: 'Vendor Accepted', code: 'vendor-accepted' },
    { label: 'Delayed 24h', tone: 'outline', icon: 'Clock', outcome: 'Vendor Delayed', code: 'vendor-delayed' },
    { label: 'Reminded', tone: 'ghost', icon: 'PhoneCall', outcome: 'Vendor Reminded' },
    { label: 'Escalated', tone: 'ember', icon: 'AlertTriangle', outcome: 'Escalated to Supervisor' },
  ],
  'vendor-delay': [
    { label: 'Accepted', tone: 'solid', icon: 'CheckCircle2', outcome: 'Vendor Accepted', code: 'vendor-accepted' },
    { label: 'Still Delayed', tone: 'outline', icon: 'Clock', outcome: 'Vendor Delayed', code: 'vendor-delayed' },
    { label: 'Reminded', tone: 'ghost', icon: 'PhoneCall', outcome: 'Vendor Reminded' },
    { label: 'Escalated', tone: 'ember', icon: 'AlertTriangle', outcome: 'Escalated to Supervisor' },
  ],
  'review-call': [
    { label: '5-Star Review', tone: 'solid', icon: 'Sparkles', outcome: 'Collected 5-Star Review' },
    { label: 'Feedback', tone: 'outline', icon: 'MessageSquare', outcome: 'Feedback Recorded' },
    { label: 'Reported Issue', tone: 'ember', icon: 'AlertTriangle', outcome: 'Customer Reported Issue' },
  ],
  escalation: [
    { label: 'Resolved', tone: 'solid', icon: 'CheckCircle2', outcome: 'Issue Resolved' },
    { label: 'Refund Approved', tone: 'outline', icon: 'Tag', outcome: 'Refund Approved' },
    { label: 'No Response', tone: 'ghost', icon: 'PhoneOff', outcome: 'No Response' },
  ],
};

const TONES: Record<Tone, string> = {
  solid: 'bg-[#0a0a0a] text-white',
  ghost: 'bg-[#f5f5f5] text-[#0a0a0a]',
  outline: 'border border-[#e5e5e5] text-[#0a0a0a]',
  ember: 'border border-[#e7000b]/30 text-[#e7000b] bg-[#fff7f7]',
};

const ActionButton = ({ label, tone, icon, onClick }: ButtonDef & { onClick: () => void }) => {
  const Icon = ICONS[icon as keyof typeof ICONS];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 font-semibold text-xs p-3 rounded-2xl min-h-[44px] transition-all cursor-pointer active:scale-[0.98] ${TONES[tone]}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
  );
};

export default function OutcomeButtons({ queue, taskType, onSelect, onSelectOutcome, disabled }: OutcomeButtonsProps) {
  const activeQueue = queue || taskType || 'customer-confirmation';
  const specific = BUTTONS[activeQueue] || [];
  const handleSelect = (btn: ButtonDef) => {
    if (disabled) return;
    if (onSelect) onSelect(btn.outcome, btn.code);
    if (onSelectOutcome) onSelectOutcome(btn.outcome, btn.code);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {[...specific, ...COMMON].map((btn) => (
        <ActionButton key={btn.label} {...btn} onClick={() => handleSelect(btn)} />
      ))}
    </div>
  );
}