import { getSLAInfo } from '../utils/ruleEngine';
import { useSimulatedTime } from '../hooks/useSimulatedTime';

interface SLACountdownProps {
  dueAt?: string;
  completed?: boolean;
}

export default function SLACountdown({ dueAt, completed }: SLACountdownProps) {
  const { simulatedTimeIso } = useSimulatedTime();

  if (completed || !dueAt) return null;

  const sla = getSLAInfo(dueAt, simulatedTimeIso);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${sla.badgeColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${sla.isOverdue ? 'bg-red-500 animate-pulse' : 'bg-current'}`} />
      ⏱ {sla.displayText}
    </span>
  );
}
