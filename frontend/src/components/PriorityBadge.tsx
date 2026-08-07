import { AlertTriangle, Zap, Clock, Minus } from 'lucide-react';

interface PriorityBadgeProps {
  priority: 'critical' | 'high' | 'medium' | 'low';
  showLabel?: boolean;
}

const config = {
  critical: { bg: 'bg-red-500', text: 'text-white', label: 'Critical', icon: AlertTriangle },
  high: { bg: 'bg-amber-500', text: 'text-white', label: 'High', icon: Zap },
  medium: { bg: 'bg-blue-500', text: 'text-white', label: 'Medium', icon: Clock },
  low: { bg: 'bg-slate-400', text: 'text-white', label: 'Low', icon: Minus },
};

export default function PriorityBadge({ priority, showLabel = true }: PriorityBadgeProps) {
  const c = config[priority] || config.low;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
      <Icon className="w-3 h-3" />
      {showLabel && c.label}
    </span>
  );
}