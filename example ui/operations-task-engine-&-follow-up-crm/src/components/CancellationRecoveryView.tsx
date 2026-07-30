import React, { useState } from 'react';
import {
  RotateCcw,
  DollarSign,
  PieChart as PieIcon,
  Tag,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Gift,
  Zap,
  PhoneCall,
  Search,
  Filter,
} from 'lucide-react';
import { RecoveryRecord, Order, Task } from '../types';

interface CancellationRecoveryViewProps {
  recoveryRecords: RecoveryRecord[];
  orders: Order[];
  tasks: Task[];
  onLaunchRecoveryCall: (taskId?: string) => void;
  onUpdateRecoveryStatus: (
    recordId: string,
    outcome: 'recovered' | 'lost',
    incentive?: string,
    notes?: string
  ) => void;
}

export const CancellationRecoveryView: React.FC<CancellationRecoveryViewProps> = ({
  recoveryRecords,
  orders,
  tasks,
  onLaunchRecoveryCall,
  onUpdateRecoveryStatus,
}) => {
  const [filterOutcome, setFilterOutcome] = useState<'all' | 'pending' | 'recovered' | 'lost'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate Metrics (#6)
  const totalRecords = recoveryRecords.length;
  const recoveredRecords = recoveryRecords.filter((r) => r.outcome === 'recovered');
  const lostRecords = recoveryRecords.filter((r) => r.outcome === 'lost');
  const pendingRecords = recoveryRecords.filter((r) => r.outcome === 'pending');

  const recoveryRate =
    recoveredRecords.length + lostRecords.length > 0
      ? Math.round((recoveredRecords.length / (recoveredRecords.length + lostRecords.length)) * 100)
      : 0;

  const totalRecoveredRevenue = recoveredRecords.reduce((sum, r) => sum + r.revenueAmount, 0);

  // Common Cancellation Reasons Distribution
  const reasonCounts: Record<string, number> = {};
  recoveryRecords.forEach((r) => {
    const reason = r.cancellationReason || 'Other / Unspecified';
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  });

  const filteredRecords = recoveryRecords.filter((r) => {
    if (filterOutcome !== 'all' && r.outcome !== filterOutcome) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.orderNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.cancellationReason.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white rounded-2xl p-6 border border-rose-900/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-rose-400" />
            <h1 className="text-2xl font-black text-white">Cancellation Revenue Recovery Engine</h1>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Don't let lost orders stay lost. Turn cancellations into saved sales with automated coupon offers and dedicated recovery queues.
          </p>
        </div>

        <button
          onClick={() => onLaunchRecoveryCall()}
          className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-rose-400 hover:from-rose-400 hover:to-rose-300 text-white font-black text-xs px-5 py-3 rounded-xl shadow-lg cursor-pointer transition-all transform hover:scale-105"
        >
          <Zap className="w-4 h-4 fill-white" />
          <span>START RECOVERY CALL QUEUE</span>
        </button>
      </div>

      {/* Recovery Performance Metrics Cards (#6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue Recovered */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Recovered Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            NPR {totalRecoveredRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            From {recoveredRecords.length} saved customer orders
          </div>
        </div>

        {/* Recovery Rate % */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Recovery Rate</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
            {recoveryRate}%
          </div>
          <div className="text-[11px] text-slate-500">
            Target benchmark: 35%+ recovery rate
          </div>
        </div>

        {/* Pending Recovery Queue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Pending Recovery</span>
            <Gift className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            {pendingRecords.length} Orders
          </div>
          <div className="text-[11px] text-slate-500">
            Active calls waiting for coupon offer
          </div>
        </div>

        {/* Total Lost */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Unrecoverable Lost</span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-700 dark:text-slate-300">
            {lostRecords.length} Orders
          </div>
          <div className="text-[11px] text-slate-500">Closed after customer call</div>
        </div>
      </div>

      {/* Cancellation Reasons Breakdown Chart Bar (#6) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wide flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-rose-500" />
            <span>Most Common Cancellation Reasons</span>
          </h3>
          <span className="text-xs text-slate-500 font-medium">Insights for Management</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(reasonCounts).map(([reason, count]) => {
            const percentage = Math.round((count / totalRecords) * 100) || 0;
            return (
              <div
                key={reason}
                className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{reason}</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {count} ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recovery Queue Records Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
            Recovery Action Records
          </h3>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order or customer..."
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
              <button
                onClick={() => setFilterOutcome('all')}
                className={`px-3 py-1 rounded-md font-semibold ${
                  filterOutcome === 'all'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterOutcome('pending')}
                className={`px-3 py-1 rounded-md font-semibold ${
                  filterOutcome === 'pending'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setFilterOutcome('recovered')}
                className={`px-3 py-1 rounded-md font-semibold ${
                  filterOutcome === 'recovered'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Recovered
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 font-mono text-sm">
                    {record.orderNumber}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {record.customerName} ({record.customerPhone})
                  </span>
                  <span className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold px-2 py-0.5 rounded text-[10px]">
                    Reason: {record.cancellationReason}
                  </span>
                </div>

                <div className="text-slate-500">
                  Value: <strong className="font-mono text-slate-800 dark:text-slate-200">NPR {record.revenueAmount.toLocaleString()}</strong> • Offered Incentive:{' '}
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">{record.offeredIncentive}</span>
                </div>

                {record.notes && (
                  <p className="text-slate-600 dark:text-slate-400 italic text-[11px] bg-slate-50 dark:bg-slate-800/60 p-2 rounded">
                    "{record.notes}"
                  </p>
                )}
              </div>

              {/* Status Badge & Actions */}
              <div className="flex items-center gap-3 shrink-0">
                {record.outcome === 'recovered' && (
                  <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Recovered</span>
                  </span>
                )}

                {record.outcome === 'lost' && (
                  <span className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400 font-bold px-3 py-1 rounded-full border border-slate-300 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Closed Lost</span>
                  </span>
                )}

                {record.outcome === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        onUpdateRecoveryStatus(
                          record.id,
                          'recovered',
                          '10% Coupon (NEPAL10)',
                          'Customer accepted coupon offer over recovery call.'
                        )
                      }
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Mark Recovered
                    </button>
                    <button
                      onClick={() =>
                        onUpdateRecoveryStatus(
                          record.id,
                          'lost',
                          'None',
                          'Customer declined recovery incentive.'
                        )
                      }
                      className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Mark Lost
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
