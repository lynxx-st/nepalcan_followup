import React from 'react';
import {
  CheckSquare,
  Zap,
  Layers,
  Sliders,
  RotateCcw,
  ShoppingBag,
  BarChart3,
  User,
  Clock,
  PlusCircle,
  Search,
} from 'lucide-react';
import { Agent } from '../types';

export type ViewTab =
  | 'todays_work'
  | 'next_call'
  | 'task_queues'
  | 'rule_engine'
  | 'cancelled_recovery'
  | 'orders_feed'
  | 'performance';

interface NavbarProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  agents: Agent[];
  currentAgent: Agent;
  onAgentChange: (agent: Agent) => void;
  simulatedTimeIso: string;
  onAdvanceTime: (hours: number) => void;
  pendingTasksCount: number;
  overdueTasksCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenNewOrderModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  agents,
  currentAgent,
  onAgentChange,
  simulatedTimeIso,
  onAdvanceTime,
  pendingTasksCount,
  overdueTasksCount,
  searchQuery,
  onSearchChange,
  onOpenNewOrderModal,
}) => {
  const formattedTime = new Date(simulatedTimeIso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header className="sticky top-0 z-40 bg-red-600 border-b border-red-700 text-white shadow-md">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white text-red-600 flex items-center justify-center font-black shadow-sm">
            <Zap className="w-5 h-5 text-red-600 fill-red-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-white">NepalCan Ops</span>
              <span className="text-[10px] font-black tracking-wider uppercase bg-white/20 text-white border border-white/30 px-2 py-0.5 rounded-full">
                Red & White Simple UI
              </span>
            </div>
            <p className="text-xs text-red-100 hidden sm:block font-medium">Order Confirmation & SLA Ops Control</p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-red-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search order #, phone, customer..."
              className="w-full bg-red-700/80 border border-red-500 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-red-200 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Right Section: Time Simulation & Agent Switcher */}
        <div className="flex items-center gap-3">
          {/* Time Simulation Tool */}
          <div className="hidden lg:flex items-center gap-1.5 bg-red-700 border border-red-500 px-3 py-1 rounded-lg text-xs">
            <Clock className="w-3.5 h-3.5 text-red-100" />
            <span className="text-white font-medium">{formattedTime}</span>
            <div className="h-3 w-px bg-red-500 mx-1" />
            <button
              onClick={() => onAdvanceTime(1)}
              title="Fast forward 1 hour"
              className="px-2 py-0.5 rounded bg-white text-red-700 hover:bg-red-50 font-bold transition-colors text-[11px]"
            >
              +1h
            </button>
            <button
              onClick={() => onAdvanceTime(8)}
              title="Fast forward 8 hours to trigger 7h SLA"
              className="px-2 py-0.5 rounded bg-white text-red-700 hover:bg-red-50 font-bold transition-colors text-[11px]"
            >
              +8h (7h Trigger)
            </button>
          </div>

          {/* New Order Simulator Button */}
          <button
            onClick={onOpenNewOrderModal}
            className="flex items-center gap-1.5 bg-white text-red-600 hover:bg-red-50 font-bold text-xs px-3.5 py-2 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-red-600" />
            <span className="hidden sm:inline">New Order</span>
          </button>

          {/* Agent Switcher */}
          <div className="flex items-center gap-2 bg-red-700 border border-red-500 rounded-lg px-2 py-1">
            <img
              src={currentAgent.avatar}
              alt={currentAgent.name}
              className="w-7 h-7 rounded-full object-cover border-2 border-white"
            />
            <div className="hidden sm:block text-left">
              <select
                value={currentAgent.id}
                onChange={(e) => {
                  const selected = agents.find((a) => a.id === e.target.value);
                  if (selected) onAgentChange(selected);
                }}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id} className="bg-red-800 text-white">
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <nav className="bg-red-700/90 backdrop-blur border-t border-red-500 px-4 sm:px-6 lg:px-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex space-x-1 sm:space-x-2 py-2">
          {/* Order API Feed (Promoted to center display for user request) */}
          <button
            onClick={() => onTabChange('orders_feed')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap shadow-sm ${
              currentTab === 'orders_feed'
                ? 'bg-white text-red-600 ring-2 ring-white/50'
                : 'text-red-100 hover:bg-red-600 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>1. Consolidated Orders Screen</span>
          </button>

          {/* Today's Work */}
          <button
            onClick={() => onTabChange('todays_work')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              currentTab === 'todays_work'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-red-100 hover:bg-red-600 hover:text-white'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Today's Work</span>
            {pendingTasksCount > 0 && (
              <span className="ml-1 bg-red-800 text-white text-[11px] font-black px-2 py-0.5 rounded-full">
                {pendingTasksCount}
              </span>
            )}
            {overdueTasksCount > 0 && (
              <span className="bg-white text-red-600 text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {overdueTasksCount} overdue
              </span>
            )}
          </button>

          {/* Next Call Mode */}
          <button
            onClick={() => onTabChange('next_call')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap ${
              currentTab === 'next_call'
                ? 'bg-white text-red-600 shadow-md ring-2 ring-red-300'
                : 'bg-red-800/60 text-white border border-red-500 hover:bg-red-600'
            }`}
          >
            <Zap className="w-4 h-4 fill-white text-white" />
            <span>Next Call Mode ⚡</span>
          </button>

          {/* Task Queues */}
          <button
            onClick={() => onTabChange('task_queues')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              currentTab === 'task_queues'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-red-100 hover:bg-red-600 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Task Queues</span>
          </button>

          {/* Rule Engine */}
          <button
            onClick={() => onTabChange('rule_engine')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              currentTab === 'rule_engine'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-red-100 hover:bg-red-600 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Rule Engine</span>
          </button>

          {/* Cancelled Recovery */}
          <button
            onClick={() => onTabChange('cancelled_recovery')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              currentTab === 'cancelled_recovery'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-red-100 hover:bg-red-600 hover:text-white'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Cancelled Recovery</span>
          </button>

          {/* Staff Performance */}
          <button
            onClick={() => onTabChange('performance')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              currentTab === 'performance'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-red-100 hover:bg-red-600 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Staff Analytics</span>
          </button>
        </div>
      </nav>
    </header>
  );
};
