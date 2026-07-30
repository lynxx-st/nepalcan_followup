import React, { useState, useEffect } from 'react';
import {
  Zap,
  PhoneCall,
  Clock,
  User,
  MapPin,
  ShoppingBag,
  History,
  CheckCircle2,
  XCircle,
  PhoneOff,
  Calendar,
  Tag,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  HelpCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import { Task, Order, Agent, TaskQueue, CustomerConfirmationStatus, OrderStatus } from '../types';
import { getSLAInfo, QUEUE_CONFIG } from '../utils/ruleEngine';

interface NextCallModeProps {
  tasks: Task[];
  orders: Order[];
  currentAgent: Agent;
  simulatedTimeIso: string;
  initialQueue?: TaskQueue;
  initialTaskId?: string;
  onCompleteTaskAndNext: (
    taskId: string,
    outcome: string,
    note?: string,
    newOrderStatus?: OrderStatus,
    newConfirmationStatus?: CustomerConfirmationStatus
  ) => void;
  onExitNextCall: () => void;
}

export const NextCallMode: React.FC<NextCallModeProps> = ({
  tasks,
  orders,
  currentAgent,
  simulatedTimeIso,
  initialQueue,
  initialTaskId,
  onCompleteTaskAndNext,
  onExitNextCall,
}) => {
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<TaskQueue | 'all'>(
    initialQueue || 'all'
  );
  const [customNote, setCustomNote] = useState<string>('');
  const [showOtherInput, setShowOtherInput] = useState<boolean>(false);
  const [lastLoggedOutcome, setLastLoggedOutcome] = useState<string | null>(null);

  // Find eligible pending tasks
  const pendingTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'dismissed');

  const queueFilteredTasks = pendingTasks.filter((t) => {
    if (selectedQueueFilter !== 'all') return t.queue === selectedQueueFilter;
    return true;
  });

  // Sort by highest priorityScore
  const sortedTasks = [...queueFilteredTasks].sort((a, b) => b.priorityScore - a.priorityScore);

  // Active task to execute
  const currentTask = initialTaskId
    ? pendingTasks.find((t) => t.id === initialTaskId) || sortedTasks[0]
    : sortedTasks[0];

  const currentOrder = currentTask ? orders.find((o) => o.id === currentTask.orderId) : null;

  useEffect(() => {
    setCustomNote('');
    setShowOtherInput(false);
  }, [currentTask?.id]);

  if (!currentTask || !currentOrder) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            All Calls Completed in Queue!
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto text-sm">
            Great job! You have cleared all prioritized tasks in this queue. Switch queues or fast-forward simulated time to check for newly generated tasks.
          </p>
        </div>
        <button
          onClick={onExitNextCall}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all cursor-pointer"
        >
          Return to Today's Dashboard
        </button>
      </div>
    );
  }

  const sla = getSLAInfo(currentTask.dueAt, simulatedTimeIso);
  const qConfig = QUEUE_CONFIG[currentTask.queue];

  const handleApplyOutcome = (
    outcomeLabel: string,
    newOrderStatus?: OrderStatus,
    newConfirmationStatus?: CustomerConfirmationStatus
  ) => {
    const note = customNote.trim() ? customNote : outcomeLabel;
    setLastLoggedOutcome(outcomeLabel);

    onCompleteTaskAndNext(currentTask.id, outcomeLabel, note, newOrderStatus, newConfirmationStatus);

    setTimeout(() => {
      setLastLoggedOutcome(null);
    }, 2500);
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      {/* Top Status Header */}
      <div className="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 flex items-center justify-center font-bold text-white shadow-md animate-pulse">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base uppercase tracking-wider text-amber-400">
                NEXT CALL MODE ⚡
              </span>
              <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full font-mono">
                {sortedTasks.length} Remaining in Queue
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Auto-advancing upon action • Logged in as {currentAgent.name}
            </p>
          </div>
        </div>

        {/* Queue Filter Dropdown & Exit */}
        <div className="flex items-center gap-3">
          <select
            value={selectedQueueFilter}
            onChange={(e) => setSelectedQueueFilter(e.target.value as TaskQueue | 'all')}
            className="bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="all">All Queues</option>
            <option value="customer_confirmation">📞 Customer Confirmation</option>
            <option value="vendor_action">🏪 Vendor Action</option>
            <option value="vendor_delay">⏳ Vendor Delay</option>
            <option value="cancelled_recovery">❌ Cancelled Recovery</option>
            <option value="review_calls">⭐ Review Calls</option>
            <option value="escalations">⚠ Escalations</option>
          </select>

          <button
            onClick={onExitNextCall}
            className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            Exit Next Call
          </button>
        </div>
      </div>

      {/* Success Toast Notification when advancing */}
      {lastLoggedOutcome && (
        <div className="bg-emerald-600 text-white font-bold px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Task Logged: "{lastLoggedOutcome}". Loading Next Task...</span>
          </div>
          <Sparkles className="w-5 h-5 text-yellow-300 animate-spin" />
        </div>
      )}

      {/* Main Call Workspace Card (#12) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Call Details & One-Click Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            {/* Call Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 border-b border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${qConfig.badgeBg}`}>
                  {qConfig.label}
                </span>

                <div className="flex items-center gap-2">
                  <span className="bg-slate-800 text-amber-300 font-mono font-bold text-xs px-2.5 py-1 rounded border border-amber-400/30">
                    Priority Score: {currentTask.priorityScore}
                  </span>
                  <span className={`text-xs font-extrabold px-3 py-1 rounded-lg border ${sla.badgeColor}`}>
                    ⏱ {sla.displayText}
                  </span>
                </div>
              </div>

              {/* Customer Phone & Dial Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div>
                  <div className="text-xs text-indigo-300 font-medium">CUSTOMER DETAILS</div>
                  <h2 className="text-2xl font-black text-white flex items-center gap-2">
                    <span>{currentOrder.customerName}</span>
                    <span className="text-sm font-normal text-slate-400">({currentOrder.orderNumber})</span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    📍 {currentOrder.address}, {currentOrder.city}
                  </p>
                </div>

                {/* Call Phone Button */}
                <a
                  href={`tel:${currentOrder.customerPhone}`}
                  className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base px-5 py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                >
                  <PhoneCall className="w-5 h-5 fill-slate-950 text-slate-950" />
                  <span>{currentOrder.customerPhone}</span>
                </a>
              </div>
            </div>

            {/* Task Reason Section (#4) */}
            <div className="p-5 bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-500/20 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                <span>TASK REASON (Why this task exists)</span>
              </div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200 leading-relaxed">
                {currentTask.reason}
              </p>
            </div>

            {/* One-Click Action Buttons Section (#7) */}
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wide flex items-center gap-2">
                  <span>⚡ ONE-CLICK LOGOUTCOME</span>
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    (Clicking advances to next task)
                  </span>
                </h3>
              </div>

              {/* Contextual Buttons by Queue */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Customer Confirmation Queue */}
                {currentTask.queue === 'customer_confirmation' && (
                  <>
                    <ActionButton
                      label="✓ Customer Confirmed"
                      color="bg-emerald-600 hover:bg-emerald-500 text-white"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={() =>
                        handleApplyOutcome('Customer Confirmed', 'processing', 'confirmed')
                      }
                    />
                    <ActionButton
                      label="📞 Call Later"
                      color="bg-amber-600 hover:bg-amber-500 text-white"
                      icon={<Clock className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Call Later / Busy')}
                    />
                    <ActionButton
                      label="📵 No Answer"
                      color="bg-slate-700 hover:bg-slate-600 text-white"
                      icon={<PhoneOff className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('No Answer')}
                    />
                    <ActionButton
                      label="❌ Customer Rejected"
                      color="bg-rose-600 hover:bg-rose-500 text-white"
                      icon={<XCircle className="w-4 h-4" />}
                      onClick={() =>
                        handleApplyOutcome('Customer Rejected', 'cancelled', 'rejected')
                      }
                    />
                    <ActionButton
                      label="📅 Requested Tomorrow"
                      color="bg-indigo-600 hover:bg-indigo-500 text-white"
                      icon={<Calendar className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Requested Tomorrow Delivery')}
                    />
                    <ActionButton
                      label="⚠️ Wrong Number"
                      color="bg-slate-800 hover:bg-slate-700 text-slate-200"
                      icon={<AlertTriangle className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Wrong Number')}
                    />
                  </>
                )}

                {/* Cancelled Recovery Queue */}
                {currentTask.queue === 'cancelled_recovery' && (
                  <>
                    <ActionButton
                      label="🏷️ Offered 10% Coupon"
                      color="bg-purple-600 hover:bg-purple-500 text-white"
                      icon={<Tag className="w-4 h-4" />}
                      onClick={() =>
                        handleApplyOutcome('Offered 10% Discount Coupon (NEPAL10)')
                      }
                    />
                    <ActionButton
                      label="🎉 Recovered Order!"
                      color="bg-emerald-600 hover:bg-emerald-500 text-white"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={() =>
                        handleApplyOutcome('Order Recovered Successfully', 'processing', 'confirmed')
                      }
                    />
                    <ActionButton
                      label="🚚 Upgraded to Express"
                      color="bg-blue-600 hover:bg-blue-500 text-white"
                      icon={<Zap className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Upgraded Same-Day Express Dispatch')}
                    />
                    <ActionButton
                      label="🔒 Lost / Unrecoverable"
                      color="bg-slate-700 hover:bg-slate-600 text-white"
                      icon={<XCircle className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Marked as Unrecoverable Lost')}
                    />
                  </>
                )}

                {/* Vendor Delay / Action Queue */}
                {(currentTask.queue === 'vendor_delay' || currentTask.queue === 'vendor_action') && (
                  <>
                    <ActionButton
                      label="✓ Vendor Reminded"
                      color="bg-blue-600 hover:bg-blue-500 text-white"
                      icon={<PhoneCall className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Vendor Reminded & Dispatched')}
                    />
                    <ActionButton
                      label="✓ Vendor Accepted"
                      color="bg-emerald-600 hover:bg-emerald-500 text-white"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Vendor Accepted Dispatch', 'processing')}
                    />
                    <ActionButton
                      label="⚠️ Vendor Delayed 24h"
                      color="bg-amber-600 hover:bg-amber-500 text-white"
                      icon={<Clock className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Vendor Stock Delay Confirmed')}
                    />
                    <ActionButton
                      label="🔥 Escalated to Lead"
                      color="bg-rose-600 hover:bg-rose-500 text-white"
                      icon={<AlertTriangle className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Escalated to Supervisor')}
                    />
                  </>
                )}

                {/* Review Calls Queue */}
                {currentTask.queue === 'review_calls' && (
                  <>
                    <ActionButton
                      label="⭐ 5-Star Review Recorded"
                      color="bg-yellow-600 hover:bg-yellow-500 text-white"
                      icon={<Sparkles className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Collected 5-Star Review')}
                    />
                    <ActionButton
                      label="📝 Feedback Recorded"
                      color="bg-blue-600 hover:bg-blue-500 text-white"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Recorded Customer Feedback')}
                    />
                    <ActionButton
                      label="⚠️ Issue Reported"
                      color="bg-rose-600 hover:bg-rose-500 text-white"
                      icon={<AlertTriangle className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Customer Reported Product Issue')}
                    />
                  </>
                )}

                {/* Escalations Queue */}
                {currentTask.queue === 'escalations' && (
                  <>
                    <ActionButton
                      label="✓ Issue Resolved"
                      color="bg-emerald-600 hover:bg-emerald-500 text-white"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Escalated Issue Resolved')}
                    />
                    <ActionButton
                      label="🏷️ Refund / Discount Approved"
                      color="bg-indigo-600 hover:bg-indigo-500 text-white"
                      icon={<Tag className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('Refund Voucher Approved')}
                    />
                    <ActionButton
                      label="📵 No Response"
                      color="bg-slate-700 hover:bg-slate-600 text-white"
                      icon={<PhoneOff className="w-4 h-4" />}
                      onClick={() => handleApplyOutcome('No Response to Escalation Call')}
                    />
                  </>
                )}
              </div>

              {/* Optional Custom Notes Input */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowOtherInput(!showOtherInput)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  {showOtherInput ? '- Hide Custom Note Input' : '+ Add Custom Notes / Other Outcome'}
                </button>

                {showOtherInput && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder="Type custom note or explanation..."
                      className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => handleApplyOutcome(customNote || 'Custom Note Logged')}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg"
                    >
                      Log Note
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Details & Full Audit Timeline History (#5) */}
        <div className="space-y-6">
          {/* Order Details Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wide flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <span>Order Summary</span>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {currentOrder.paymentStatus}
              </span>
            </h3>

            {/* Items List */}
            <div className="space-y-2">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">ORDERED ITEMS</div>
              {currentOrder.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60"
                >
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {item.name}
                    </span>
                    <div className="text-[11px] text-slate-500">Qty: {item.quantity}</div>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    NPR {(item.quantity * item.unitPrice).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Total Amount:</span>
              <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">
                NPR {currentOrder.totalAmount.toLocaleString()}
              </span>
            </div>

            {currentOrder.vendorName && (
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3 rounded-xl text-xs space-y-1">
                <span className="font-bold text-purple-800 dark:text-purple-300">
                  🏪 Vendor: {currentOrder.vendorName}
                </span>
                {currentOrder.vendorPhone && (
                  <div className="text-slate-600 dark:text-slate-400 font-mono">
                    Phone: {currentOrder.vendorPhone}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Full Audit Timeline History (#5: Don't hide completed tasks, keep timeline) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <History className="w-4 h-4 text-indigo-500" />
              <span>Order Audit Timeline</span>
            </h3>

            <div className="relative pl-4 border-l-2 border-indigo-200 dark:border-indigo-900/60 space-y-4">
              {currentTask.timeline.map((event) => (
                <div key={event.id} className="relative text-xs space-y-1">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900" />
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                    <span>{event.actor}</span>
                    <span>
                      {new Date(event.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {event.action}
                  </div>
                  {event.note && (
                    <div className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 p-2 rounded border border-slate-200 dark:border-slate-700">
                      {event.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ActionButtonProps {
  label: string;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ label, color, icon, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 font-bold text-xs p-3.5 rounded-xl shadow transition-all transform hover:-translate-y-0.5 cursor-pointer ${color}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
};
