import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { taskApi, noteApi } from '../services/api';
import { useSimulatedTime } from '../hooks/useSimulatedTime';
import OutcomeButtons from '../components/OutcomeButtons';
import SLACountdown from '../components/SLACountdown';
import Breadcrumbs from '../components/Breadcrumbs';
import {
  Zap, CheckCircle2, Sparkles, PhoneCall, HelpCircle,
  History, ShoppingBag, Store, ArrowLeft, Send, Eye, FileText,
} from 'lucide-react';

export default function NextCall() {
  const navigate = useNavigate();
  const { simulatedTimeIso } = useSimulatedTime();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

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
      toast.success(`Logged outcome: ${outcome}`);
      setTimeout(() => loadNext(), 1200);
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
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setNoteSaving(false);
    }
  };

  if (loading && !task) {
    return (
      <div className="flex items-center justify-center h-64 text-[#737373] text-sm animate-pulse">
        Loading next prioritized call...
      </div>
    );
  }

  if (!task && !loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4 animate-in">
        <div className="w-16 h-16 rounded-2xl bg-[#0a0a0a] text-white mx-auto flex items-center justify-center font-bold shadow-xs">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-[#0a0a0a]">All Calls Completed!</h2>
        <p className="text-xs text-[#737373]">Excellent job! No pending tasks currently require immediate follow-up action.</p>
        <button onClick={() => navigate('/today')} className="btn-primary text-xs px-5 py-2.5">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const customerPhone = task.customerPhone || task.sourceOrder?.customerPhone || 'N/A';
  const orderId = task.orderId || task.sourceOrder?.orderId || task.sourceOrder?.commerceOrderId;

  return (
    <div className="space-y-6 pb-24 animate-in">
      <Breadcrumbs items={[{ label: 'Next Call Workstation' }]} />

      {/* Header Bar */}
      <div className="card-blueprint p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/today')} className="p-2 rounded-2xl bg-[#fafafa] border border-[#e5e5e5] hover:bg-[#e5e5e5] cursor-pointer">
            <ArrowLeft className="w-4 h-4 text-[#0a0a0a]" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#0a0a0a]">Next Call Workstation</h1>
              <span className="badge-pill badge-pill-solid text-[10px] uppercase">
                {task.type}
              </span>
            </div>
            <p className="text-xs text-[#737373] mt-0.5">High-speed call processing mode</p>
          </div>
        </div>

        {task.dueAt && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#737373]">SLA Window:</span>
            <SLACountdown dueAt={task.dueAt} />
          </div>
        )}
      </div>

      {/* Main Workstation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Order Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-blueprint p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-[#e5e5e5] pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#737373]">Target Contact</span>
                <h2 className="text-xl font-bold text-[#0a0a0a] mt-0.5">{task.assigneeName || 'Customer Contact'}</h2>
                <p className="text-sm font-semibold text-[#0a0a0a] mt-1">Phone: {customerPhone}</p>
              </div>

              {customerPhone !== 'N/A' && (
                <a
                  href={`tel:${customerPhone}`}
                  className="btn-primary text-xs px-4 py-2 cursor-pointer shadow-xs"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Call Now</span>
                </a>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-[#737373] uppercase font-bold text-[10px]">Reason for Follow-up</p>
              <p className="font-medium text-[#0a0a0a] bg-[#fafafa] border border-[#e5e5e5] p-3 rounded-2xl">
                {task.reason || 'Follow-up call required based on rule trigger.'}
              </p>
            </div>

            {orderId && (
              <div className="pt-3 border-t border-[#e5e5e5] flex items-center justify-between">
                <span className="text-xs text-[#737373]">Associated Order: #{orderId}</span>
                <Link to={`/orders/${orderId}`} className="btn-outline text-xs px-3 py-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Order Details</span>
                </Link>
              </div>
            )}
          </div>

          {/* Outcome Actions */}
          <div className="card-blueprint p-6 space-y-4">
            <h2 className="text-sm font-bold text-[#0a0a0a]">Select Call Outcome</h2>
            <OutcomeButtons
              taskType={task.type}
              onSelectOutcome={handleOutcome}
              disabled={completed}
            />
          </div>
        </div>

        {/* Right Column: Task Notes & Timeline */}
        <div className="space-y-6">
          <div className="card-blueprint p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#0a0a0a] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#737373]" />
              Task Notes & History
            </h2>

            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Type call notes..."
                rows={3}
                className="input-blueprint w-full text-xs"
              />
              <button
                type="submit"
                disabled={noteSaving || !noteText.trim()}
                className="btn-primary text-xs w-full py-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{noteSaving ? 'Saving...' : 'Add Note'}</span>
              </button>
            </form>

            <div className="space-y-2 max-h-72 overflow-y-auto pt-2">
              {task.notes?.length === 0 ? (
                <p className="text-xs text-[#737373]">No notes recorded for this task yet.</p>
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
