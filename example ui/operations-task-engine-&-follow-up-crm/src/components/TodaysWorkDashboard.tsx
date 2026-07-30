import React, { useState } from 'react';
import {
  PhoneCall,
  Store,
  Clock,
  RefreshCw,
  Star,
  AlertTriangle,
  Zap,
  ArrowRight,
  User,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { Task, TaskQueue, Agent, Order } from '../types';
import { getSLAInfo, QUEUE_CONFIG } from '../utils/ruleEngine';

interface TodaysWorkDashboardProps {
  tasks: Task[];
  orders: Order[];
  currentAgent: Agent;
  simulatedTimeIso: string;
  onSelectQueue: (queue: TaskQueue) => void;
  onLaunchNextCall: (queue?: TaskQueue, taskId?: string) => void;
  onQuickCompleteTask: (taskId: string, outcome: string, note?: string) => void;
}

export const TodaysWorkDashboard: React.FC<TodaysWorkDashboardProps> = ({
  tasks,
  orders,
  currentAgent,
  simulatedTimeIso,
  onSelectQueue,
  onLaunchNextCall,
  onQuickCompleteTask,
}) => {
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<TaskQueue | 'all'>('all');

  // Active pending tasks
  const pendingTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'dismissed');

  // Filtered by assignee
  const filteredTasks = pendingTasks.filter((t) => {
    if (assigneeFilter === 'my') return t.assignedTo === currentAgent.name;
    if (assigneeFilter !== 'all') return t.assignedTo === assigneeFilter;
    if (selectedQueueFilter !== 'all') return t.queue === selectedQueueFilter;
    return true;
  });

  // Calculate counts per queue
  const getQueueCount = (queue: TaskQueue) => {
    return pendingTasks.filter((t) => t.queue === queue).length;
  };

  const getOverdueCount = () => {
    return pendingTasks.filter((t) => getSLAInfo(t.dueAt, simulatedTimeIso).isOverdue).length;
  };

  // Top prioritized tasks (auto-sorted by priorityScore descending)
  const prioritizedTasks = [...filteredTasks].sort((a, b) => b.priorityScore - a.priorityScore);

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Next Call Action Banner - Red & White Theme */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-800 border border-red-500 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/20 text-white border border-white/30 text-xs font-bold px-3 py-1 rounded-full">
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
              <span>Smart Queue Active • Logged in as {currentAgent.name}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Today's Work Engine
            </h1>
            <p className="text-sm text-red-100 font-medium">
              Zero thinking required. System automatically prioritizes critical customer calls, vendor dispatch delays, and recovery opportunities.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <button
              onClick={() => onLaunchNextCall(selectedQueueFilter !== 'all' ? selectedQueueFilter : undefined)}
              className="group flex items-center justify-center gap-3 bg-white hover:bg-red-50 text-red-600 font-black text-base px-6 py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Zap className="w-5 h-5 fill-red-600 text-red-600 animate-bounce" />
              <span>START NEXT CALL</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Today's Tasks Queue Summary Cards Grid (#2) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Today's Task Queues</span>
            <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono">
              {pendingTasks.length} Pending
            </span>
          </h2>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Click queue to filter work list
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
          {/* Customer Confirmation */}
          <QueueSummaryCard
            title="Customer Conf."
            queue="customer_confirmation"
            count={getQueueCount('customer_confirmation')}
            icon={<PhoneCall className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            colorBorder="border-blue-500/30 hover:border-blue-500"
            colorBg="bg-blue-500/10"
            isSelected={selectedQueueFilter === 'customer_confirmation'}
            onClick={() => {
              setSelectedQueueFilter(
                selectedQueueFilter === 'customer_confirmation' ? 'all' : 'customer_confirmation'
              );
            }}
          />

          {/* Vendor Calls */}
          <QueueSummaryCard
            title="Vendor Action"
            queue="vendor_action"
            count={getQueueCount('vendor_action')}
            icon={<Store className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
            colorBorder="border-purple-500/30 hover:border-purple-500"
            colorBg="bg-purple-500/10"
            isSelected={selectedQueueFilter === 'vendor_action'}
            onClick={() => {
              setSelectedQueueFilter(selectedQueueFilter === 'vendor_action' ? 'all' : 'vendor_action');
            }}
          />

          {/* Vendor Delay */}
          <QueueSummaryCard
            title="Vendor Delay"
            queue="vendor_delay"
            count={getQueueCount('vendor_delay')}
            icon={<Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            colorBorder="border-amber-500/30 hover:border-amber-500"
            colorBg="bg-amber-500/10"
            isSelected={selectedQueueFilter === 'vendor_delay'}
            onClick={() => {
              setSelectedQueueFilter(selectedQueueFilter === 'vendor_delay' ? 'all' : 'vendor_delay');
            }}
          />

          {/* Cancelled Recovery */}
          <QueueSummaryCard
            title="Cancelled Recovery"
            queue="cancelled_recovery"
            count={getQueueCount('cancelled_recovery')}
            icon={<RefreshCw className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
            colorBorder="border-rose-500/30 hover:border-rose-500"
            colorBg="bg-rose-500/10"
            isSelected={selectedQueueFilter === 'cancelled_recovery'}
            onClick={() => {
              setSelectedQueueFilter(
                selectedQueueFilter === 'cancelled_recovery' ? 'all' : 'cancelled_recovery'
              );
            }}
          />

          {/* Review Calls */}
          <QueueSummaryCard
            title="Review Calls"
            queue="review_calls"
            count={getQueueCount('review_calls')}
            icon={<Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />}
            colorBorder="border-yellow-500/30 hover:border-yellow-500"
            colorBg="bg-yellow-500/10"
            isSelected={selectedQueueFilter === 'review_calls'}
            onClick={() => {
              setSelectedQueueFilter(selectedQueueFilter === 'review_calls' ? 'all' : 'review_calls');
            }}
          />

          {/* Escalations */}
          <QueueSummaryCard
            title="Escalations"
            queue="escalations"
            count={getQueueCount('escalations')}
            icon={<AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />}
            colorBorder="border-red-500/30 hover:border-red-500"
            colorBg="bg-red-500/10"
            isSelected={selectedQueueFilter === 'escalations'}
            onClick={() => {
              setSelectedQueueFilter(selectedQueueFilter === 'escalations' ? 'all' : 'escalations');
            }}
          />

          {/* Overdue Total */}
          <div className="col-span-2 sm:col-span-1 rounded-xl bg-gradient-to-b from-red-500/10 to-red-500/5 border border-red-500/40 p-4 text-center flex flex-col items-center justify-center gap-1 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="text-2xl font-black text-red-600 dark:text-red-400">{getOverdueCount()}</span>
            <span className="text-xs font-semibold text-red-700 dark:text-red-300">Overdue SLA</span>
          </div>
        </div>
      </div>

      {/* Auto-Prioritized Task Queue List (#11) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Prioritized Action Queue
              </h3>
              <span className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                Auto-Ranked by Priority Score
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tasks automatically ranked using SLA urgency, order value, and queue criticality.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">Assignee:</span>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Agents</option>
                <option value="my">My Tasks Only ({currentAgent.name})</option>
                <option value="Sabin Shrestha">Sabin Shrestha</option>
                <option value="Anjali Gurung">Anjali Gurung</option>
                <option value="Rohan Maharjan">Rohan Maharjan</option>
                <option value="Sunita Adhikari">Sunita Adhikari</option>
              </select>
            </div>

            {selectedQueueFilter !== 'all' && (
              <button
                onClick={() => setSelectedQueueFilter('all')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Clear Queue Filter
              </button>
            )}
          </div>
        </div>

        {/* Task Cards List */}
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {prioritizedTasks.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-slate-800 dark:text-slate-200">No Pending Tasks in this Queue!</h4>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                All work completed or no tasks match your active filters. Try advancing the simulated time (+1h) to test rule generation.
              </p>
            </div>
          ) : (
            prioritizedTasks.map((task) => {
              const sla = getSLAInfo(task.dueAt, simulatedTimeIso);
              const qConfig = QUEUE_CONFIG[task.queue];
              const order = orders.find((o) => o.id === task.orderId);

              return (
                <div
                  key={task.id}
                  className="p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    {/* Header line: Queue badge, priority score, order number, SLA badge */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`font-semibold px-2.5 py-0.5 rounded-full border ${qConfig.badgeBg}`}
                      >
                        {qConfig.label}
                      </span>

                      <span className="bg-slate-900 text-amber-300 font-mono font-bold px-2 py-0.5 rounded text-[11px] border border-amber-400/30">
                        Score: {task.priorityScore}
                      </span>

                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {task.orderNumber}
                      </span>

                      {order && (
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          • NPR {order.totalAmount.toLocaleString()} ({order.city})
                        </span>
                      )}

                      <span
                        className={`font-bold px-2 py-0.5 rounded-md border text-[11px] ml-auto md:ml-0 ${sla.badgeColor}`}
                      >
                        ⏱ {sla.displayText}
                      </span>
                    </div>

                    {/* Task Title */}
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                      {task.title}
                    </h4>

                    {/* Task Reason (#4: Clear explanation why task exists) */}
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                      <div className="font-semibold text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" />
                        <span>Task Reason</span>
                      </div>
                      <p className="leading-relaxed">{task.reason}</p>
                    </div>

                    {/* Customer & Assignee Meta */}
                    {order && (
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                        <span>
                          👤 Customer: <strong className="text-slate-800 dark:text-slate-200">{order.customerName}</strong> ({order.customerPhone})
                        </span>
                        <span>
                          🛠 Assigned: <strong className="text-slate-800 dark:text-slate-200">{task.assignedTo}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => onLaunchNextCall(task.queue, task.id)}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all"
                    >
                      <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                      <span>Start Task Call</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

interface QueueSummaryCardProps {
  title: string;
  queue: TaskQueue;
  count: number;
  icon: React.ReactNode;
  colorBorder: string;
  colorBg: string;
  isSelected: boolean;
  onClick: () => void;
}

const QueueSummaryCard: React.FC<QueueSummaryCardProps> = ({
  title,
  count,
  icon,
  colorBorder,
  colorBg,
  isSelected,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all cursor-pointer relative overflow-hidden ${
        isSelected
          ? 'ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-500 shadow-md'
          : `bg-white dark:bg-slate-900 ${colorBorder} shadow-sm hover:shadow-md`
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorBg}`}>{icon}</div>
        <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
          {count}
        </span>
      </div>
      <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
        {title}
      </div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
        {count === 1 ? '1 task waiting' : `${count} tasks waiting`}
      </div>
    </button>
  );
};
