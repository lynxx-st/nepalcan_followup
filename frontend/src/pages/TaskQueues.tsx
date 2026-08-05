import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { taskApi } from '../services/api';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import SLACountdown from '../components/SLACountdown';
import Breadcrumbs from '../components/Breadcrumbs';
import { QUEUE_CONFIG, getSLAInfo } from '../utils/ruleEngine';
import { TaskQueue } from '../types';
import {
  Layers, Search, Filter, Eye, Zap, CheckCircle2,
  HelpCircle, X, Clock, AlertTriangle,
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
        (t.title || '').toLowerCase().includes(q) ||
        (t.taskNumber || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getQueueCount = (q: TaskQueue) =>
    tasks.filter((t) => (t.taskType || t.type) === q && t.status !== 'completed').length;

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Task Queues' }]} />

      {/* Header Container */}
      <div className="card-blueprint p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0a0a0a]">Task Queues & Routing</h1>
            <span className="badge-pill badge-pill-solid text-[10px] uppercase">
              {filteredTasks.length} Tasks
            </span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            Automated task queues routed based on order triggers, delays, and priority SLAs.
          </p>
        </div>

        <button onClick={() => navigate('/next')} className="btn-primary text-xs px-4 py-2 cursor-pointer shadow-xs">
          <Zap className="w-3.5 h-3.5" />
          <span>Process Next Call</span>
        </button>
      </div>

      {/* Queue Selection Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveQueue('all')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeQueue === 'all'
              ? 'bg-[#0a0a0a] text-white shadow-2xs font-semibold'
              : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#e5e5e5]'
          }`}
        >
          <span>All Queues</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            activeQueue === 'all' ? 'bg-[#ffffff] text-[#0a0a0a]' : 'bg-[#e5e5e5] text-[#0a0a0a]'
          }`}>
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
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#0a0a0a] text-white shadow-2xs font-semibold'
                  : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#e5e5e5]'
              }`}
            >
              <span>{conf?.label || qKey}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isSelected ? 'bg-[#ffffff] text-[#0a0a0a]' : 'bg-[#e5e5e5] text-[#0a0a0a]'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Controls */}
      <div className="card-blueprint p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[#e5e5e5] pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#737373] font-medium">Status Filter:</span>
            {(['pending', 'completed', 'all'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-2xl text-xs font-medium transition-all cursor-pointer capitalize ${
                  statusFilter === st
                    ? 'bg-[#0a0a0a] text-white'
                    : 'bg-[#fafafa] text-[#737373] hover:text-[#0a0a0a]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search queue tasks..."
              className="input-blueprint w-full pl-9 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Task List Table / Stack */}
        {loading ? (
          <div className="text-center py-12 text-xs text-[#737373] animate-pulse">
            Loading queue items...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-[#fafafa] rounded-2xl border border-[#e5e5e5]">
            <CheckCircle2 className="w-8 h-8 text-[#737373] mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-[#0a0a0a]">No Tasks in Queue</h3>
            <p className="text-xs text-[#737373] mt-1">There are no tasks matching the selected queue filter.</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#e5e5e5]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-[#e5e5e5] text-[#737373] font-semibold">
                    <th className="py-3 px-4">Task #</th>
                    <th className="py-3 px-4">Queue Type</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">SLA Window</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e5]">
                  {filteredTasks.map((t: any) => (
                    <tr
                      key={t._id}
                      onClick={() => navigate(`/tasks/${t._id}`)}
                      className="hover:bg-[#fafafa] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-bold text-[#0a0a0a]">
                        {t.taskNumber || t._id.substring(0, 8)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="badge-pill badge-pill-soft text-[11px]">
                          {t.type || t.taskType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#0a0a0a] max-w-xs truncate font-medium">
                        {t.reason || 'Follow-up task'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`badge-pill text-[10px] uppercase font-bold ${
                          t.priority === 'critical' ? 'badge-pill-ember' : 'badge-pill-soft'
                        }`}>
                          {t.priority || 'medium'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {t.dueAt ? <SLACountdown dueAt={t.dueAt} /> : <span className="text-[#737373]">—</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/tasks/${t._id}`} className="btn-outline text-xs px-3 py-1">
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
              {filteredTasks.map((t: any) => (
                <div
                  key={t._id}
                  onClick={() => navigate(`/tasks/${t._id}`)}
                  className="bg-[#ffffff] border border-[#e5e5e5] rounded-2xl p-4 space-y-2 hover:border-[#0a0a0a] transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-sm text-[#0a0a0a]">
                        {t.taskNumber || t._id.substring(0, 8)}
                      </span>
                      <p className="text-xs font-semibold text-[#0a0a0a] mt-0.5">{t.reason || 'Follow-up task'}</p>
                    </div>
                    <span className={`badge-pill text-[10px] uppercase ${
                      t.priority === 'critical' ? 'badge-pill-ember' : 'badge-pill-soft'
                    }`}>
                      {t.priority || 'medium'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#f5f5f5]" onClick={(e) => e.stopPropagation()}>
                    <span className="badge-pill badge-pill-soft text-[10px]">
                      {t.type || t.taskType}
                    </span>
                    <Link to={`/tasks/${t._id}`} className="btn-primary text-xs px-3 py-1">
                      View Task
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
