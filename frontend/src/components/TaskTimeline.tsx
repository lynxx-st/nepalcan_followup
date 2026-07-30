import { TaskTimelineEvent } from '../types';

interface TaskTimelineProps {
  events: TaskTimelineEvent[];
}

export default function TaskTimeline({ events }: TaskTimelineProps) {
  if (!events || events.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-indigo-500" />
        Order Audit Timeline
      </h3>
      <div className="relative pl-4 border-l-2 border-indigo-200 space-y-4">
        {events.map((event) => (
          <div key={event.id} className="relative text-xs space-y-0.5">
            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white" />
            <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
              <span>{event.actor}</span>
              <span>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="font-semibold text-slate-800">{event.action}</div>
            {event.note && (
              <div className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-1">{event.note}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
