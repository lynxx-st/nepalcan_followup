import { Task } from '../types';
import { QUEUE_CONFIG, getSLAInfo } from '../utils/ruleEngine';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import SLACountdown from './SLACountdown';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-500',
};

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const qConfig = QUEUE_CONFIG[task.queue];

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-slate-200 p-4 cursor-pointer hover:shadow-md transition-all hover:border-slate-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${qConfig.badgeBg}`}>
              {qConfig.label}
            </span>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              Score: {task.priorityScore}
            </span>
            <span className="font-mono text-xs font-bold text-slate-700">
              {task.orderNumber}
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-sm mb-1">{task.title}</h4>
          <p className="text-xs text-slate-600 line-clamp-2">{task.reason}</p>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
            <span>👤 {task.assignedTo}</span>
            <SLACountdown dueAt={task.dueAt} completed={task.status === 'completed'} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded ${PRIORITY_COLORS[task.priority] || 'bg-gray-500'}`}>
            {task.priority}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
            task.status === 'completed'
              ? 'bg-emerald-100 text-emerald-700'
              : task.status === 'in_progress'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {task.status === 'in_progress' ? 'In Progress' : task.status}
          </span>
        </div>
      </div>
    </div>
  );
}
