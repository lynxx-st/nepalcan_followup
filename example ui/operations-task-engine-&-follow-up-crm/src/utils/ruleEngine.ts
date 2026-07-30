import { Order, Task, FollowUpRule, TaskQueue, TaskPriority, TaskTimelineEvent, RecoveryRecord } from '../types';

/**
 * Calculates priority score for auto-sorting tasks (#11)
 */
export function calculatePriorityScore(
  task: Pick<Task, 'queue' | 'priority' | 'dueAt' | 'createdAt'>,
  orderTotalAmount: number = 0,
  nowIso: string = new Date().toISOString()
): number {
  let baseScore = 50;

  // 1. Queue Weight
  switch (task.queue) {
    case 'escalations':
      baseScore += 35;
      break;
    case 'cancelled_recovery':
      baseScore += 30;
      break;
    case 'vendor_delay':
      baseScore += 25;
      break;
    case 'customer_confirmation':
      baseScore += 20;
      break;
    case 'vendor_action':
      baseScore += 15;
      break;
    case 'review_calls':
      baseScore += 5;
      break;
  }

  // 2. Explicit Priority Weight
  switch (task.priority) {
    case 'critical':
      baseScore += 25;
      break;
    case 'high':
      baseScore += 15;
      break;
    case 'medium':
      baseScore += 5;
      break;
    case 'low':
      baseScore += 0;
      break;
  }

  // 3. SLA Urgency / Overdue Score
  const now = new Date(nowIso).getTime();
  const due = new Date(task.dueAt).getTime();
  const diffMinutes = Math.floor((due - now) / (1000 * 60));

  if (diffMinutes < 0) {
    // Overdue! Add points proportional to how late it is
    const overdueMinutes = Math.abs(diffMinutes);
    baseScore += 20 + Math.min(overdueMinutes, 60); // Cap boost at 60
  } else if (diffMinutes <= 15) {
    // Due within 15 mins
    baseScore += 15;
  } else if (diffMinutes <= 30) {
    baseScore += 10;
  }

  // 4. Order High-Value Boost (Orders over NPR 10,000)
  if (orderTotalAmount >= 20000) {
    baseScore += 15;
  } else if (orderTotalAmount >= 10000) {
    baseScore += 8;
  }

  return Math.min(Math.max(baseScore, 10), 100);
}

/**
 * Checks SLA remaining minutes and formats status text
 */
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
      badgeColor: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800',
    };
  } else {
    const hours = Math.floor(minutes / 60);
    const remMins = minutes % 60;
    const text = hours > 0 ? `${hours}h ${remMins}m left` : `${remMins}m left`;
    const color = minutes <= 15
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800';
    return {
      isOverdue: false,
      minutesLeft: minutes,
      displayText: text,
      badgeColor: color,
    };
  }
}

/**
 * Task Generator Engine:
 * Inspects all orders against active follow-up rules and creates tasks automatically
 */
export function evaluateRulesAndGenerateTasks(
  orders: Order[],
  existingTasks: Task[],
  rules: FollowUpRule[],
  nowIso: string = new Date().toISOString(),
  defaultAssignee: string = 'Sabin Shrestha'
): { newTasks: Task[]; updatedRules: FollowUpRule[] } {
  const generated: Task[] = [];
  const rulesMap = new Map(rules.map((r) => [r.id, { ...r }]));
  const nowTime = new Date(nowIso).getTime();

  for (const order of orders) {
    const orderAgeHours = (nowTime - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const cond = rule.triggerCondition;

      // 1. Order Status Match
      if (cond.orderStatus && cond.orderStatus !== 'any' && cond.orderStatus !== order.status) {
        continue;
      }

      // 2. Confirmation Status Match
      if (cond.confirmationStatus && cond.confirmationStatus !== 'any' && cond.confirmationStatus !== order.confirmationStatus) {
        continue;
      }

      // 3. Vendor Status Match
      if (cond.vendorStatus && cond.vendorStatus !== 'any' && cond.vendorStatus !== order.vendorStatus) {
        continue;
      }

      // 4. Aging Condition
      if (orderAgeHours < cond.timeAfterHours) {
        continue;
      }

      // 5. Check if active pending/in_progress task already exists for this order in this queue
      const existingQueueTask = existingTasks.find(
        (t) => t.orderId === order.id && t.queue === rule.action.createQueue && t.status !== 'completed' && t.status !== 'dismissed'
      );

      if (existingQueueTask) {
        continue; // Already has active task in this queue
      }

      // Rule matched! Generate new task
      const taskId = `task-gen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createdAt = nowIso;
      const dueAt = new Date(new Date(nowIso).getTime() + rule.action.slaMinutes * 60 * 1000).toISOString();

      const newTask: Task = {
        id: taskId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        queue: rule.action.createQueue,
        title: `${rule.name}: ${order.orderNumber} (${order.customerName})`,
        reason: rule.action.reasonTemplate.replace('#ORDER#', order.orderNumber),
        priority: rule.action.priority,
        priorityScore: calculatePriorityScore(
          { queue: rule.action.createQueue, priority: rule.action.priority, dueAt, createdAt },
          order.totalAmount,
          nowIso
        ),
        status: 'pending',
        assignedTo: defaultAssignee,
        slaMinutes: rule.action.slaMinutes,
        createdAt,
        dueAt,
        timeline: [
          {
            id: `tl-gen-${Date.now()}`,
            timestamp: nowIso,
            actor: 'Task Generator Engine',
            action: `Rule Triggered: ${rule.name}`,
            note: `Auto-generated rule condition matched (Order age: ${orderAgeHours.toFixed(1)}h)`,
          },
        ],
      };

      generated.push(newTask);

      // Increment rule count
      const r = rulesMap.get(rule.id);
      if (r) {
        r.tasksGeneratedCount += 1;
      }
    }
  }

  return {
    newTasks: generated,
    updatedRules: Array.from(rulesMap.values()),
  };
}

/**
 * Quick mapping of queue labels and icons
 */
export const QUEUE_CONFIG: Record<TaskQueue, { label: string; icon: string; color: string; badgeBg: string }> = {
  customer_confirmation: {
    label: 'Customer Confirmation',
    icon: 'PhoneCall',
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  vendor_action: {
    label: 'Vendor Action',
    icon: 'Store',
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  vendor_delay: {
    label: 'Vendor Delay',
    icon: 'Clock',
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  cancelled_recovery: {
    label: 'Cancelled Recovery',
    icon: 'RefreshCw',
    color: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  review_calls: {
    label: 'Review Calls',
    icon: 'Star',
    color: 'text-yellow-600 dark:text-yellow-400',
    badgeBg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  },
  escalations: {
    label: 'Escalations',
    icon: 'AlertTriangle',
    color: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800',
  },
};
