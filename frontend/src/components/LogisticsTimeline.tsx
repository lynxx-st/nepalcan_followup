import { Truck, Package, MapPin, Clock, CheckCircle, XCircle, AlertTriangle, ArrowDown } from 'lucide-react';

interface LogisticsEvent {
  event: string;
  status: string;
  rawPayload?: any;
  receivedAt?: string;
}

interface LogisticsTimelineProps {
  events?: LogisticsEvent[];
  externalLogisticsOrderId?: string | null;
}

const eventIcons: Record<string, React.ComponentType<any>> = {
  pickup_completed: Package,
  order_dispatched: Truck,
  order_arrived: MapPin,
  sent_for_delivery: Truck,
  delivery_completed: CheckCircle,
};

const eventColors: Record<string, string> = {
  pickup_completed: 'text-blue-500',
  order_dispatched: 'text-amber-500',
  order_arrived: 'text-emerald-500',
  sent_for_delivery: 'text-purple-500',
  delivery_completed: 'text-green-600',
};

export default function LogisticsTimeline({ events = [], externalLogisticsOrderId }: LogisticsTimelineProps) {
  if (events.length === 0 && !externalLogisticsOrderId) return null;

  return (
    <div className="space-y-3">
      {externalLogisticsOrderId && (
        <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-2xl p-3 flex items-center justify-between">
          <span className="text-[10px] text-[#737373] uppercase font-bold">External Logistics ID</span>
          <span className="text-xs font-bold text-[#0a0a0a] font-mono">{externalLogisticsOrderId}</span>
        </div>
      )}
      <div className="space-y-0">
        {events.map((evt, idx) => {
          const Icon = eventIcons[evt.event] || Clock;
          const color = eventColors[evt.event] || 'text-slate-400';
          const isLast = idx === events.length - 1;

          return (
            <div key={idx} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full bg-white border-2 border-[#e5e5e5] flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                {!isLast && <div className="w-0.5 h-full bg-[#e5e5e5] mt-1" />}
              </div>
              <div className={`pb-4 ${isLast ? '' : ''}`}>
                <p className="text-xs font-semibold text-[#0a0a0a]">{evt.status}</p>
                <p className="text-[10px] text-[#737373] capitalize">{evt.event?.replace(/_/g, ' ')}</p>
                {evt.receivedAt && (
                  <p className="text-[10px] text-[#737373] mt-0.5">
                    {new Date(evt.receivedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}