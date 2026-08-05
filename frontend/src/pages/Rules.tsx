import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ruleApi } from '../services/api';
import Breadcrumbs from '../components/Breadcrumbs';
import {
  Sliders, Plus, Play, CheckCircle2, ToggleLeft, ToggleRight, Trash2, X,
} from 'lucide-react';

export default function Rules() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('order.status.changed');
  const [taskType, setTaskType] = useState('vendor-call');
  const [priority, setPriority] = useState('medium');
  const [delayHours, setDelayHours] = useState(0);
  const [slaMinutes, setSlaMinutes] = useState(60);

  const fetchRules = async () => {
    try {
      setLoading(true);
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

  const resetForm = () => {
    setName('');
    setDescription('');
    setTrigger('order.status.changed');
    setTaskType('vendor-call');
    setPriority('medium');
    setDelayHours(0);
    setSlaMinutes(60);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ruleApi.create({ name, description, trigger, taskType, priority, delayHours, slaMinutes, active: true });
      toast.success('Rule created successfully');
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
    if (!confirm('Delete this rule configuration?')) return;
    try {
      await ruleApi.delete(id);
      fetchRules();
      toast.success('Rule deleted');
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const handleRunGenerator = async () => {
    try {
      const result: any = await ruleApi.evaluate({});
      const count = result.data?.generatedCount || 0;
      toast.success(`Evaluated rules! Generated ${count} new tasks.`);
    } catch {
      toast.error('Failed to run generator');
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-in">
      <Breadcrumbs items={[{ label: 'Task Rules Engine' }]} />

      {/* Header Container */}
      <div className="card-blueprint p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0a0a0a]">Task Generation Rules</h1>
            <span className="badge-pill badge-pill-solid text-[10px] uppercase">
              {rules.length} Rules
            </span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            Configure event-driven task creation logic, delay windows, and SLA targets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleRunGenerator} className="btn-outline text-xs px-3.5 py-2 cursor-pointer">
            <Play className="w-3.5 h-3.5" /> Evaluate Rules
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs px-4 py-2 cursor-pointer shadow-xs">
            <Plus className="w-3.5 h-3.5" /> Create Rule
          </button>
        </div>
      </div>

      {/* Rules Grid */}
      {loading ? (
        <div className="text-center py-12 text-xs text-[#737373] animate-pulse">
          Loading rule configurations...
        </div>
      ) : rules.length === 0 ? (
        <div className="card-blueprint p-12 text-center space-y-2">
          <Sliders className="w-8 h-8 text-[#737373] mx-auto" />
          <h3 className="font-semibold text-sm text-[#0a0a0a]">No Rules Defined</h3>
          <p className="text-xs text-[#737373]">Create task generation rules to automatically generate follow-up calls from order events.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div
              key={rule._id}
              className="card-blueprint p-5 space-y-4 hover:border-[#0a0a0a] transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#0a0a0a]">{rule.name}</h3>
                    <span className={`badge-pill text-[10px] uppercase ${
                      rule.priority === 'critical' ? 'badge-pill-ember' : 'badge-pill-soft'
                    }`}>
                      {rule.priority || 'medium'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggle(rule._id)}
                    className={`p-1 text-[#737373] hover:text-[#0a0a0a] cursor-pointer`}
                    title={rule.active ? 'Disable rule' : 'Enable rule'}
                  >
                    {rule.active ? (
                      <ToggleRight className="w-6 h-6 text-[#0a0a0a]" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-[#737373]" />
                    )}
                  </button>
                </div>

                {rule.description && (
                  <p className="text-xs text-[#737373]">{rule.description}</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs bg-[#fafafa] border border-[#e5e5e5] p-3 rounded-2xl">
                  <div>
                    <span className="text-[#737373] text-[10px] uppercase">Trigger Event</span>
                    <p className="font-semibold text-[#0a0a0a] truncate">{rule.trigger}</p>
                  </div>
                  <div>
                    <span className="text-[#737373] text-[10px] uppercase">Task Type</span>
                    <p className="font-semibold text-[#0a0a0a]">{rule.taskType}</p>
                  </div>
                  <div>
                    <span className="text-[#737373] text-[10px] uppercase">Delay Hours</span>
                    <p className="font-semibold text-[#0a0a0a]">{rule.delayHours || 0}h</p>
                  </div>
                  <div>
                    <span className="text-[#737373] text-[10px] uppercase">SLA Target</span>
                    <p className="font-semibold text-[#0a0a0a]">{rule.slaMinutes || 60} mins</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#f5f5f5]">
                <span className={`badge-pill text-[10px] ${rule.active ? 'badge-pill-solid' : 'badge-pill-soft'}`}>
                  {rule.active ? 'Active' : 'Disabled'}
                </span>
                <button
                  onClick={() => handleDelete(rule._id)}
                  className="btn-destructive text-xs px-3 py-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in-fast">
          <div className="bg-[#ffffff] card-blueprint p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
              <h3 className="font-bold text-sm text-[#0a0a0a]">Create Task Rule</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-[#737373] hover:text-[#0a0a0a]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="text-[#737373] font-medium mb-1 block">Rule Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vendor Delay Call Task"
                  className="input-blueprint w-full"
                />
              </div>

              <div>
                <label className="text-[#737373] font-medium mb-1 block">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Rule purpose description..."
                  className="input-blueprint w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#737373] font-medium mb-1 block">Trigger Event</label>
                  <select
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value)}
                    className="input-blueprint w-full"
                  >
                    <option value="order.created">order.created</option>
                    <option value="order.status.changed">order.status.changed</option>
                    <option value="order.delivered">order.delivered</option>
                    <option value="order.cancelled">order.cancelled</option>
                    <option value="customer.confirmed">customer.confirmed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#737373] font-medium mb-1 block">Task Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="input-blueprint w-full"
                  >
                    <option value="customer-confirmation">customer-confirmation</option>
                    <option value="vendor-call">vendor-call</option>
                    <option value="vendor-delay">vendor-delay</option>
                    <option value="cancelled-recovery">cancelled-recovery</option>
                    <option value="review-call">review-call</option>
                    <option value="escalation">escalation</option>
                    <option value="logistics-followup">logistics-followup</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[#737373] font-medium mb-1 block">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="input-blueprint w-full"
                  >
                    <option value="critical">critical</option>
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#737373] font-medium mb-1 block">Delay (Hours)</label>
                  <input
                    type="number"
                    value={delayHours}
                    onChange={(e) => setDelayHours(Number(e.target.value))}
                    className="input-blueprint w-full"
                  />
                </div>
                <div>
                  <label className="text-[#737373] font-medium mb-1 block">SLA (Mins)</label>
                  <input
                    type="number"
                    value={slaMinutes}
                    onChange={(e) => setSlaMinutes(Number(e.target.value))}
                    className="input-blueprint w-full"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end pt-3 border-t border-[#e5e5e5]">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary text-xs px-3 py-1.5">
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs px-4 py-1.5">
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
