import { TaskQueue } from '../types';

export function getSLAInfo(dueAtIso: string, nowIso: string = new Date().toISOString()): {
  isOverdue: boolean;
  minutesLeft: number;
  displayText: string;
  badgeColor: string;
} {
  const now = new Date(nowIso).getTime();
  const due = new Date(dueAtIso).getTime();
  const diffMs = due - now;
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 0) {
    const overdueMins = Math.abs(minutes);
    const hours = Math.floor(overdueMins / 60);
    const remMins = overdueMins % 60;
    const text = hours > 0 ? `Overdue ${hours}h ${remMins}m` : `Overdue ${overdueMins}m`;
    return {
      isOverdue: true,
      minutesLeft: minutes,
      displayText: text,
      badgeColor: 'bg-red-500/15 text-red-700 border-red-300',
    };
  }

  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  const text = hours > 0 ? `${hours}h ${remMins}m left` : `${remMins}m left`;
  const color = minutes <= 15
    ? 'bg-amber-500/15 text-amber-700 border-amber-300'
    : 'bg-emerald-500/15 text-emerald-700 border-emerald-300';
  return {
    isOverdue: false,
    minutesLeft: minutes,
    displayText: text,
    badgeColor: color,
  };
}

export const QUEUE_CONFIG: Record<TaskQueue, { label: string; color: string; badgeBg: string }> = {
  'customer-confirmation': {
    label: 'Customer Confirmation',
    color: 'text-blue-600',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  'vendor-call': {
    label: 'Vendor Action',
    color: 'text-purple-600',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  'vendor-delay': {
    label: 'Vendor Delay',
    color: 'text-amber-600',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  'cancelled-recovery': {
    label: 'Cancelled Recovery',
    color: 'text-rose-600',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  'review-call': {
    label: 'Review Calls',
    color: 'text-yellow-600',
    badgeBg: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  'escalation': {
    label: 'Escalations',
    color: 'text-red-600',
    badgeBg: 'bg-red-100 text-red-800 border-red-200',
  },
  'logistics-followup': {
    label: 'Logistics Follow-up',
    color: 'text-teal-600',
    badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
  },
};
