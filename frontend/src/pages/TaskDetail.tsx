import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { taskApi, noteApi } from '../services/api';
import OutcomeButtons from '../components/OutcomeButtons';
import TaskTimeline from '../components/TaskTimeline';
import SLACountdown from '../components/SLACountdown';
import Breadcrumbs from '../components/Breadcrumbs';
import { ArrowLeft, PhoneCall, Send, FileText, CheckCircle2 } from 'lucide-react';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const data: any = await taskApi.getById(id!);
      setTask(data.data);
      setError(null);
    } catch {
      setError('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchTask();
  }, [id]);

  const handleComplete = async (outcome: string) => {
    await taskApi.complete(id!, { notes: outcome });
    await fetchTask();
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setNoteLoading(true);
    try {
      await noteApi.addNote(id!, noteText);
      setNoteText('');
      await fetchTask();
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setNoteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-[#737373] animate-pulse">
        Loading task details...
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="card-blueprint p-8 text-center space-y-4 max-w-lg mx-auto">
        <h2 className="text-base font-bold text-[#0a0a0a]">{error || 'Task Not Found'}</h2>
        <button onClick={() => navigate('/queues')} className="btn-primary text-xs">
          Return to Task Queues
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[
        { label: 'Task Queues', to: '/queues' },
        { label: `Task #${task.taskNumber || task._id.substring(0, 8)}` }
      ]} />

      {/* Header Container */}
      <div className="card-blueprint p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/queues')} className="p-2 rounded-2xl bg-[#fafafa] border border-[#e5e5e5] hover:bg-[#e5e5e5] cursor-pointer">
              <ArrowLeft className="w-4 h-4 text-[#0a0a0a]" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#0a0a0a]">
                  Task #{task.taskNumber || task._id.substring(0, 8)}
                </h1>
                <span className={`badge-pill text-[10px] uppercase ${
                  task.priority === 'critical' ? 'badge-pill-ember' : 'badge-pill-soft'
                }`}>
                  {task.priority || 'medium'}
                </span>
              </div>
              <p className="text-xs text-[#737373] mt-0.5">{task.reason || task.title}</p>
            </div>
          </div>

          {task.dueAt && <SLACountdown dueAt={task.dueAt} completed={task.status === 'completed'} />}
        </div>

        {/* Task Details Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-[#737373]">Status</p>
            <span className="badge-pill badge-pill-soft text-[11px] mt-1 capitalize">{task.status}</span>
          </div>
          <div>
            <p className="text-[#737373]">Queue Type</p>
            <p className="font-bold text-[#0a0a0a] mt-0.5">{task.type || task.taskType || '-'}</p>
          </div>
          <div>
            <p className="text-[#737373]">Assignee</p>
            <p className="font-bold text-[#0a0a0a] mt-0.5">{task.assigneeName || 'Unassigned'}</p>
          </div>
          <div>
            <p className="text-[#737373]">Order Reference</p>
            {task.orderId || task.orderNumber ? (
              <Link to={`/orders/${task.orderId || task.orderNumber}`} className="font-bold text-[#0a0a0a] hover:underline">
                #{task.orderNumber || task.orderId}
              </Link>
            ) : (
              <p className="font-bold text-[#0a0a0a] mt-0.5">—</p>
            )}
          </div>
        </div>

        {/* Phone Action Bar */}
        {(task.customerPhone || task.vendorPhone) && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-[#e5e5e5]">
            {task.customerPhone && (
              <a href={`tel:${task.customerPhone}`} className="btn-primary text-xs px-4 py-2">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Customer: {task.customerPhone}</span>
              </a>
            )}
            {task.vendorPhone && (
              <a href={`tel:${task.vendorPhone}`} className="btn-secondary text-xs px-4 py-2">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Vendor: {task.vendorPhone}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Outcome Log & Notes Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {task.status !== 'completed' && (
            <div className="card-blueprint p-6 space-y-4">
              <h2 className="text-sm font-bold text-[#0a0a0a]">Complete Task & Log Outcome</h2>
              <OutcomeButtons
                taskType={task.type || task.taskType || 'customer-confirmation'}
                onSelectOutcome={handleComplete}
              />
            </div>
          )}

          {task.timeline && task.timeline.length > 0 && (
            <div className="card-blueprint p-6 space-y-4">
              <h2 className="text-sm font-bold text-[#0a0a0a]">Task Event Timeline</h2>
              <TaskTimeline events={task.timeline} />
            </div>
          )}
        </div>

        {/* Notes Side Card */}
        <div className="space-y-6">
          <div className="card-blueprint p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#0a0a0a] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#737373]" />
              Notes & History
            </h2>

            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Type note..."
                rows={3}
                className="input-blueprint w-full text-xs"
              />
              <button
                type="submit"
                disabled={noteLoading || !noteText.trim()}
                className="btn-primary text-xs w-full py-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{noteLoading ? 'Saving...' : 'Add Note'}</span>
              </button>
            </form>

            <div className="space-y-2 max-h-72 overflow-y-auto pt-2">
              {task.notes?.length === 0 ? (
                <p className="text-xs text-[#737373]">No notes recorded.</p>
              ) : (
                task.notes?.map((n: any, idx: number) => (
                  <div key={idx} className="bg-[#fafafa] border border-[#e5e5e5] p-3 rounded-2xl text-xs space-y-1">
                    <p className="text-[#0a0a0a]">{n.note}</p>
                    <p className="text-[10px] text-[#737373]">
                      {n.actor || 'System'} · {new Date(n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
