import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { taskApi, noteApi } from '../services/api';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import OutcomeButtons from '../components/OutcomeButtons';
import SLACountdown from '../components/SLACountdown';
import TaskTimeline from '../components/TaskTimeline';
import {
  Zap, CheckCircle2, Sparkles, PhoneCall, HelpCircle,
  History, ShoppingBag, Store, ArrowLeft,
} from 'lucide-react';
import { TaskQueue } from '../types';
import { QUEUE_CONFIG } from '../utils/ruleEngine';



export default function NextCall() {
  const navigate = useNavigate();
  const { simulatedTimeIso } = useSimulatedTime();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [queueFilter, setQueueFilter] = useState<TaskQueue | 'all'>('all');

  const loadNext = useCallback(async () => {
    try {
      setLoading(true);
      setCompleted(false);
      setError(null);
      const data: any = await taskApi.getNext();
      setTask(data.data || null);
    } catch {
      setError('Failed to load next task');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  const handleOutcome = async (outcome: string, _note?: string) => {
    if (!task) return;
    try {
      await taskApi.complete(task._id, { notes: outcome, durationMinutes: 0 });
      setCompleted(true);
      toast.success(`Logged: ${outcome}`, { duration: 2000 });
      setTimeout(() => loadNext(), 1500);
    } catch {
      toast.error('Failed to complete task');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !task) return;
    setNoteSaving(true);
    try {
      await noteApi.addNote(task._id, noteText);
      setNoteText('');
      const updated: any = await taskApi.getById(task._id);
      setTask(updated.data);
      toast.success('Note added', { duration: 2000 });
    } catch {
      toast.error('Failed to add note');
    } finally {
      setNoteSaving(false);
    }
  };

  if (loading && !task) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 text-lg">Loading next task...</div>
      </div>
    );
  }

  if (!task && !loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">All Calls Completed!</h2>
        <p className="text-slate-500 text-sm">Great job! No pending tasks.</p>
        <button onClick={() => navigate('/today')}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all cursor-pointer">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6 animate-in">
      <div className="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 flex items-center justify-center font-bold shadow-md animate-pulse">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base uppercase tracking-wider text-amber-400">NEXT CALL MODE ⚡</span>
            </div>
            <p className="text-xs text-slate-400">Auto-advancing upon action</p>
          </div>
        </div>
        <button onClick={() => navigate('/today')}
          className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
          Exit
        </button>
      </div>

      {completed && (
        <div className="bg-emerald-600 text-white font-bold px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Task Logged! Loading Next Task...</span>
          </div>
          <Sparkles className="w-5 h-5 text-yellow-300 animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 border-b border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${(QUEUE_CONFIG[(task.taskType || task.type) as TaskQueue])?.badgeBg || 'bg-slate-100 text-slate-800'}`}>
                  {task.taskType || task.type || 'Task'}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-extrabold px-3 py-1 rounded-lg border`}>
                    {task.dueAt && <SLACountdown dueAt={task.dueAt} />}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div>
                  <div className="text-xs text-indigo-300 font-medium">TASK DETAILS</div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <span>Order #{task.orderNumber || task.orderId}</span>
                  </h2>
                </div>
                {(task.customerPhone || task.vendorPhone) && (
                  <div className="flex items-center gap-2">
                    {task.customerPhone && (
                      <a href={`tel:${task.customerPhone}`}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all hover:scale-105">
                        <PhoneCall className="w-4 h-4 fill-slate-950" />
                        <span>{task.customerPhone}</span>
                      </a>
                    )}
                    {task.vendorPhone && (
                      <a href={`tel:${task.vendorPhone}`}
                        className="flex items-center gap-2 bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all hover:scale-105">
                        <Store className="w-4 h-4" />
                        <span>{task.vendorPhone}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 bg-amber-500/10 border-b border-amber-500/20 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                <span>Task Reason</span>
              </div>
              <p className="text-sm font-medium text-amber-900 leading-relaxed">{task.reason}</p>
            </div>

            <div className="p-6 space-y-5">
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                <span>⚡ ONE-CLICK OUTCOME</span>
                <span className="text-xs font-normal text-slate-400">(Advances to next task)</span>
              </h3>
              <OutcomeButtons
                queue={task.taskType || task.type || 'customer-confirmation'}
                onSelect={handleOutcome}
              />
              <button
                onClick={async () => {
                  await taskApi.skip(task._id, { notes: 'Skipped' });
                  toast('Task skipped', { duration: 2000 });
                  loadNext();
                }}
                className="mt-3 w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm px-5 py-3 rounded-xl cursor-pointer"
              >
                Skip This Task
              </button>

              <div className="pt-3 border-t border-slate-200">
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add custom note..."
                    className="flex-1 bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={noteSaving || !noteText.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    {noteSaving ? '...' : 'Add Note'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide border-b border-slate-200 pb-3 mb-3">
              Call Details
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-bold capitalize">{task.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Priority</span>
                <span className={`font-bold uppercase ${
                  task.priority === 'critical' ? 'text-red-600' :
                  task.priority === 'high' ? 'text-orange-600' :
                  task.priority === 'medium' ? 'text-yellow-600' : 'text-slate-600'
                }`}>{task.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assignee</span>
                <span className="font-bold">{task.assigneeName || task.assigneeId || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span>{new Date(task.createdAt).toLocaleDateString()}</span>
              </div>
              {task.dueAt && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">SLA</span>
                  <SLACountdown dueAt={task.dueAt} />
                </div>
              )}
            </div>
          </div>

          {task.timeline && task.timeline.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <TaskTimeline events={task.timeline} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
