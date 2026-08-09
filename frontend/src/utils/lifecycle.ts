export type LifecycleStage = 'preOrder' | 'processing' | 'afterDelivery' | 'return';

export const TASK_STAGE: Record<string, LifecycleStage> = {
  'customer-confirmation': 'preOrder',
  'vendor-call': 'processing',
  'vendor-delay': 'processing',
  'logistics-followup': 'processing',
  'review-call': 'afterDelivery',
  'cancelled-recovery': 'return',
  escalation: 'return',
};

export const STAGE_ORDER: LifecycleStage[] = ['preOrder', 'processing', 'afterDelivery', 'return'];

export const STAGE_META: Record<LifecycleStage, { label: string; short: string; description: string }> = {
  preOrder: { label: 'Pre Order', short: 'Pre', description: 'Confirm & verify new orders' },
  processing: { label: 'Processing', short: 'Proc', description: 'Vendor & logistics follow-up' },
  afterDelivery: { label: 'After Delivery', short: 'Deliv', description: 'Reviews & NPS feedback' },
  return: { label: 'Return', short: 'Return', description: 'Recovery & escalations' },
};

export const TASK_LABEL: Record<string, { label: string; short: string }> = {
  'customer-confirmation': { label: 'Customer Confirmation', short: 'Confirm' },
  'vendor-call': { label: 'Vendor Action', short: 'Vendor' },
  'vendor-delay': { label: 'Vendor Delay', short: 'Delay' },
  'logistics-followup': { label: 'Logistics Follow-up', short: 'Logistics' },
  'review-call': { label: 'Review Call', short: 'Review' },
  'cancelled-recovery': { label: 'Cancelled Recovery', short: 'Recovery' },
  escalation: { label: 'Escalation', short: 'Escalate' },
};

export function taskStage(type?: string | null): LifecycleStage {
  return (type && TASK_STAGE[type]) || 'processing';
}

const STAGE_PATH: Record<string, string> = {
  confirmed_unprocessed: '/confirmed-unprocessed',
  collected_by_logistics: '/collected-by-logistics',
  shipped: '/shipped',
  pending_review: '/pending-review',
  customer_response: '/customer-response',
  vendor_response: '/vendor-response',
  cancelled: '/cancelled',
  hold: '/hold',
};

export function orderStagePath(orderId: string, workflowStage?: string | null): string {
  return `/orders/${orderId}${(workflowStage && STAGE_PATH[workflowStage]) || ''}`;
}

export const ORDER_STAGE_META: Record<string, { label: string; short: string }> = {
  pending_confirmation: { label: 'Awaiting Confirmation', short: 'Confirm' },
  confirmed_unprocessed: { label: 'Confirmed · Awaiting Pickup', short: 'Confirmed' },
  collected_by_logistics: { label: 'With Logistics', short: 'Logistics' },
  shipped: { label: 'Shipped', short: 'Shipped' },
  pending_review: { label: 'Pending Review', short: 'Review' },
  customer_response: { label: 'Return · Customer First', short: 'Return · Customer' },
  vendor_response: { label: 'Return · Vendor', short: 'Return · Vendor' },
  cancelled: { label: 'Cancelled · Recovery', short: 'Recovery' },
  rescheduled: { label: 'Rescheduled', short: 'Rescheduled' },
  hold: { label: 'Order On Hold', short: 'Hold' },
  done: { label: 'Delivered · Done', short: 'Done' },
  reviewed: { label: 'Reviewed', short: 'Reviewed' },
  other: { label: 'Uncategorised', short: 'Other' },
};

export function orderStageMeta(workflowStage?: string | null) {
  return (workflowStage && ORDER_STAGE_META[workflowStage]) || { label: 'Order', short: 'Order' };
}

export function workflowStageToQueue(workflowStage?: string | null): string {
  const map: Record<string, string> = {
    pending_confirmation: 'customer-confirmation',
    confirmed_unprocessed: 'vendor-call',
    collected_by_logistics: 'vendor-call',
    shipped: 'logistics-followup',
    pending_review: 'review-call',
    customer_response: 'cancelled-recovery',
    vendor_response: 'cancelled-recovery',
    cancelled: 'cancelled-recovery',
    hold: 'escalation',
    rescheduled: 'customer-confirmation',
    done: 'review-call',
    reviewed: 'review-call',
  };
  return map[workflowStage || ''] || 'customer-confirmation';
}