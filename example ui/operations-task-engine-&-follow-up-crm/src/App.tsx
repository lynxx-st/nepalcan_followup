import React, { useState, useEffect } from 'react';
import { Navbar, ViewTab } from './components/Navbar';
import { TodaysWorkDashboard } from './components/TodaysWorkDashboard';
import { NextCallMode } from './components/NextCallMode';
import { TaskQueuesView } from './components/TaskQueuesView';
import { RuleEngineBuilder } from './components/RuleEngineBuilder';
import { CancellationRecoveryView } from './components/CancellationRecoveryView';
import { OrdersAndSimulator } from './components/OrdersAndSimulator';
import { PerformanceAnalytics } from './components/PerformanceAnalytics';

import {
  initialOrders,
  initialTasks,
  initialRules,
  initialRecoveryRecords,
  initialAgents,
} from './data/mockData';
import {
  Order,
  Task,
  FollowUpRule,
  RecoveryRecord,
  Agent,
  TaskQueue,
  OrderStatus,
  CustomerConfirmationStatus,
  VendorStatus,
} from './types';
import { evaluateRulesAndGenerateTasks, getSLAInfo } from './utils/ruleEngine';

export default function App() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [rules, setRules] = useState<FollowUpRule[]>(initialRules);
  const [recoveryRecords, setRecoveryRecords] = useState<RecoveryRecord[]>(
    initialRecoveryRecords
  );
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [currentAgent, setCurrentAgent] = useState<Agent>(initialAgents[0]);

  // Simulated Time ISO state (allows time travel testing for rules and SLA timers)
  const [simulatedTimeIso, setSimulatedTimeIso] = useState<string>(
    new Date('2026-07-27T21:00:00.000Z').toISOString()
  );

  const [currentTab, setCurrentTab] = useState<ViewTab>('orders_feed');
  const [selectedNextCallQueue, setSelectedNextCallQueue] = useState<TaskQueue | undefined>(
    undefined
  );
  const [selectedNextCallTaskId, setSelectedNextCallTaskId] = useState<string | undefined>(
    undefined
  );

  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [lastRunGeneratedCount, setLastRunGeneratedCount] = useState<number | null>(null);

  // Time advancement trigger
  const handleAdvanceTime = (hours: number) => {
    const current = new Date(simulatedTimeIso).getTime();
    const newTime = new Date(current + hours * 60 * 60 * 1000).toISOString();
    setSimulatedTimeIso(newTime);

    // Auto-evaluate rules on time advance (#3 Task Generator)
    const { newTasks, updatedRules } = evaluateRulesAndGenerateTasks(
      orders,
      tasks,
      rules,
      newTime,
      currentAgent.name
    );

    if (newTasks.length > 0) {
      setTasks((prev) => [...newTasks, ...prev]);
      setRules(updatedRules);
      setLastRunGeneratedCount(newTasks.length);
    }
  };

  // Run Task Generator manually
  const handleRunTaskGenerator = () => {
    const { newTasks, updatedRules } = evaluateRulesAndGenerateTasks(
      orders,
      tasks,
      rules,
      simulatedTimeIso,
      currentAgent.name
    );

    setTasks((prev) => [...newTasks, ...prev]);
    setRules(updatedRules);
    setLastRunGeneratedCount(newTasks.length);
  };

  // Complete a task & update states
  const handleCompleteTaskAndNext = (
    taskId: string,
    outcome: string,
    note?: string,
    newOrderStatus?: OrderStatus,
    newConfirmationStatus?: CustomerConfirmationStatus
  ) => {
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        if (t.id === taskId) {
          const newTimeline = [
            ...t.timeline,
            {
              id: `tl-complete-${Date.now()}`,
              timestamp: simulatedTimeIso,
              actor: currentAgent.name,
              action: `Task Completed: ${outcome}`,
              note: note || outcome,
              outcomeTag: outcome,
            },
          ];
          return {
            ...t,
            status: 'completed' as const,
            completedAt: simulatedTimeIso,
            completedBy: currentAgent.name,
            outcome,
            outcomeNotes: note,
            timeline: newTimeline,
          };
        }
        return t;
      })
    );

    // Update order status if outcome triggered status change
    const targetTask = tasks.find((t) => t.id === taskId);
    if (targetTask && (newOrderStatus || newConfirmationStatus)) {
      setOrders((prevOrders) =>
        prevOrders.map((o) => {
          if (o.id === targetTask.orderId) {
            return {
              ...o,
              status: newOrderStatus || o.status,
              confirmationStatus: newConfirmationStatus || o.confirmationStatus,
              updatedAt: simulatedTimeIso,
            };
          }
          return o;
        })
      );
    }

    // Update agent completed count
    setAgents((prev) =>
      prev.map((a) => (a.id === currentAgent.id ? { ...a, callsCompletedToday: a.callsCompletedToday + 1 } : a))
    );
  };

  // Reassign task
  const handleReassignTask = (taskId: string, newAssignee: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            assignedTo: newAssignee,
            timeline: [
              ...t.timeline,
              {
                id: `tl-reassign-${Date.now()}`,
                timestamp: simulatedTimeIso,
                actor: currentAgent.name,
                action: `Task Reassigned to ${newAssignee}`,
              },
            ],
          };
        }
        return t;
      })
    );
  };

  // Add new rule
  const handleAddRule = (newRule: Omit<FollowUpRule, 'id' | 'tasksGeneratedCount'>) => {
    const created: FollowUpRule = {
      ...newRule,
      id: `rule-${Date.now()}`,
      tasksGeneratedCount: 0,
    };
    setRules((prev) => [created, ...prev]);
  };

  // Toggle rule
  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
  };

  // Add new order to Order API feed
  const handleAddNewOrder = (newOrderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created: Order = {
      ...newOrderData,
      id: `ord-${Date.now()}`,
      createdAt: simulatedTimeIso,
      updatedAt: simulatedTimeIso,
    };
    setOrders((prev) => [created, ...prev]);

    // Immediately trigger rules to generate new tasks for the new order
    setTimeout(() => {
      const { newTasks, updatedRules } = evaluateRulesAndGenerateTasks(
        [created],
        tasks,
        rules,
        simulatedTimeIso,
        currentAgent.name
      );
      if (newTasks.length > 0) {
        setTasks((prev) => [...newTasks, ...prev]);
        setRules(updatedRules);
      }
    }, 100);
  };

  // Update order status directly in API
  const handleUpdateOrderStatus = (
    orderId: string,
    newStatus: OrderStatus,
    newConfStatus?: CustomerConfirmationStatus,
    newVendorStatus?: VendorStatus
  ) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: newStatus,
              confirmationStatus: newConfStatus || o.confirmationStatus,
              vendorStatus: newVendorStatus || o.vendorStatus,
              vendorAcceptedAt:
                newVendorStatus === 'accepted'
                  ? o.vendorAcceptedAt || simulatedTimeIso
                  : o.vendorAcceptedAt,
              updatedAt: simulatedTimeIso,
            }
          : o
      )
    );
  };

  // Update Recovery status
  const handleUpdateRecoveryStatus = (
    recordId: string,
    outcome: 'recovered' | 'lost',
    incentive?: string,
    notes?: string
  ) => {
    setRecoveryRecords((prev) =>
      prev.map((r) =>
        r.id === recordId
          ? {
              ...r,
              outcome,
              offeredIncentive: incentive || r.offeredIncentive,
              notes: notes || r.notes,
              resolvedAt: simulatedTimeIso,
            }
          : r
      )
    );
  };

  // Launch Next Call Mode helper
  const handleLaunchNextCall = (queue?: TaskQueue, taskId?: string) => {
    setSelectedNextCallQueue(queue);
    setSelectedNextCallTaskId(taskId);
    setCurrentTab('next_call');
  };

  const pendingCount = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'dismissed'
  ).length;

  const overdueCount = tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      getSLAInfo(t.dueAt, simulatedTimeIso).isOverdue
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased selection:bg-red-600 selection:text-white">
      {/* Navbar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        agents={agents}
        currentAgent={currentAgent}
        onAgentChange={setCurrentAgent}
        simulatedTimeIso={simulatedTimeIso}
        onAdvanceTime={handleAdvanceTime}
        pendingTasksCount={pendingCount}
        overdueTasksCount={overdueCount}
        searchQuery={globalSearchQuery}
        onSearchChange={setGlobalSearchQuery}
        onOpenNewOrderModal={() => setCurrentTab('orders_feed')}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {currentTab === 'todays_work' && (
          <TodaysWorkDashboard
            tasks={tasks}
            orders={orders}
            currentAgent={currentAgent}
            simulatedTimeIso={simulatedTimeIso}
            onSelectQueue={(q) => {
              setSelectedNextCallQueue(q);
              setCurrentTab('task_queues');
            }}
            onLaunchNextCall={handleLaunchNextCall}
            onQuickCompleteTask={(taskId, outcome, note) =>
              handleCompleteTaskAndNext(taskId, outcome, note)
            }
          />
        )}

        {currentTab === 'next_call' && (
          <NextCallMode
            tasks={tasks}
            orders={orders}
            currentAgent={currentAgent}
            simulatedTimeIso={simulatedTimeIso}
            initialQueue={selectedNextCallQueue}
            initialTaskId={selectedNextCallTaskId}
            onCompleteTaskAndNext={handleCompleteTaskAndNext}
            onExitNextCall={() => setCurrentTab('todays_work')}
          />
        )}

        {currentTab === 'task_queues' && (
          <TaskQueuesView
            tasks={tasks}
            orders={orders}
            agents={agents}
            simulatedTimeIso={simulatedTimeIso}
            onLaunchNextCall={handleLaunchNextCall}
            onReassignTask={handleReassignTask}
          />
        )}

        {currentTab === 'rule_engine' && (
          <RuleEngineBuilder
            rules={rules}
            onToggleRule={handleToggleRule}
            onAddRule={handleAddRule}
            onRunTaskGenerator={handleRunTaskGenerator}
            lastRunGeneratedCount={lastRunGeneratedCount}
          />
        )}

        {currentTab === 'cancelled_recovery' && (
          <CancellationRecoveryView
            recoveryRecords={recoveryRecords}
            orders={orders}
            tasks={tasks}
            onLaunchRecoveryCall={() => handleLaunchNextCall('cancelled_recovery')}
            onUpdateRecoveryStatus={handleUpdateRecoveryStatus}
          />
        )}

        {currentTab === 'orders_feed' && (
          <OrdersAndSimulator
            orders={orders}
            onAddNewOrder={handleAddNewOrder}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            simulatedTimeIso={simulatedTimeIso}
            onAdvanceTime={handleAdvanceTime}
          />
        )}

        {currentTab === 'performance' && (
          <PerformanceAnalytics agents={agents} tasks={tasks} />
        )}
      </main>
    </div>
  );
}
