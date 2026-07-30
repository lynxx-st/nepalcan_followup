export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';

export type CustomerConfirmationStatus = 'pending' | 'confirmed' | 'rejected' | 'no_answer' | 'rescheduled';

export type VendorStatus = 'unassigned' | 'assigned' | 'accepted' | 'delayed' | 'fulfilled';

export type TaskQueue = 
  | 'customer_confirmation' 
  | 'vendor_action' 
  | 'vendor_delay' 
  | 'cancelled_recovery' 
  | 'review_calls' 
  | 'escalations';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  city: string;
  address: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: 'COD' | 'Paid' | 'Pending';
  createdAt: string; // ISO string
  updatedAt: string;
  confirmationStatus: CustomerConfirmationStatus;
  vendorName?: string;
  vendorPhone?: string;
  vendorStatus: VendorStatus;
  vendorAcceptedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  rating?: number;
  reviewNotes?: string;
}

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
  reason: string; // "Why this task exists"
  priority: TaskPriority;
  priorityScore: number;
  status: TaskStatus;
  assignedTo: string; // Agent name
  slaMinutes: number;
  createdAt: string; // ISO string
  dueAt: string;     // ISO string
  completedAt?: string;
  completedBy?: string;
  outcome?: string;
  outcomeNotes?: string;
  timeline: TaskTimelineEvent[];
}

export interface FollowUpRule {
  id: string;
  name: string;
  description: string;
  triggerCondition: {
    orderStatus?: OrderStatus | 'any';
    confirmationStatus?: CustomerConfirmationStatus | 'any';
    vendorStatus?: VendorStatus | 'any';
    timeAfterHours: number; // e.g. 24
  };
  action: {
    createQueue: TaskQueue;
    priority: TaskPriority;
    slaMinutes: number;
    reasonTemplate: string;
  };
  enabled: boolean;
  tasksGeneratedCount: number;
}

export interface RecoveryRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  taskId: string;
  cancellationReason: string;
  offeredIncentive: string; // e.g. "10% Discount Coupon (NEPAL10)", "Free Shipping"
  outcome: 'pending' | 'recovered' | 'lost';
  revenueAmount: number; // in NPR
  createdAt: string;
  resolvedAt?: string;
  notes?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  callsCompletedToday: number;
  avgCallDurationSec: number;
  confirmationRate: number; // percentage e.g. 88
  vendorAcceptanceRate: number; // percentage
  recoveryRate: number; // percentage
  reviewCollectionRate: number; // percentage
  activeTasksCount: number;
}

export interface OneClickOutcomeOption {
  id: string;
  label: string;
  iconName: string;
  queue: TaskQueue;
  outcomeType: 'confirm' | 'reject' | 'no_answer' | 'reschedule' | 'vendor_accept' | 'vendor_delay' | 'recovered' | 'lost' | 'review_collected' | 'escalate';
  newOrderStatus?: OrderStatus;
  newConfirmationStatus?: CustomerConfirmationStatus;
  newVendorStatus?: VendorStatus;
  autoNextTask?: boolean;
}
