import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { SimulatedTimeProvider } from './hooks/useSimulatedTime';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import TodayWork from './pages/TodayWork';
import NextCall from './pages/NextCall';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import OrderConfirmedUnprocessed from './pages/OrderConfirmedUnprocessed';
import OrderShipped from './pages/OrderShipped';
import OrderPendingReview from './pages/OrderPendingReview';
import OrderCustomerResponse from './pages/OrderCustomerResponse';
import OrderVendorResponse from './pages/OrderVendorResponse';
import Reviews from './pages/Reviews';
import Returns from './pages/Returns';
import TaskDetail from './pages/TaskDetail';
import Recovery from './pages/Recovery';
import Rules from './pages/Rules';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Login from './pages/Login';

function AppRoutes() {
  const token = localStorage.getItem('token');

  return (
    <Routes>
      <Route path="/" element={token ? <Navigate to="/today" /> : <Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/today" element={<TodayWork />} />
      <Route path="/next" element={<NextCall />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/orders/:commerceOrderId" element={<OrderDetail />} />
      <Route path="/orders/:commerceOrderId/confirmed-unprocessed" element={<OrderConfirmedUnprocessed />} />
      <Route path="/orders/:commerceOrderId/shipped" element={<OrderShipped />} />
      <Route path="/orders/:commerceOrderId/pending-review" element={<OrderPendingReview />} />
      <Route path="/orders/:commerceOrderId/customer-response" element={<OrderCustomerResponse />} />
      <Route path="/orders/:commerceOrderId/vendor-response" element={<OrderVendorResponse />} />
      <Route path="/reviews" element={<Reviews />} />
      <Route path="/returns" element={<Returns />} />
      <Route path="/tasks/:id" element={<TaskDetail />} />
      <Route path="/recovery" element={<Recovery />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/users" element={<Users />} />
    </Routes>
  );
}

export default function App() {
  const token = localStorage.getItem('token');

  return (
    <SimulatedTimeProvider>
      <Toaster position="top-right" richColors closeButton />
      <ErrorBoundary>
          <div className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] font-sans antialiased">
            {token && <Navbar />}
            <main className={token ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6' : ''}>
              <AppRoutes />
            </main>
            {token && <BottomNav />}
          </div>
        </ErrorBoundary>
      </SimulatedTimeProvider>
  );
}
