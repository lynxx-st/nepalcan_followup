import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { SimulatedTimeProvider } from "./hooks/useSimulatedTime";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";
import Workspace, { Employees, Automation, Archive } from "./pages/Workspace";

const Orders = lazy(() => import("./pages/Orders"));
const CancelledOrders = lazy(() => import("./pages/CancelledOrders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const OrderCollectedByLogistics = lazy(
  () => import("./pages/OrderCollectedByLogistics"),
);
const OrderConfirmedUnprocessed = lazy(
  () => import("./pages/OrderConfirmedUnprocessed"),
);
const OrderShipped = lazy(() => import("./pages/OrderShipped"));
const OrderPendingReview = lazy(() => import("./pages/OrderPendingReview"));
const OrderCustomerResponse = lazy(
  () => import("./pages/OrderCustomerResponse"),
);
const OrderVendorResponse = lazy(() => import("./pages/OrderVendorResponse"));
const OrderCancelled = lazy(() => import("./pages/OrderCancelled"));
const OrderHold = lazy(() => import("./pages/OrderHold"));

const TaskDetail = lazy(() => import("./pages/TaskDetail"));
const Recovery = lazy(() => import("./pages/Recovery"));
const Rules = lazy(() => import("./pages/Rules"));
const Stats = lazy(() => import("./pages/Stats"));
const Settings = lazy(() => import("./pages/Settings"));

const Login = lazy(() => import("./pages/Login"));

function AppRoutes() {
  const token = localStorage.getItem("token");

  if (!token && !["/", "/login"].includes(window.location.pathname))
    return <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route path="/" element={token ? <Navigate to="/today" /> : <Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/team-work" element={<Workspace mode="team" />} />
      <Route
        path="/automation"
        element={token ? <Automation /> : <Navigate to="/login" />}
      />
      <Route
        path="/archive"
        element={token ? <Archive /> : <Navigate to="/login" />}
      />
      <Route path="/today" element={<Workspace />} />
      <Route path="/next" element={<Workspace />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/cancelled-orders" element={<CancelledOrders />} />
      <Route path="/orders/:commerceOrderId" element={<OrderDetail />} />
      <Route
        path="/orders/:commerceOrderId/confirmed-unprocessed"
        element={<OrderConfirmedUnprocessed />}
      />
      <Route
        path="/orders/:commerceOrderId/collected-by-logistics"
        element={<OrderCollectedByLogistics />}
      />
      <Route
        path="/orders/:commerceOrderId/shipped"
        element={<OrderShipped />}
      />
      <Route
        path="/orders/:commerceOrderId/pending-review"
        element={<OrderPendingReview />}
      />
      <Route
        path="/orders/:commerceOrderId/customer-response"
        element={<OrderCustomerResponse />}
      />
      <Route
        path="/orders/:commerceOrderId/vendor-response"
        element={<OrderVendorResponse />}
      />
      <Route
        path="/orders/:commerceOrderId/cancelled"
        element={<OrderCancelled />}
      />
      <Route path="/orders/:commerceOrderId/hold" element={<OrderHold />} />
      <Route path="/reviews" element={<Workspace mode="reviews" />} />
      <Route path="/returns" element={<Workspace mode="returns" />} />
      <Route path="/tasks/:id" element={<TaskDetail />} />
      <Route path="/recovery" element={<Recovery />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/users" element={<Employees />} />
    </Routes>
  );
}

export default function App() {
  const token = localStorage.getItem("token");

  return (
    <SimulatedTimeProvider>
      <Toaster position="top-right" richColors closeButton />
      <ErrorBoundary>
        <div className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] font-sans antialiased">
          {token && <Navbar />}
          <main
            className={
              token
                ? "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6"
                : ""
            }
          >
            <Suspense
              fallback={
                <p role="status" className="p-8 text-sm text-gray-500">
                  Loading workspace…
                </p>
              }
            >
              <AppRoutes />
            </Suspense>
          </main>
          {token && <BottomNav />}
        </div>
      </ErrorBoundary>
    </SimulatedTimeProvider>
  );
}
