import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ruleApi } from '../services/api';
import {
  Sliders, Plus, Play, CheckCircle2, ToggleLeft, ToggleRight,
} from 'lucide-react';

export default function Rules() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastRunCount, setLastRunCount] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('order.status.changed');
  const [taskType, setTaskType] = useState('vendor-call');
  const [priority, setPriority] = useState('medium');
  const [delayHours, setDelayHours] = useState(0);
  const [slaMinutes, setSlaMinutes] = useState(60);

  const fetchRules = async () => {
    try {
      const data: any = await ruleApi.list();
      setRules(data.data || []);
    } catch (err) {
      console.error('Failed to load rules', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ruleApi.create({ name, description, trigger, taskType, priority, delayHours, slaMinutes, active: true });
      toast.success('Rule created', { duration: 3000 });
      setShowAddModal(false);
      resetForm();
      fetchRules();
    } catch {
      toast.error('Failed to create rule');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await ruleApi.toggle(id);
      fetchRules();
    } catch {
      toast.error('Failed to toggle rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await ruleApi.delete(id);
      fetchRules();
      toast('Rule deleted', { duration: 2000 });
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const handleRunGenerator = async () => {
    try {
      const result: any = await ruleApi.evaluate({});
      const count = result.data?.generatedCount || 0;
      setLastRunCount(count);
      toast.success(`Generated ${count} tasks`, { duration: 4000 });
    } catch {
      toast.error('Failed to run generator');
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setTrigger('order.status.changed');
    setTaskType('vendor-call');
    setPriority('medium');
    setDelayHours(0);
    setSlaMinutes(60);
  };

  const TRIGGER_OPTIONS = [
    'order.created', 'order.status.changed', 'order.payment.completed',
    'order.delivered', 'order.cancelled', 'customer.confirmed',
    'vendor.accepted', 'vendor.rejected',
  ];

  const TASK_TYPE_OPTIONS = [
    'customer-confirmation', 'vendor-call', 'vendor-delay',
    'cancelled-recovery', 'review-call', 'escalation',
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading rules...</div>;
  }

  return (
    <div className="space-y-6 pb-12 animate-in">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white">Automated Follow-up Rule Engine</h1>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Configure operational IF-THEN rules. Managers can tweak timing, SLAs, and triggers anytime.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRunGenerator}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition-all">
            <Play className="w-4 h-4 fill-slate-950" />
            RUN TASK GENERATOR
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition-all">
            <Plus className="w-4 h-4" />
            New Rule
          </button>
        </div>
      </div>

      {lastRunCount !== null && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Task Generator executed! Generated <strong>{lastRunCount} new tasks</strong>.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => (
          <div key={rule._id}
            className={`rounded-2xl border p-5 transition-all shadow-sm space-y-4 ${
              rule.active
                ? 'bg-white border-slate-200'
                : 'bg-slate-50 border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 text-base">{rule.name || 'Untitled Rule'}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{rule.description || rule.trigger}</p>
              </div>
              <button onClick={() => handleToggle(rule._id)}
                className="text-slate-700 hover:text-indigo-500 transition-colors cursor-pointer"
                title={rule.active ? 'Disable' : 'Enable'}>
                {rule.active
                  ? <ToggleRight className="w-8 h-8 text-indigo-600" />
                  : <ToggleLeft className="w-8 h-8 text-slate-400" />}
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-amber-600">
                  IF (Condition Trigger)
                </span>
                <div className="text-slate-800 font-mono font-medium">
                  Event: <strong className="text-indigo-600">{rule.trigger}</strong>
                  {rule.delayHours > 0 && <> AFTER <strong>{rule.delayHours}h</strong></>}
                </div>
              </div>
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 space-y-1">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-indigo-700">
                  THEN (Generate Task)
                </span>
                <div className="text-slate-800 space-y-0.5">
                  <div>
                    Type: <strong className="text-indigo-600 uppercase">{rule.taskType}</strong>
                    {' • '}Priority: <strong className="text-rose-600 uppercase">{rule.priority}</strong>
                    {rule.slaMinutes > 0 && <> • SLA: {rule.slaMinutes}m</>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => handleDelete(rule._id)}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        ))}

        {rules.length === 0 && (
          <div className="col-span-2 text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-200">
            <p className="font-bold text-slate-800">No rules yet</p>
            <p className="text-sm">Create one to get started.</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreate}
            className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">Create New Rule</h3>
              <button type="button" onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Unconfirmed Order Reminder"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Why this rule exists..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="font-extrabold uppercase text-[11px] text-amber-600">IF TRIGGER CONDITION</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Trigger</label>
                    <select value={trigger} onChange={(e) => setTrigger(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800">
                      {TRIGGER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Delay (hours)</label>
                    <input type="number" min="0" value={delayHours} onChange={(e) => setDelayHours(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" />
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 space-y-3">
                <span className="font-extrabold uppercase text-[11px] text-indigo-700">THEN CREATE TASK</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Task Type</label>
                    <select value={taskType} onChange={(e) => setTaskType(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800">
                      {TASK_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Priority</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800">
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">SLA (min)</label>
                    <input type="number" min="10" value={slaMinutes} onChange={(e) => setSlaMinutes(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
              <button type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer">
                Create Rule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
