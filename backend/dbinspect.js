require('dotenv').config();
const m = require('mongoose');
const id = '6a73de7f73ca831923099b96';
(async () => {
  await m.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const s = m.connection.db;
  const t = await s.collection('tasks').findOne({ 'sourceOrder.orderId': id });
  console.log('taskByMongo', JSON.stringify({ sourceOrder: t && t.sourceOrder, orderId: t && t.orderId, orderNumber: t && t.orderNumber, type: t && t.type, status: t && t.status }));
  const t2 = await s.collection('tasks').findOne({ taskNumber: 'TKN-MSIFWNAM-59ZS' });
  console.log('taskByTkn', JSON.stringify({ sourceOrder: t2 && t2.sourceOrder, orderId: t2 && t2.orderId, orderNumber: t2 && t2.orderNumber, type: t2 && t2.type }));
  const o1 = await s.collection('commerce_orders').findOne({ commerceOrderId: id });
  console.log('orderCommerceIdEq', o1 && JSON.stringify({ commerceOrderId: o1.commerceOrderId, orderId: o1.orderId, workflowStage: o1.workflowStage, customer: o1.customer }));
  const o2 = await s.collection('commerce_orders').findOne({ orderId: id });
  console.log('orderOrderIdEq', o2 && JSON.stringify({ commerceOrderId: o2.commerceOrderId, orderId: o2.orderId }));
  const sample = await s.collection('tasks').findOne({ type: 'customer-confirmation', status: { $in: ['pending', 'overdue'] } });
  console.log('=== sampleTask', JSON.stringify({ sourceOrder: sample && sample.sourceOrder, orderId: sample && sample.orderId, orderNumber: sample && sample.orderNumber, customerPhone: sample && sample.customerPhone }));
  await m.disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });