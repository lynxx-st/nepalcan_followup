import React from 'react';
import {
  BarChart3,
  User,
  PhoneCall,
  Clock,
  CheckCircle2,
  TrendingUp,
  Award,
  Zap,
} from 'lucide-react';
import { Agent, Task } from '../types';

interface PerformanceAnalyticsProps {
  agents: Agent[];
  tasks: Task[];
}

export const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({
  agents,
  tasks,
}) => {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-black text-white">Staff Performance & Coaching Analytics</h1>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Real-time operations metrics per staff member. Measure call efficiency, confirmation accuracy, vendor turnaround, and cancellation recovery.
          </p>
        </div>
      </div>

      {/* Staff Leaderboard & Coaching Cards Grid (#10) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map((agent) => {
          // Calculate agent completed tasks from live tasks
          const agentTasks = tasks.filter((t) => t.assignedTo === agent.name);
          const activeTasks = agentTasks.filter((t) => t.status !== 'completed').length;
          const completedToday = agent.callsCompletedToday + agentTasks.filter((t) => t.status === 'completed').length;

          return (
            <div
              key={agent.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow"
            >
              {/* Profile Bar */}
              <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <img
                  src={agent.avatar}
                  alt={agent.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500 shadow-sm"
                />
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{agent.role}</p>
                </div>
              </div>

              {/* Core Metrics (#10) */}
              <div className="space-y-2 text-xs">
                {/* Calls Completed */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Calls Completed</span>
                  </span>
                  <span className="font-black text-slate-900 dark:text-slate-100 font-mono text-sm">
                    {completedToday}
                  </span>
                </div>

                {/* Avg Call Duration */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Avg Call Duration</span>
                  </span>
                  <span className="font-black text-slate-900 dark:text-slate-100 font-mono">
                    {Math.floor(agent.avgCallDurationSec / 60)}m {agent.avgCallDurationSec % 60}s
                  </span>
                </div>

                {/* Confirmation Rate */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Confirmation Rate</span>
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {agent.confirmationRate}%
                  </span>
                </div>

                {/* Vendor Acceptance Rate */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                    <span>Vendor Acceptance</span>
                  </span>
                  <span className="font-black text-blue-600 dark:text-blue-400 font-mono">
                    {agent.vendorAcceptanceRate}%
                  </span>
                </div>

                {/* Recovery Rate */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-rose-500" />
                    <span>Cancellation Recovery</span>
                  </span>
                  <span className="font-black text-rose-600 dark:text-rose-400 font-mono">
                    {agent.recoveryRate}%
                  </span>
                </div>

                {/* Active Workload */}
                <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 font-bold">
                  <span className="text-indigo-800 dark:text-indigo-300">Active Workload:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                    {activeTasks} Tasks Remaining
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
