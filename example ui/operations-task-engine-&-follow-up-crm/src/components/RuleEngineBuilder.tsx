import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Play,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { FollowUpRule, TaskQueue, TaskPriority, OrderStatus, CustomerConfirmationStatus } from '../types';

interface RuleEngineBuilderProps {
  rules: FollowUpRule[];
  onToggleRule: (ruleId: string) => void;
  onAddRule: (rule: Omit<FollowUpRule, 'id' | 'tasksGeneratedCount'>) => void;
  onRunTaskGenerator: () => void;
  lastRunGeneratedCount: number | null;
}

export const RuleEngineBuilder: React.FC<RuleEngineBuilderProps> = ({
  rules,
  onToggleRule,
  onAddRule,
  onRunTaskGenerator,
  lastRunGeneratedCount,
}) => {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Rule Form State
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [orderStatusCond, setOrderStatusCond] = useState<OrderStatus | 'any'>('pending');
  const [confStatusCond, setConfStatusCond] = useState<CustomerConfirmationStatus | 'any'>('any');
  const [timeAfterHours, setTimeAfterHours] = useState<number>(24);
  const [targetQueue, setTargetQueue] = useState<TaskQueue>('vendor_delay');
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [slaMinutes, setSlaMinutes] = useState<number>(60);
  const [reasonTemplate, setReasonTemplate] = useState('');

  const handleCreateRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !reasonTemplate.trim()) return;

    onAddRule({
      name: ruleName,
      description: ruleDescription || 'Custom automated operations rule.',
      triggerCondition: {
        orderStatus: orderStatusCond,
        confirmationStatus: confStatusCond,
        timeAfterHours: Number(timeAfterHours),
      },
      action: {
        createQueue: targetQueue,
        priority,
        slaMinutes: Number(slaMinutes),
        reasonTemplate,
      },
      enabled: true,
    });

    // Reset & close
    setRuleName('');
    setRuleDescription('');
    setReasonTemplate('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white">Automated Follow-up Rule Engine</h1>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Configure operational IF-THEN rules instead of hardcoding workflows. Managers can tweak timing, SLAs, and triggers anytime.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRunTaskGenerator}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition-all"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>RUN TASK GENERATOR</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Rule</span>
          </button>
        </div>
      </div>

      {lastRunGeneratedCount !== null && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>
              Task Generator Executed Successfully! Evaluated orders against active rules and generated{' '}
              <strong>{lastRunGeneratedCount} new tasks</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Rules Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`rounded-2xl border p-5 transition-all shadow-sm space-y-4 ${
              rule.enabled
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/60 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                    {rule.name}
                  </h3>
                  <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                    Generated: {rule.tasksGeneratedCount}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {rule.description}
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => onToggleRule(rule.id)}
                className="text-slate-700 dark:text-slate-300 hover:text-indigo-500 transition-colors cursor-pointer"
                title={rule.enabled ? 'Disable Rule' : 'Enable Rule'}
              >
                {rule.enabled ? (
                  <ToggleRight className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-400" />
                )}
              </button>
            </div>

            {/* IF-THEN Visual Constructor Summary */}
            <div className="space-y-2 text-xs">
              {/* IF Condition Box */}
              <div className="bg-slate-100 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-amber-600 dark:text-amber-400">
                  IF (Condition Trigger)
                </span>
                <div className="text-slate-800 dark:text-slate-200 font-mono font-medium">
                  Order Status == <strong className="text-indigo-600 dark:text-indigo-400">{rule.triggerCondition.orderStatus || 'any'}</strong>
                  {rule.triggerCondition.confirmationStatus && (
                    <span>
                      {' '}
                      AND Customer Status == <strong className="text-indigo-600 dark:text-indigo-400">{rule.triggerCondition.confirmationStatus}</strong>
                    </span>
                  )}
                  <span> AFTER <strong>{rule.triggerCondition.timeAfterHours} Hours</strong></span>
                </div>
              </div>

              {/* THEN Action Box */}
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 space-y-1">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-indigo-700 dark:text-indigo-300">
                  THEN (Generate Task)
                </span>
                <div className="text-slate-800 dark:text-slate-200 space-y-0.5">
                  <div>
                    Queue: <strong className="text-indigo-600 dark:text-indigo-400 uppercase">{rule.action.createQueue}</strong> • Priority:{' '}
                    <strong className="text-rose-600 dark:text-rose-400 uppercase">{rule.action.priority}</strong> • SLA: {rule.action.slaMinutes}m
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                    "{rule.action.reasonTemplate}"
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRuleSubmit}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 space-y-5 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                Create New Operational Follow-Up Rule
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Unconfirmed Order 2-Hour Reminder"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  placeholder="Explain why this rule exists..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* IF Condition Fields */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="font-extrabold uppercase text-[11px] text-amber-600 dark:text-amber-400">
                  IF TRIGGER CONDITION
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">Order Status</label>
                    <select
                      value={orderStatusCond}
                      onChange={(e) => setOrderStatusCond(e.target.value as OrderStatus | 'any')}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
                    >
                      <option value="any">Any Status</option>
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Customer Status
                    </label>
                    <select
                      value={confStatusCond}
                      onChange={(e) =>
                        setConfStatusCond(e.target.value as CustomerConfirmationStatus | 'any')
                      }
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
                    >
                      <option value="any">Any</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Time Elapsed After Event (Hours)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={timeAfterHours}
                    onChange={(e) => setTimeAfterHours(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* THEN Action Fields */}
              <div className="bg-indigo-50/50 dark:bg-indigo-950/40 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 space-y-3">
                <span className="font-extrabold uppercase text-[11px] text-indigo-700 dark:text-indigo-300">
                  THEN CREATE TASK
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">Target Queue</label>
                    <select
                      value={targetQueue}
                      onChange={(e) => setTargetQueue(e.target.value as TaskQueue)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
                    >
                      <option value="customer_confirmation">Customer Conf.</option>
                      <option value="vendor_action">Vendor Action</option>
                      <option value="vendor_delay">Vendor Delay</option>
                      <option value="cancelled_recovery">Cancelled Recovery</option>
                      <option value="review_calls">Review Calls</option>
                      <option value="escalations">Escalations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TaskPriority)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">SLA (Minutes)</label>
                    <input
                      type="number"
                      min="10"
                      value={slaMinutes}
                      onChange={(e) => setSlaMinutes(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Task Reason Explanation Template
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={reasonTemplate}
                    onChange={(e) => setReasonTemplate(e.target.value)}
                    placeholder="State clearly why this task exists for the employee..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md"
              >
                Create Follow-up Rule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
