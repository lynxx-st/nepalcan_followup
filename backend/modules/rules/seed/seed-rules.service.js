const { TaskRule } = require('../../../database/models');

const defaultRules = [
  {
    name: 'New Order — Customer Confirmation',
    description: 'Reach out to customer to confirm new order',
    trigger: 'order.created',
    condition: { status: 'pending' },
    taskType: 'customer-confirmation',
    priority: 'high',
    slaMinutes: 30,
    delayHours: 0,
    active: true,
  },
  {
    name: 'Customer Confirmed — Vendor Call',
    description: 'Call vendor to process confirmed order',
    trigger: 'order.status.changed',
    condition: { status: 'processing' },
    taskType: 'vendor-call',
    priority: 'medium',
    slaMinutes: 120,
    delayHours: 0,
    active: true,
  },
  {
    name: 'Vendor Delay — Follow Up',
    description: 'Vendor hasn\'t processed — escalate',
    trigger: 'order.status.changed',
    condition: { status: 'processing' },
    taskType: 'vendor-delay',
    priority: 'high',
    slaMinutes: 60,
    delayHours: 24,
    active: true,
  },
  {
    name: 'Order Cancelled — Recovery',
    description: 'Attempt to recover cancelled order',
    trigger: 'order.cancelled',
    condition: { status: 'cancelled' },
    taskType: 'cancelled-recovery',
    priority: 'critical',
    slaMinutes: 15,
    delayHours: 0,
    active: true,
  },
  {
    name: 'Delivered — Review Call',
    description: 'Follow up for review and feedback',
    trigger: 'order.delivered',
    condition: { status: 'delivered' },
    taskType: 'review-call',
    priority: 'low',
    slaMinutes: 1440,
    delayHours: 72,
    active: true,
  },
  {
    name: 'Escalation for Stuck Orders',
    description: 'Escalate orders that are stuck',
    trigger: 'order.status.changed',
    condition: { newStatus: 'stuck' },
    taskType: 'escalation',
    priority: 'critical',
    slaMinutes: 10,
    delayHours: 0,
    active: true,
  },
];

async function seedTaskRules() {
  let count = 0;
  for (const rule of defaultRules) {
    const existing = await TaskRule.findOne({ name: rule.name });
    if (existing) {
      console.log(`  SKIP  ${rule.name}`);
      continue;
    }
    await TaskRule.create(rule);
    console.log(`  SEED  ${rule.name}`);
    count++;
  }
  console.log(`\nSeeded ${count} new rule(s)`);
  return count;
}

module.exports = seedTaskRules;
