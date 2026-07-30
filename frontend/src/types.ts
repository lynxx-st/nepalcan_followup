export type TaskQueue =
  | 'customer-confirmation'
  | 'vendor-call'
  | 'vendor-delay'
  | 'cancelled-recovery'
  | 'review-call'
  | 'escalation'
  | 'logistics-followup';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

export interface TaskTimelineEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  note?: string;
  outcomeTag?: string;
  previousState?: string;
  newState?: string;
}

export interface Task {
  id: string;
  orderId: string;
  orderNumber: string;
  queue: TaskQueue;
  title: string;
  reason: string;
  priority: TaskPriority;
  priorityScore: number;
  status: TaskStatus;
  assignedTo: string;
  slaMinutes: number;
  createdAt: string;
  dueAt: string;
  completedAt?: string;
  completedBy?: string;
  outcome?: string;
  outcomeNotes?: string;
  timeline: TaskTimelineEvent[];
}
