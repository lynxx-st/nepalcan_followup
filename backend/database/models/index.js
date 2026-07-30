const mongoose = require('mongoose');

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
  commerceOrderId: {
    type: String,
    required: true,
    unique: true,
  },
  orderId: {
    type: String,
    unique: true,
  },
  customer: {
    type: String,
  },
  customerPhone: {
    type: String,
  },
  vendor: {
    type: String,
  },
  vendorPhone: {
    type: String,
  },
  confirmationStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'no_answer', 'rescheduled'],
    default: 'pending',
  },
  vendorStatus: {
    type: String,
    enum: ['unassigned', 'assigned', 'accepted', 'delayed', 'fulfilled'],
    default: 'unassigned',
  },
  orderStatus: {
    type: String,
    default: 'Pending',
    index: true,
  },
  paymentStatus: {
    type: String,
    default: 'Pending',
    index: true,
  },
  paymentMethod: {
    type: String,
  },
  logisticsOrderId: {
    type: String,
  },
  externalLogisticsOrderId: {
    type: String,
  },
  externalHeavyLogisticsId: {
    type: String,
  },
  externalNonHeavyLogisticsId: {
    type: String,
  },
  pickupTicketId: {
    type: String,
  },
  externalDeliveryStatus: {
    type: String,
  },
  externalDeliveryEvent: {
    type: String,
  },
  orderType: {
    type: String,
  },
  branch: {
    type: mongoose.Schema.Types.Mixed,
  },
  sender: {
    type: mongoose.Schema.Types.Mixed,
  },
  receiver: {
    type: mongoose.Schema.Types.Mixed,
  },
  totalAmount: {
    type: Number,
    default: 0,
  },
  shippingAmount: {
    type: Number,
    default: 0,
  },
  unAttendedCount: {
    type: Number,
    default: 0,
  },
  additionalPickupTimeWindow: {
    type: Number,
  },
  coupon: {
    type: mongoose.Schema.Types.Mixed,
  },
  addedUser: {
    type: mongoose.Schema.Types.Mixed,
  },
  items: [
    {
      product: { type: mongoose.Schema.Types.Mixed },
      quantity: { type: Number },
      price: { type: Number },
      images: { type: mongoose.Schema.Types.Mixed, default: [] },
      variant: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
  ],
  vendorInfo: { type: mongoose.Schema.Types.Mixed },
  customerProfile: { type: mongoose.Schema.Types.Mixed },
  originBranch: { type: mongoose.Schema.Types.Mixed },
  destinationBranch: { type: mongoose.Schema.Types.Mixed },
  shippingType: { type: String },
  dispatchMode: { type: String },
  shippingAddress: { type: mongoose.Schema.Types.Mixed },
  deliveryChargeBreakdown: { type: mongoose.Schema.Types.Mixed },
  cancelledBy: { type: String },
  cancelledReason: { type: String },
  statusHistory: [{ type: mongoose.Schema.Types.Mixed }],
  rawApiData: { type: mongoose.Schema.Types.Mixed },
  lastSyncedAt: {
    type: Date,
    default: Date.now,
  },
  lastSyncChanges: {
    type: String,
  },
  externalUpdatedAt: {
    type: Date,
  },
  notes: [
    {
      actor: { type: String },
      note: { type: String },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  scheduledAt: {
    type: Date,
  },
  synced: {
    type: Boolean,
    default: true,
  },
  source: {
    type: String,
    enum: ['commerce-api'],
    default: 'commerce-api',
  },
}, {
  timestamps: true,
  collection: 'commerce_orders',
});

CommerceOrderSchema.index({ commerceOrderId: 1 });
CommerceOrderSchema.index({ orderStatus: 1, paymentStatus: 1 });
CommerceOrderSchema.index({ createdAt: -1 });
CommerceOrderSchema.index({ customer: 1 });
CommerceOrderSchema.index({ vendor: 1 });

const AdminSchema = new mongoose.Schema({
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
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLoginAt: Date,
}, {
  timestamps: true,
  collection: 'admins',
});

AdminSchema.index({ email: 1 }, { unique: true });

const defaultSettings = {
  logisticsFollowupHours: { value: 6, description: 'Hours after which a Processing order with no logistics pickup gets a followup task' },
  logisticsFollowupSlaMinutes: { value: 120, description: 'SLA in minutes for logistics followup tasks' },
  customerConfirmationSlaMinutes: { value: 30, description: 'SLA in minutes for customer confirmation tasks' },
  vendorCallSlaMinutes: { value: 120, description: 'SLA in minutes for vendor call tasks' },
  cancelledRecoverySlaMinutes: { value: 15, description: 'SLA in minutes for cancelled recovery tasks' },
  reviewCallSlaMinutes: { value: 1440, description: 'SLA in minutes for review call tasks (24h)' },
  escalationSlaMinutes: { value: 10, description: 'SLA in minutes for escalation tasks' },
  priorityAmountThreshold: { value: 1000, description: 'Orders above this Rs amount get priority bumped one level' },
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

const Setting = mongoose.model('Setting', SettingSchema);

const models = {
  Task: mongoose.model('Task', TaskSchema),
  TaskRule: mongoose.model('TaskRule', TaskRuleSchema),
  TaskTimeline: mongoose.model('TaskTimeline', TaskTimelineSchema),
  CallLog: mongoose.model('CallLog', CallLogSchema),
  RecoveryCampaign: mongoose.model('RecoveryCampaign', RecoveryCampaignSchema),
  CommerceOrder: mongoose.model('CommerceOrder', CommerceOrderSchema),
  Admin: mongoose.model('Admin', AdminSchema),
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