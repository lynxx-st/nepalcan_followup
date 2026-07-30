import React, { useState } from 'react';
import {
  ShoppingBag,
  PlusCircle,
  Clock,
  Database,
  CheckCircle2,
  AlertTriangle,
  Search,
  UserCheck,
  Store,
  Zap,
  Filter,
  Check,
  XCircle,
  HelpCircle,
  Send,
  PackageCheck,
} from 'lucide-react';
import {
  Order,
  OrderStatus,
  CustomerConfirmationStatus,
  VendorStatus,
} from '../types';

interface OrdersAndSimulatorProps {
  orders: Order[];
  onAddNewOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateOrderStatus: (
    orderId: string,
    newStatus: OrderStatus,
    newConfStatus?: CustomerConfirmationStatus,
    newVendorStatus?: VendorStatus
  ) => void;
  simulatedTimeIso: string;
  onAdvanceTime: (hours: number) => void;
}

export const OrdersAndSimulator: React.FC<OrdersAndSimulatorProps> = ({
  orders,
  onAddNewOrder,
  onUpdateOrderStatus,
  simulatedTimeIso,
  onAdvanceTime,
}) => {
  const [showNewOrderModal, setShowNewOrderModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'unprocessed_7h' | 'cust_pending' | 'vendor_pending' | 'processing'
  >('all');

  // Form state for creating mock orders
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [city, setCity] = useState('Kathmandu');
  const [address, setAddress] = useState('');
  const [itemName, setItemName] = useState('Organic Himalayan Honey');
  const [itemPrice, setItemPrice] = useState(1800);
  const [itemQty, setItemQty] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState<'COD' | 'Paid'>('COD');

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) return;

    const newOrderNumber = `#NC-${Math.floor(1000 + Math.random() * 9000)}`;

    onAddNewOrder({
      orderNumber: newOrderNumber,
      customerName: custName,
      customerPhone: custPhone,
      customerEmail: `${custName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
      city,
      address: address || `${city} Ward 4`,
      items: [
        {
          id: `item-${Date.now()}`,
          name: itemName,
          quantity: itemQty,
          unitPrice: itemPrice,
        },
      ],
      totalAmount: itemQty * itemPrice,
      currency: 'NPR',
      status: 'pending',
      paymentStatus,
      confirmationStatus: 'pending',
      vendorStatus: 'unassigned',
    });

    setCustName('');
    setCustPhone('');
    setAddress('');
    setShowNewOrderModal(false);
  };

  // Check 7h aging helper
  const getOrderAgingHours = (order: Order) => {
    const createdTime = new Date(order.createdAt).getTime();
    const currentTime = new Date(simulatedTimeIso).getTime();
    const diffHours = (currentTime - createdTime) / (1000 * 60 * 60);
    return Math.max(0, parseFloat(diffHours.toFixed(1)));
  };

  // Flag if confirmed with both customer & vendor BUT still pending/unprocessed after 7h
  const isConfirmedUnprocessedOver7h = (order: Order) => {
    const aging = getOrderAgingHours(order);
    const isConfirmed =
      order.confirmationStatus === 'confirmed' &&
      (order.vendorStatus === 'accepted' || order.vendorStatus === 'assigned');
    const isNotProcessed = order.status === 'pending';
    return isConfirmed && isNotProcessed && aging >= 7;
  };

  // Filtered orders logic
  const filteredOrders = orders.filter((order) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        order.orderNumber.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.customerPhone.toLowerCase().includes(q) ||
        order.city.toLowerCase().includes(q);
      if (!matchQuery) return false;
    }

    // Tab category filters
    if (activeFilter === 'unprocessed_7h') return isConfirmedUnprocessedOver7h(order);
    if (activeFilter === 'cust_pending') return order.confirmationStatus === 'pending';
    if (activeFilter === 'vendor_pending')
      return order.vendorStatus === 'unassigned' || order.vendorStatus === 'assigned';
    if (activeFilter === 'processing') return order.status === 'processing';

    return true;
  });

  // Calculate top summary metrics
  const totalCount = orders.length;
  const custConfirmedCount = orders.filter((o) => o.confirmationStatus === 'confirmed').length;
  const vendorAcceptedCount = orders.filter((o) => o.vendorStatus === 'accepted').length;
  const delayedOver7hCount = orders.filter((o) => isConfirmedUnprocessedOver7h(o)).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner - Red & White Theme */}
      <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white rounded-2xl p-6 border border-red-500 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-white" />
            <h1 className="text-2xl font-black text-white">
              All-in-One Confirmation & Order Control Screen
            </h1>
          </div>
          <p className="text-xs text-red-100 font-medium">
            Single view display for Order ID, Customer Confirmation, Vendor Acceptance, and 7-Hour Processing SLA status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onAdvanceTime(1)}
            className="flex items-center gap-1.5 bg-white text-red-700 hover:bg-red-50 font-extrabold text-xs px-3.5 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <Clock className="w-4 h-4 text-red-600" />
            <span>+1 Hour</span>
          </button>

          <button
            onClick={() => onAdvanceTime(8)}
            className="flex items-center gap-1.5 bg-red-950 text-white hover:bg-red-900 font-black text-xs px-3.5 py-2.5 rounded-xl border border-red-400/40 transition-colors cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>+8 Hours (Trigger 7h SLA)</span>
          </button>

          <button
            onClick={() => setShowNewOrderModal(true)}
            className="flex items-center gap-2 bg-white text-red-600 hover:bg-red-50 font-black text-xs px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition-all"
          >
            <PlusCircle className="w-4 h-4 text-red-600" />
            <span>+ Add Incoming Order</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid - Simple Red & White */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-slate-200 p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">Total Live Orders</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{totalCount}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-red-600">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border-2 border-slate-200 p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">Customer Confirmed</p>
            <p className="text-2xl font-black text-emerald-600 font-mono">
              {custConfirmedCount} <span className="text-xs font-semibold text-slate-400">({Math.round((custConfirmedCount / (totalCount || 1)) * 100)}%)</span>
            </p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border-2 border-slate-200 p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">Vendor Accepted</p>
            <p className="text-2xl font-black text-purple-600 font-mono">
              {vendorAcceptedCount}
            </p>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
            <Store className="w-5 h-5" />
          </div>
        </div>

        <div className={`border-2 p-4 rounded-2xl shadow-sm flex items-center justify-between transition-all ${
          delayedOver7hCount > 0 
            ? 'bg-red-50 border-red-500 text-red-600 animate-pulse'
            : 'bg-white border-slate-200 text-slate-700'
        }`}>
          <div>
            <p className="text-xs font-black text-red-600">Confirmed Unprocessed (&gt;7h)</p>
            <p className="text-2xl font-black text-red-600 font-mono">
              {delayedOver7hCount}
            </p>
          </div>
          <div className="p-3 bg-red-600 text-white rounded-xl shadow-sm">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600'
              }`}
            >
              All Orders ({orders.length})
            </button>

            <button
              onClick={() => setActiveFilter('unprocessed_7h')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'unprocessed_7h'
                  ? 'bg-red-600 text-white shadow-md ring-2 ring-red-300'
                  : 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Confirmed & Unprocessed (&gt;7h)</span>
              {delayedOver7hCount > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {delayedOver7hCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveFilter('cust_pending')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === 'cust_pending'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600'
              }`}
            >
              Cust Pending ({orders.filter((o) => o.confirmationStatus === 'pending').length})
            </button>

            <button
              onClick={() => setActiveFilter('vendor_pending')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === 'vendor_pending'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600'
              }`}
            >
              Vendor Pending ({orders.filter((o) => o.vendorStatus === 'unassigned' || o.vendorStatus === 'assigned').length})
            </button>

            <button
              onClick={() => setActiveFilter('processing')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === 'processing'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600'
              }`}
            >
              Processing ({orders.filter((o) => o.status === 'processing').length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order #, phone, customer..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Consolidated Orders List - Clean Red & White cards */}
        <div className="space-y-4 pt-2">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-bold text-slate-800">No orders match the selected filter!</p>
              <p className="text-xs">Try switching filters or searching for another order number.</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const agingHours = getOrderAgingHours(order);
              const isOver7hDelayed = isConfirmedUnprocessedOver7h(order);

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border-2 p-5 transition-all space-y-4 shadow-sm ${
                    isOver7hDelayed
                      ? 'bg-red-50/60 border-red-500 ring-2 ring-red-500/30'
                      : 'bg-white border-slate-200 hover:border-red-200'
                  }`}
                >
                  {/* Row 1: Order ID, Customer Meta, Price & 7h Warning Badge */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base font-black text-red-600 font-mono bg-red-50 px-3 py-1 rounded-xl border border-red-200">
                        {order.orderNumber}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 text-sm">
                            {order.customerName}
                          </h3>
                          <span className="text-xs text-slate-500 font-mono font-semibold">({order.customerPhone})</span>
                          <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-slate-200">
                            {order.city}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">
                          {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')} • Address: {order.address}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start md:self-center">
                      <div className="text-right">
                        <div className="text-sm font-black font-mono text-slate-900">
                          NPR {order.totalAmount.toLocaleString()}
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">
                          {order.paymentStatus}
                        </span>
                      </div>

                      {/* 7-Hour SLA Warning Badge */}
                      {isOver7hDelayed ? (
                        <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-md animate-pulse">
                          <AlertTriangle className="w-4 h-4" />
                          <span>CONFIRMED BUT UNPROCESSED &gt; 7 HOURS ({agingHours}h)</span>
                        </div>
                      ) : (
                        <div className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          Age: {agingHours}h
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Single Screen Tri-State Display (1. Customer | 2. Vendor | 3. Processing) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Customer Confirmation Card */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-red-600" />
                          <span>1. Customer Confirmation</span>
                        </span>
                        <StatusPill type="customer" status={order.confirmationStatus} />
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Status: <strong className="capitalize text-slate-900">{order.confirmationStatus.replace('_', ' ')}</strong>
                      </p>
                    </div>

                    {/* Vendor Status Card */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Store className="w-4 h-4 text-red-600" />
                          <span>2. Vendor Acceptance</span>
                        </span>
                        <StatusPill type="vendor" status={order.vendorStatus} />
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Vendor: <strong className="text-slate-900">{order.vendorName || 'Unassigned'}</strong> • Status: <strong className="capitalize text-slate-900">{order.vendorStatus}</strong>
                      </p>
                    </div>

                    {/* Order Processing Status Card */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <PackageCheck className="w-4 h-4 text-red-600" />
                          <span>3. Processing SLA Status</span>
                        </span>
                        <StatusPill type="order" status={order.status} />
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Fulfillment API: <strong className="capitalize text-slate-900">{order.status}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Row 3: 1-Tap Quick Action Control Bar */}
                  <div className="bg-red-50/50 p-3 rounded-xl border border-red-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="font-extrabold text-red-700 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-red-600 fill-red-600" />
                      <span>1-Tap Action Controls:</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Customer Action */}
                      {order.confirmationStatus !== 'confirmed' && (
                        <button
                          onClick={() =>
                            onUpdateOrderStatus(order.id, order.status, 'confirmed')
                          }
                          className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-[11px] transition-colors shadow-sm cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm Customer</span>
                        </button>
                      )}

                      {/* Vendor Action */}
                      {order.vendorStatus !== 'accepted' && (
                        <button
                          onClick={() =>
                            onUpdateOrderStatus(
                              order.id,
                              order.status,
                              order.confirmationStatus,
                              'accepted'
                            )
                          }
                          className="flex items-center gap-1 bg-red-700 hover:bg-red-800 text-white font-extrabold px-3 py-1.5 rounded-lg text-[11px] transition-colors shadow-sm cursor-pointer"
                        >
                          <Store className="w-3.5 h-3.5" />
                          <span>Vendor Accept</span>
                        </button>
                      )}

                      {/* Mark Processed */}
                      {order.status === 'pending' && (
                        <button
                          onClick={() =>
                            onUpdateOrderStatus(
                              order.id,
                              'processing',
                              order.confirmationStatus,
                              order.vendorStatus
                            )
                          }
                          className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-3 py-1.5 rounded-lg text-[11px] transition-colors shadow-sm cursor-pointer"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Mark Processed</span>
                        </button>
                      )}

                      {/* Mark Delivered */}
                      {order.status === 'processing' && (
                        <button
                          onClick={() =>
                            onUpdateOrderStatus(
                              order.id,
                              'delivered',
                              order.confirmationStatus,
                              order.vendorStatus
                            )
                          }
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-[11px] transition-colors shadow-sm cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark Delivered</span>
                        </button>
                      )}

                      {/* Dropdown status selector */}
                      <select
                        value={order.status}
                        onChange={(e) =>
                          onUpdateOrderStatus(
                            order.id,
                            e.target.value as OrderStatus,
                            order.confirmationStatus,
                            order.vendorStatus
                          )
                        }
                        className="bg-white border border-slate-300 text-slate-900 text-[11px] font-bold rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
                      >
                        <option value="pending">pending</option>
                        <option value="processing">processing</option>
                        <option value="delivered">delivered</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateOrderSubmit}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border-2 border-red-200 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                Simulate Incoming E-Commerce Order
              </h3>
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="text-slate-400 hover:text-red-600 text-lg font-extrabold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g. Suman Karki"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Customer Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="+977 984123..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">City</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="Kathmandu">Kathmandu</option>
                    <option value="Pokhara">Pokhara</option>
                    <option value="Lalitpur">Lalitpur</option>
                    <option value="Chitwan">Chitwan</option>
                    <option value="Bhaktapur">Bhaktapur</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as 'COD' | 'Paid')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="COD">Cash On Delivery (COD)</option>
                    <option value="Paid">Prepaid Digital Wallet</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Item Name</label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (NPR)</label>
                  <input
                    type="number"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="px-4 py-2 font-bold text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer"
              >
                Inject Order to System
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// Helper badge pill component for statuses
const StatusPill: React.FC<{
  type: 'customer' | 'vendor' | 'order';
  status: string;
}> = ({ status }) => {
  if (status === 'confirmed' || status === 'accepted' || status === 'delivered') {
    return (
      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
        ✓ {status}
      </span>
    );
  }

  if (status === 'pending' || status === 'unassigned' || status === 'assigned') {
    return (
      <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
        ⏳ {status}
      </span>
    );
  }

  if (status === 'processing') {
    return (
      <span className="bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
        ⚡ {status}
      </span>
    );
  }

  return (
    <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
      ✕ {status}
    </span>
  );
};
