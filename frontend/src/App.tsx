import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { SimulatedTimeProvider } from './hooks/useSimulatedTime';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import TodayWork from './pages/TodayWork';
import NextCall from './pages/NextCall';
import TaskQueues from './pages/TaskQueues';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import TaskDetail from './pages/TaskDetail';
import Recovery from './pages/Recovery';
import Rules from './pages/Rules';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import Login from './pages/Login';

function AppRoutes() {
  const token = localStorage.getItem('token');

  return (
    <Routes>
      <Route path="/" element={token ? <Navigate to="/today" /> : <Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/today" element={<TodayWork />} />
      <Route path="/next" element={<NextCall />} />
      <Route path="/queues" element={<TaskQueues />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/orders/:commerceOrderId" element={<OrderDetail />} />
      <Route path="/tasks/:id" element={<TaskDetail />} />
      <Route path="/recovery" element={<Recovery />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}

export default function App() {
  const token = localStorage.getItem('token');

  return (
    <SimulatedTimeProvider>
      <Toaster position="top-right" richColors closeButton />
      <ErrorBoundary>
          <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
            {token && <Navbar />}
            <main className={token ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6' : ''}>
              <AppRoutes />
            </main>
          </div>
        </ErrorBoundary>
      </SimulatedTimeProvider>
  );
}
