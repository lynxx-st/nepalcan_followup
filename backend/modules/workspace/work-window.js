const { Setting, CommerceOrder } = require('../../database/models');
const WORK = ['pending', 'in-progress', 'overdue'];
function validDate(value) {
  return value === '' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
}
async function startDate() {
  const row = await Setting.findOne({ key: 'pendingWorkStartDate' }).lean();
  return validDate(row?.value) && row?.value ? row.value : '';
}
const since = date => new Date(`${date}T00:00:00+05:45`);
const orderDate = { $convert: { input: { $ifNull: ['$externalCreatedAt', { $ifNull: ['$commerce.createdAt', '$createdAt'] }] }, to: 'date', onError: '$createdAt', onNull: '$createdAt' } };
async function orderFilter() {
  const date = await startDate();
  if (!date) return {};
  // Historical terminal orders stay discoverable. Only open work is limited.
  return { $or: [{ workflowStage: { $in: ['reviewed', 'returned', 'cancelled', 'unrecoverable'] } }, { $expr: { $gte: [orderDate, since(date)] } }] };
}
async function excludedOrders() {
  const date = await startDate();
  if (!date) return null;
  const rows = await CommerceOrder.find({ $expr: { $lt: [orderDate, since(date)] } }).select('commerceOrderId orderId').lean();
  const known = await CommerceOrder.find({}).select('commerceOrderId orderId').lean();
  return { date, keys: rows.flatMap(o => [o.commerceOrderId, o.orderId]).filter(Boolean), known: known.flatMap(o => [o.commerceOrderId, o.orderId]).filter(Boolean) };
}
async function taskFilter() {
  const excluded = await excludedOrders();
  if (!excluded) return {};
  return { $or: [{ status: { $nin: WORK } }, { $and: [
    { 'sourceOrder.orderId': { $nin: excluded.keys } }, { orderId: { $nin: excluded.keys } },
    // Tasks without a linked order use their own creation date.
    { $or: [{ 'sourceOrder.orderId': { $in: excluded.known } }, { orderId: { $in: excluded.known } }, { createdAt: { $gte: since(excluded.date) } }] }
  ] }] };
}
async function returnFilter() {
  const excluded = await excludedOrders();
  if (!excluded) return {};
  return { $or: [{ workflowStage: 'completed' }, { $and: [{ commerceOrderId: { $nin: excluded.keys } }, { orderId: { $nin: excluded.keys } }, { $or: [{ commerceOrderId: { $in: excluded.known } }, { orderId: { $in: excluded.known } }, { createdAt: { $gte: since(excluded.date) } }] }] }] };
}
const and = (...filters) => ({ $and: filters });
module.exports = { validDate, startDate, since, orderFilter, taskFilter, returnFilter, and };
