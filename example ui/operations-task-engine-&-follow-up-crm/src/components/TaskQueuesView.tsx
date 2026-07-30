import React, { useState } from 'react';
import {
  PhoneCall,
  Store,
  Clock,
  RefreshCw,
  Star,
  AlertTriangle,
  Search,
  Filter,
  UserCheck,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  HelpCircle,
  Eye,
} from 'lucide-react';
import { Task, TaskQueue, Agent, Order } from '../types';
import { getSLAInfo, QUEUE_CONFIG } from '../utils/ruleEngine';

interface TaskQueuesViewProps {
  tasks: Task[];
  orders: Order[];
  agents: Agent[];
  simulatedTimeIso: string;
  onLaunchNextCall: (queue: TaskQueue, taskId: string) => void;
  onReassignTask: (taskId: string, newAssignee: string) => void;
}

export const TaskQueuesView: React.FC<TaskQueuesViewProps> = ({
  tasks,
  orders,
  agents,
  simulatedTimeIso,
  onLaunchNextCall,
  onReassignTask,
}) => {
  const [activeQueueTab, setActiveQueueTab] = useState<TaskQueue | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<Task | null>(null);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (activeQueueTab !== 'all' && t.queue !== activeQueueTab) return false;
    if (statusFilter === 'pending' && (t.status === 'completed' || t.status === 'dismissed'))
      return false;
    if (statusFilter === 'completed' && t.status !== 'completed') return false;
    if (assigneeFilter !== 'all' && t.assignedTo !== assigneeFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchOrder = t.orderNumber.toLowerCase().includes(q);
      const matchReason = t.reason.toLowerCase().includes(q);
      const matchAssignee = t.assignedTo.toLowerCase().includes(q);
      if (!matchTitle && !matchOrder && !matchReason && !matchAssignee) return false;
    }

    return true;
  });

  // Sort by priorityScore descending
  const sortedTasks = [...filteredTasks].sort((a, b) => b.priorityScore - a.priorityScore);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Queue Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-6 h-6 text-indigo-500" />
              <span>Operations Task Queues</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Tasks automatically move between queues over an order's lifecycle according to active operational rules.
            </p>
          </div>
        </div>

        {/* 6 Queue Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2">
          <button
            onClick={() => setActiveQueueTab('all')}
            className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
              activeQueueTab === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            <span>All Queues</span>
            <span className="font-mono bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded text-[10px]">
              {tasks.filter((t) => t.status !== 'completed').length}
            </span>
          </button>

          {(Object.keys(QUEUE_CONFIG) as TaskQueue[]).map((qKey) => {
            const conf = QUEUE_CONFIG[qKey];
            const count = tasks.filter((t) => t.queue === qKey && t.status !== 'completed').length;
            const isSelected = activeQueueTab === qKey;

            return (
              <button
                key={qKey}
                onClick={() => setActiveQueueTab(qKey)}
                className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{conf.label}</span>
                <span className="font-mono bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, orders, reasons..."
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                statusFilter === 'pending'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                statusFilter === 'completed'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              All
            </button>
          </div>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="all">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task List Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
        {sortedTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-slate-800 dark:text-slate-200">No tasks found</h4>
            <p className="text-xs">Try selecting a different queue or clearing search filters.</p>
          </div>
        ) : (
          sortedTasks.map((task) => {
            const sla = getSLAInfo(task.dueAt, simulatedTimeIso);
            const qConfig = QUEUE_CONFIG[task.queue];
            const order = orders.find((o) => o.id === task.orderId);

            return (
              <div
                key={task.id}
                className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`font-semibold px-2.5 py-0.5 rounded-full border ${qConfig.badgeBg}`}>
                      {qConfig.label}
                    </span>

                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {task.orderNumber}
                    </span>

                    {order && (
                      <span className="text-slate-500 font-medium">
                        • {order.customerName} ({order.city})
                      </span>
                    )}

                    <span className={`font-bold px-2 py-0.5 rounded border text-[11px] ${sla.badgeColor}`}>
                      ⏱ {sla.displayText}
                    </span>

                    {task.status === 'completed' && (
                      <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[11px]">
                        ✓ Completed ({task.outcome})
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {task.title}
                  </h3>

                  {/* Task Reason (#4) */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      <span>Task Reason</span>
                    </div>
                    <p>{task.reason}</p>
                  </div>

                  {/* Rebalance Assignee Dropdown (#9) */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>Assigned to:</span>
                      <select
                        value={task.assignedTo}
                        onChange={(e) => onReassignTask(task.id, e.target.value)}
                        className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 rounded px-2 py-0.5 focus:outline-none cursor-pointer"
                      >
                        {agents.map((a) => (
                          <option key={a.id} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedTaskForModal(task)}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Timeline</span>
                  </button>

                  {task.status !== 'completed' && (
                    <button
                      onClick={() => onLaunchNextCall(task.queue, task.id)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm"
                    >
                      Execute Task
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTaskForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  TASK AUDIT DETAIL
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {selectedTaskForModal.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTaskForModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30 text-amber-900 dark:text-amber-200">
                <strong>Why this task exists:</strong> {selectedTaskForModal.reason}
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Audit Timeline History</h4>
                <div className="border-l-2 border-indigo-500 pl-3 space-y-3">
                  {selectedTaskForModal.timeline.map((tl) => (
                    <div key={tl.id} className="space-y-0.5">
                      <div className="text-[10px] text-slate-400 font-mono">
                        {tl.actor} • {new Date(tl.timestamp).toLocaleString()}
                      </div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{tl.action}</div>
                      {tl.note && <div className="text-slate-600 dark:text-slate-400">{tl.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedTaskForModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
