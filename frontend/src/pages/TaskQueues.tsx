import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskApi } from '../services/api';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import SLACountdown from '../components/SLACountdown';
import TaskTimeline from '../components/TaskTimeline';
import { QUEUE_CONFIG, getSLAInfo } from '../utils/ruleEngine';
import { Task, TaskQueue } from '../types';
import {
  Layers, Search, Filter, Eye, Zap, CheckCircle2,
  HelpCircle, X,
} from 'lucide-react';



const QUEUE_KEYS = Object.keys(QUEUE_CONFIG) as TaskQueue[];

export default function TaskQueues() {
  const navigate = useNavigate();
  const { simulatedTimeIso } = useSimulatedTime();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQueue, setActiveQueue] = useState<TaskQueue | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data: any = await taskApi.list({ limit: 100 });
      setTasks(data.data?.tasks || []);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter((t) => {
    if (activeQueue !== 'all' && (t.taskType || t.type) !== activeQueue) return false;
    if (statusFilter === 'pending' && t.status === 'completed') return false;
    if (statusFilter === 'completed' && t.status !== 'completed') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (t.orderNumber || '').toLowerCase().includes(q) ||
        (t.reason || '').toLowerCase().includes(q) ||
        (t.assigneeName || '').toLowerCase().includes(q) ||
        (t.title || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getQueueCount = (q: TaskQueue) =>
    tasks.filter((t) => (t.taskType || t.type) === q && t.status !== 'completed').length;

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-6 h-6 text-indigo-500" />
              <span>Operations Task Queues</span>
            </h1>
            <p className="text-sm text-slate-500">
              Tasks automatically move between queues over an order's lifecycle.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2">
          <button
            onClick={() => setActiveQueue('all')}
            className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
              activeQueue === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>All Queues</span>
            <span className="font-mono bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[10px]">
              {tasks.filter((t) => t.status !== 'completed').length}
            </span>
          </button>

          {QUEUE_KEYS.map((qKey) => {
            const conf = QUEUE_CONFIG[qKey];
            const count = getQueueCount(qKey);
            const isSelected = activeQueue === qKey;
            return (
              <button
                key={qKey}
                onClick={() => setActiveQueue(qKey)}
                className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{conf.label}</span>
                <span className="font-mono bg-slate-200/80 px-1.5 py-0.5 rounded text-[10px]">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, orders, reasons..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              statusFilter === 'pending' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
            }`}>Pending</button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              statusFilter === 'completed' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
            }`}>Completed</button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              statusFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
            }`}>All</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-200">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-slate-800">No tasks found</h4>
            <p className="text-xs">Try a different queue or clear filters.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const qConfig = QUEUE_CONFIG[(task.taskType || task.type || 'customer-confirmation') as TaskQueue];
            const sla = task.dueAt ? getSLAInfo(task.dueAt, simulatedTimeIso) : null;
            return (
              <div key={task._id}
                className="p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`font-semibold px-2.5 py-0.5 rounded-full border ${qConfig?.badgeBg || 'bg-slate-100 text-slate-800'}`}>
                      {qConfig?.label || task.taskType || task.type}
                    </span>
                    <span className="font-bold text-slate-800 font-mono">
                      #{task.orderNumber || task.orderId}
                    </span>
                    {sla && (
                      <span className={`font-bold px-2 py-0.5 rounded border text-[11px] ${sla.badgeColor}`}>
                        ⏱ {sla.displayText}
                      </span>
                    )}
                    {task.status === 'completed' && (
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                        ✓ Completed
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-base">
                    {task.title || task.reason}
                  </h3>

                  {task.reason && (
                    <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-700 border border-slate-200">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1 mb-1">
                        <HelpCircle className="w-3 h-3" />
                        <span>Task Reason</span>
                      </div>
                      <p>{task.reason}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span>👤 {task.assigneeName || task.assigneeId || 'Unassigned'}</span>
                    {task.customerPhone && <span>📞 {task.customerPhone}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                  {task.status !== 'completed' && (
                    <>
                      <button
                        onClick={() => navigate('/next')}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm cursor-pointer"
                      >
                        Execute
                      </button>
                      <button
                        onClick={async () => {
                          await taskApi.skip(task._id, { notes: 'Skipped from queue' });
                          fetchTasks();
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-3 py-2 rounded-lg cursor-pointer"
                      >
                        Skip
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">TASK AUDIT DETAIL</span>
                <h3 className="text-lg font-extrabold text-slate-900">{selectedTask.title || selectedTask.reason}</h3>
              </div>
              <button onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30 text-amber-900">
                <strong>Why this task exists:</strong> {selectedTask.reason}
              </div>

              {selectedTask.timeline && selectedTask.timeline.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">Audit Timeline</h4>
                  <TaskTimeline events={selectedTask.timeline} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div><span className="text-slate-500">Status:</span> <span className="font-bold capitalize">{selectedTask.status}</span></div>
                <div><span className="text-slate-500">Priority:</span> <span className="font-bold uppercase">{selectedTask.priority}</span></div>
                <div><span className="text-slate-500">Assignee:</span> <span className="font-bold">{selectedTask.assigneeName || 'Unassigned'}</span></div>
                <div><span className="text-slate-500">Created:</span> <span>{new Date(selectedTask.createdAt).toLocaleString()}</span></div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={() => setSelectedTask(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
