const mongoose = require('mongoose');
const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');
const commerceAuth = require('../../modules/commerce/service/commerce.auth.service');

// Fetch branch lists per delivery-zone-group from the commerce API once, at
// seed time. Snapshot design: mapping goes stale only if commerce changes
// groups — re-seed (delete the settings row) to refresh.
async function fetchDeliveryZoneGroups(seedValue) {
  try {
    const token = await commerceAuth.getToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const base = String(config.commerceApiBase).replace(/\/marketplace-orders$/, '');
    const groups = [];
    let page = 1;
    while (page <= 10) {
      const response = await axios.get(`${base}/delivery-zone-group/list?active=true&page=${page}&limit=100`, { headers, timeout: 15000 });
      const items = (response.data && response.data.data) || [];
      if (items.length === 0) break;
      groups.push(...items);
      if (items.length < 100) break;
      page++;
    }
    return (seedValue || []).map((tier) => {
      const group = groups.find((g) => String(g._id) === String(tier.zoneGroupId));
      if (!group) return tier;
      const branches = [...new Set((group.branches || [])
        .map((b) => String((b && b.name) || '').trim().toUpperCase())
        .filter(Boolean))];
      return { ...tier, branches };
    });
  } catch (err) {
    logger.warn('Failed to fetch delivery zone groups at seed, seeding empty lists', { error: err.message });
    return seedValue || [];
  }
}

const TaskSchema = new mongoose.Schema({
  taskNumber: {
    type: String,
    unique: true,
  },
  orderId: {
    type: String,
  },
  orderNumber: {
    type: String,
  },
  type: {
    type: String,
    enum: [
      'customer-confirmation',
      'vendor-call',
      'vendor-delay',
      'cancelled-recovery',
      'review-call',
      'escalation',
      'logistics-followup',
    ],
    required: true,
    index: true,
  },
  assigneeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  assigneeName: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'skipped', 'overdue'],
    default: 'pending',
    index: true,
  },
  priority: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium',
    index: true,
  },
  customerPhone: {
    type: String,
  },
  vendorPhone: {
    type: String,
  },
  reason: {
    type: String,
    required: true,
  },
  sourceOrder: {
    type: mongoose.Schema.Types.Mixed,
  },
  slaMinutes: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  dueAt: {
    type: Date,
  },
  scheduledAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  notes: [
    {
      actor: {
        type: String,
        enum: ['system', 'customer', 'vendor', 'admin', 'staff'],
      },
      note: {
        type: String,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
}, {
  timestamps: true,
  collection: 'tasks',
});

TaskSchema.index({ assigneeId: 1, status: 1, priority: 1 });
TaskSchema.index({ type: 1, status: 1 });
TaskSchema.index({ orderId: 1, type: 1 });
TaskSchema.index({ dueAt: 1, status: 1 });

TaskSchema.pre('save', function (next) {
  if (!this.taskNumber) {
    const prefix = 'TKN';
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.taskNumber = `${prefix}-${ts}-${rand}`;
  }
  if (this.slaMinutes > 0 && !this.dueAt) {
    this.dueAt = new Date(Date.now() + this.slaMinutes * 60000);
  }
  next();
});

const TaskRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  trigger: {
    type: String,
    enum: [
      'order.created',
      'order.status.changed',
      'order.payment.completed',
      'order.delivered',
      'order.cancelled',
      'customer.confirmed',
      'vendor.accepted',
      'vendor.rejected',
      'commerce.order.synced',
    ],
    required: true,
  },
  condition: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  delayHours: {
    type: Number,
    default: 0,
  },
  taskType: {
    type: String,
    enum: [
      'customer-confirmation',
      'vendor-call',
      'vendor-delay',
      'cancelled-recovery',
      'review-call',
      'escalation',
      'logistics-followup',
    ],
    required: true,
  },
  priority: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium',
  },
  slaMinutes: {
    type: Number,
    default: 0,
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  collection: 'task_rules',
});

const TaskTimelineSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true,
  },
  status: {
    type: String,
    required: true,
  },
  actor: {
    type: String,
    enum: ['system', 'customer', 'vendor', 'admin', 'staff'],
    required: true,
  },
  note: {
    type: String,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
  collection: 'task_timeline',
});

TaskTimelineSchema.index({ taskId: 1, createdAt: -1 });

const CallLogSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  outcome: {
    type: String,
    enum: [
      'customer-confirmed',
      'no-answer',
      'wrong-number',
      'call-later',
      'requested-tomorrow',
      'vendor-accepted',
      'vendor-rejected',
      'vendor-delayed',
      'recovered',
      'lost',
      'other',
    ],
  },
  durationMinutes: {
    type: Number,
    default: 0,
  },
  notes: {
    type: String,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
  collection: 'call_logs',
});

const RecoveryCampaignSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  orderNumber: {
    type: String,
  },
  commerceOrderId: {
    type: String,
    unique: true,
    sparse: true,
  },
  customerName: {
    type: String,
  },
  customerPhone: {
    type: String,
  },
  revenueAmount: {
    type: Number,
    default: 0,
  },
  cancellationReason: {
    type: String,
    required: true,
  },
  steps: [
    {
      action: {
        type: String,
        required: true,
      },
      outcome: {
        type: String,
        enum: ['success', 'failed', 'pending', 'skipped'],
        default: 'pending',
      },
      note: {
        type: String,
      },
      completedAt: {
        type: Date,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  outcome: {
    type: String,
    enum: ['recovered', 'lost', 'in-progress'],
    default: 'in-progress',
  },
  recoveredRevenue: {
    type: Number,
    default: 0,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  collection: 'recovery_campaigns',
});

RecoveryCampaignSchema.index({ outcome: 1 });
RecoveryCampaignSchema.index({ cancellationReason: 1 });

const CommerceOrderSchema = new mongoose.Schema({
  // ── Identity (Primary Keys) ──
  commerceOrderId: {
    type: String,
    required: true,
    unique: true,
  },
  orderId: {
    type: String,
    unique: true,
  },

  // ── Workflow (Computed, Indexed) ──
  workflowStage: {
    type: String,
    enum: ['pending_confirmation', 'pending_review', 'confirmed_unprocessed', 'done', 'rescheduled', 'customer_response', 'vendor_response', 'other'],
    default: 'other',
  },
  workflowPriority: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium',
  },
  workflowUpdatedAt: { type: Date, default: Date.now },

  // ── Contact Tracking ──
  customerCalledAt: { type: Date },
  customerCallCount: { type: Number, default: 0 },
  vendorCalledAt: { type: Date },
  vendorCallCount: { type: Number, default: 0 },
  reviewCalledAt: { type: Date },
  reviewCallCount: { type: Number, default: 0 },
  review: String,

  // ── Assignment (RBAC) ──
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  assignedAt: { type: Date },
  branch: { type: String },
  team: { type: String },
  deliveryZone: { type: String, enum: ['same-city', 'major', 'third-tier', 'other'], default: 'other' },

  // ── Delivery SLA (two windows: order creation, pickup collected) ──
  sla: {
    slaCreatedAt: { type: Date },
    slaPickupAt: { type: Date },
    deadlineA: { type: Date },
    deadlineB: { type: Date },
    slaDeliveryDeadline: { type: Date },
    slaStatus: { type: String, enum: ['pending', 'ok', 'breached'], default: 'pending' },
  },

  // ── Delivery Time Tracking (created → delivered) ──
  externalCreatedAt: { type: Date },
  deliveredAt: { type: Date, index: true },
  timeToDeliveryMs: { type: Number },

  // ── Customer ──
  customer: {
    name: String,
    phone: String,
    email: String,
    profile: mongoose.Schema.Types.Mixed,
    confirmationStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected', 'no_answer', 'rescheduled'],
      default: 'pending',
    },
    calledAt: Date,
    callCount: { type: Number, default: 0 },
  },

  // ── Vendor ──
  vendor: {
    name: String,
    phone: String,
    email: String,
    info: mongoose.Schema.Types.Mixed,
    vendorStatus: {
      type: String,
      enum: ['unassigned', 'assigned', 'accepted', 'delayed', 'fulfilled', 'rescheduled'],
      default: 'unassigned',
    },
    calledAt: Date,
    callCount: { type: Number, default: 0 },
  },

  // ── Commerce Data (Denormalized from API) ──
  commerce: {
    orderStatus: { type: String, index: true, default: 'Pending' },
    paymentStatus: { type: String, index: true, default: 'Pending' },
    paymentMethod: String,
    deliveryStatus: String,
    deliveryEvent: String,
    orderType: String,
    branch: String,
    sender: mongoose.Schema.Types.Mixed,
    receiver: mongoose.Schema.Types.Mixed,
    destinationBranch: mongoose.Schema.Types.Mixed,
    totalAmount: { type: Number, default: 0 },
    shippingAmount: { type: Number, default: 0 },
    unAttendedCount: { type: Number, default: 0 },
    additionalPickupTimeWindow: Number,
    coupon: mongoose.Schema.Types.Mixed,
    addedUser: mongoose.Schema.Types.Mixed,
    items: [
      {
        product: { type: mongoose.Schema.Types.Mixed },
        quantity: { type: Number },
        price: { type: Number },
        images: { type: mongoose.Schema.Types.Mixed, default: [] },
        variant: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],
    logisticsOrderId: String,
    externalLogisticsOrderId: String,
    externalHeavyLogisticsId: String,
    externalNonHeavyLogisticsId: String,
    pickupTicketId: String,
    originBranch: mongoose.Schema.Types.Mixed,
    destinationBranch: mongoose.Schema.Types.Mixed,
    shippingType: String,
    dispatchMode: String,
    shippingAddress: mongoose.Schema.Types.Mixed,
    deliveryChargeBreakdown: mongoose.Schema.Types.Mixed,
    cancelledBy: String,
    cancelledReason: String,
  },

  // ── System ──
  rawApiData: { type: mongoose.Schema.Types.Mixed, select: false },
  lastSyncedAt: { type: Date, index: true, default: Date.now },
  externalUpdatedAt: { type: Date },
  synced: { type: Boolean, default: true },
  source: { type: String, default: 'commerce-api' },
  scheduledAt: Date,

  // ── Enhanced Audit Trail ──
  statusHistory: [{
    field: String,
    from: mongoose.Schema.Types.Mixed,
    to: mongoose.Schema.Types.Mixed,
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    actorName: String,
    changedAt: { type: Date, default: Date.now },
    source: String,
    comment: String,
    metadata: mongoose.Schema.Types.Mixed,
  }],

  // ── Logistics Timeline (from external API) ──
  externalStatusHistory: [{
    event: String,
    status: String,
    rawPayload: mongoose.Schema.Types.Mixed,
    receivedAt: Date,
  }],
  externalLogisticsOrderId: String,

  // ── Structured Review ──
  review: {
    text: String,
    platformSatisfied: { type: String, enum: ['yes', 'no', 'other'] },
    platformSatisfiedOther: String,
    deliverySatisfied: { type: String, enum: ['yes', 'no', 'other'] },
    deliverySatisfiedOther: String,
    willUseAgain: { type: String, enum: ['yes', 'no', 'other'] },
    willUseAgainOther: String,
    submittedAt: Date,
  },

  notes: [{
    actor: { type: String, enum: ['system', 'customer', 'vendor', 'admin', 'staff'] },
    actorName: String,
    note: String,
    createdAt: { type: Date, default: Date.now },
  }],
}, {
  timestamps: true,
  collection: 'commerce_orders',
});

// ── Indexes ──
CommerceOrderSchema.index({ workflowStage: 1, workflowPriority: -1, createdAt: -1 });
CommerceOrderSchema.index({ branch: 1, workflowStage: 1, workflowPriority: -1, createdAt: -1 });
CommerceOrderSchema.index({ assignedTo: 1, workflowStage: 1, workflowPriority: -1 });
CommerceOrderSchema.index({ team: 1, workflowStage: 1 });
CommerceOrderSchema.index({ workflowStage: 1, workflowUpdatedAt: 1 });
CommerceOrderSchema.index({ 'commerce.orderStatus': 1, 'customer.confirmationStatus': 1, 'vendor.vendorStatus': 1 });
CommerceOrderSchema.index({ 'customer.name': 1, 'customer.phone': 1 });
CommerceOrderSchema.index({ 'sla.slaStatus': 1, 'sla.slaDeliveryDeadline': 1 });

const AdminSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['super-admin', 'admin', 'manager', 'staff'],
    default: 'staff',
  },
  branches: [{ type: String }],
  team: { type: String },
  isActive: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  lastLoginAt: Date,
}, {
  timestamps: true,
  collection: 'admins',
});

const defaultSettings = {
  logisticsFollowupHours: { value: 6, description: 'Hours after which a Processing order with no logistics pickup gets a followup task' },
  logisticsFollowupSlaMinutes: { value: 120, description: 'SLA in minutes for logistics followup tasks' },
  customerConfirmationSlaMinutes: { value: 30, description: 'SLA in minutes for customer confirmation tasks' },
  vendorCallSlaMinutes: { value: 120, description: 'SLA in minutes for vendor call tasks' },
  cancelledRecoverySlaMinutes: { value: 15, description: 'SLA in minutes for cancelled recovery tasks' },
  reviewCallSlaMinutes: { value: 1440, description: 'SLA in minutes for review call tasks (24h)' },
  reviewFollowupDelayHours: { value: 24, description: 'Hours after an order is Delivered before it appears in Pending Review calls' },
  returnCustomerResponseSlaMinutes: { value: 60, description: 'SLA in minutes for return customer response tasks' },
  returnVendorResponseSlaMinutes: { value: 120, description: 'SLA in minutes for return vendor response tasks' },
  escalationSlaMinutes: { value: 10, description: 'SLA in minutes for escalation tasks' },
  priorityAmountThreshold: { value: 1000, description: 'Orders above this Rs amount get priority bumped one level' },
  deliveryZones: {
    value: [
      { key: 'same-city', label: 'Inside Valley / Same city', slaHours: 24, zoneGroupId: '69d72c4f74fde1d06b5a7a69', branches: [] },
      { key: 'major', label: 'To Major Cities', slaHours: 48, zoneGroupId: '69d72c7c74fde1d06b5a7aab', branches: [] },
      { key: 'third-tier', label: 'Except Major city', slaHours: 72, zoneGroupId: '69d7253174fde1d06b5a5970', branches: [] },
    ],
    description: 'Delivery zones: zoneGroupId maps each tier to a commerce delivery-zone-group; branches are refreshed from the commerce API on sync. destinationBranch name matched against each tier in order.',
  },
};

const SettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  description: {
    type: String,
  },
}, {
  timestamps: true,
  collection: 'settings',
});

async function seedSettings() {
  const zoneDef = defaultSettings.deliveryZones;
  if (zoneDef) {
    const existing = await mongoose.model('Setting').findOne({ key: 'deliveryZones' });
    const allEmpty = !existing || !Array.isArray(existing.value) ||
      existing.value.every((t) => !Array.isArray(t.branches) || t.branches.length === 0);
    if (allEmpty) {
      zoneDef.value = await fetchDeliveryZoneGroups(zoneDef.value);
    }
  }
  for (const [key, def] of Object.entries(defaultSettings)) {
    await mongoose.model('Setting').findOneAndUpdate(
      { key },
      { $setOnInsert: { key, value: def.value, description: def.description } },
      { upsert: true }
    );
  }
  console.log('Settings seeded');
}

const connectDatabase = async (connectionString, options = {}) => {
  const defaultOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
  };

  try {
    await mongoose.connect(connectionString, { ...defaultOptions, ...options });
    console.log('Follow-up engine database connected');

    mongoose.connection.on('error', (err) => {
      console.error('Database connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('Database disconnected');
    });

    return mongoose.connection;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
};

const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    console.log('Database disconnected');
  } catch (error) {
    console.error('Error disconnecting:', error);
    throw error;
  }
};

const UserAttendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true,
  },
  userName: String,
  userEmail: String,
  checkInTime: {
    type: Date,
    default: Date.now,
    required: true,
  },
  checkOutTime: Date,
  status: {
    type: String,
    enum: ['checked-in', 'checked-out'],
    default: 'checked-in',
    index: true,
  },
  durationMinutes: {
    type: Number,
    default: 0,
  },
  notes: String,
}, {
  timestamps: true,
  collection: 'user_attendance',
});

UserAttendanceSchema.index({ userId: 1, status: 1 });
UserAttendanceSchema.index({ userId: 1, createdAt: -1 });

const OrderReturnSchema = new mongoose.Schema({
  externalReturnId: { type: String, unique: true },
  commerceOrderId: String,
  orderId: String,
  order: mongoose.Schema.Types.Mixed,
  vendor: mongoose.Schema.Types.Mixed,
  customerProfile: mongoose.Schema.Types.Mixed,
  customerPhone: String,
  items: [mongoose.Schema.Types.Mixed],
  returnReason: String,
  type: String,
  attachments: [mongoose.Schema.Types.Mixed],
  status: String,
  superAdminStatus: String,
  rejectReason: String,
  concernReason: String,
  customerResponseStatus: { type: String, default: 'pending' },
  vendorResponseStatus: { type: String, default: 'pending' },
  workflowStage: { type: String, default: 'customer_response' },
  isActive: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date,
}, { timestamps: true, collection: 'order_returns' });

OrderReturnSchema.index({ externalReturnId: 1 });
OrderReturnSchema.index({ workflowStage: 1 });

const Setting = mongoose.model('Setting', SettingSchema);

const models = {
  Task: mongoose.model('Task', TaskSchema),
  TaskRule: mongoose.model('TaskRule', TaskRuleSchema),
  TaskTimeline: mongoose.model('TaskTimeline', TaskTimelineSchema),
  CallLog: mongoose.model('CallLog', CallLogSchema),
  RecoveryCampaign: mongoose.model('RecoveryCampaign', RecoveryCampaignSchema),
  CommerceOrder: mongoose.model('CommerceOrder', CommerceOrderSchema),
  OrderReturn: mongoose.model('OrderReturn', OrderReturnSchema),
  Admin: mongoose.model('Admin', AdminSchema),
  UserAttendance: mongoose.model('UserAttendance', UserAttendanceSchema),
  Setting,
};

module.exports = {
  ...models,
  mongoose,
  connectDatabase,
  disconnectDatabase,
  seedSettings,
  defaultSettings,
};