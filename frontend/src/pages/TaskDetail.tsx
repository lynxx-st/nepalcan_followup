import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { taskApi, noteApi } from '../services/api';
import OutcomeButtons from '../components/OutcomeButtons';
import TaskTimeline from '../components/TaskTimeline';
import SLACountdown from '../components/SLACountdown';



export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
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
      setError('Failed to load task');
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
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading...</div>;
  }

  if (error || !task) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">{error || 'Task not found'}</p>
        <Link to="/today" className="text-red-600 hover:underline mt-4 inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/today" className="text-red-600 hover:underline text-sm mb-4 inline-block">← Back to Dashboard</Link>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            task.priority === 'critical' ? 'bg-red-100 text-red-700' :
            task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-slate-100 text-slate-700'
          }`}>
            {task.priority?.toUpperCase() || 'N/A'}
          </span>
          {task.dueAt && <SLACountdown dueAt={task.dueAt} completed={task.status === 'completed'} />}
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-2">{task.reason || task.title}</h1>

        <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
          <span className="font-medium">Status:</span>
          <span className={`px-2 py-0.5 rounded text-xs ${
            task.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
            task.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
          }`}>{task.status}</span>
        </div>

        {(task.customerPhone || task.vendorPhone) && (
          <div className="flex flex-wrap gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
            {task.customerPhone && (
              <a href={`tel:${task.customerPhone}`}
                className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">
                📞 Customer — {task.customerPhone}
              </a>
            )}
            {task.vendorPhone && (
              <a href={`tel:${task.vendorPhone}`}
                className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">
                📞 Vendor — {task.vendorPhone}
              </a>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span className="text-slate-500">Order</span><p>{task.orderNumber || task.orderId || '-'}</p></div>
          <div><span className="text-slate-500">Assignee</span><p>{task.assigneeName || task.assigneeId || 'Unassigned'}</p></div>
          <div><span className="text-slate-500">Created</span><p>{new Date(task.createdAt).toLocaleString()}</p></div>
          <div><span className="text-slate-500">Type</span><p className="capitalize">{task.type || '-'}</p></div>
        </div>

        {task.notes && task.notes.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Notes ({task.notes.length})</h3>
            <div className="space-y-2">
              {task.notes.map((n: any, i: number) => (
                <div key={i} className="text-sm">
                  <span className="text-xs text-slate-400">{n.actor}</span>
                  <p className="text-slate-800">{n.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.status !== 'completed' && task.status !== 'overdue' && (
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Mark Complete</h3>
            <OutcomeButtons
              queue={task.taskType || task.type || 'customer-confirmation'}
              onSelect={handleComplete}
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Add Note</h3>
        <form onSubmit={handleAddNote} className="flex gap-2">
          <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Write a note..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
            disabled={noteLoading} />
          <button type="submit" disabled={noteLoading || !noteText.trim()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 cursor-pointer">
            {noteLoading ? 'Saving...' : 'Add'}
          </button>
        </form>
      </div>

      {task.timeline && task.timeline.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <TaskTimeline events={task.timeline} />
        </div>
      )}
    </div>
  );
}
