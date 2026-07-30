function matchesCondition(orderData, condition) {
  if (!condition || Object.keys(condition).length === 0) return true;
  for (const [key, value] of Object.entries(condition)) {
    const parts = key.split('.');
    let actual = orderData;
    for (const part of parts) {
      if (actual && typeof actual === 'object') {
        actual = actual[part];
      } else {
        actual = undefined;
        break;
      }
    }
    if (actual !== value) return false;
  }
  return true;
}

function buildReason(rule, orderData) {
  const lines = [];
  if (orderData.customerName) lines.push(`Customer: ${orderData.customerName}`);
  if (orderData.orderNumber) lines.push(`Order: ${orderData.orderNumber}`);
  switch (rule.trigger) {
    case 'order.status.changed':
      lines.push(`Order status changed to ${orderData.newStatus || 'updated'}.`); break;
    case 'order.delivered':
      lines.push('Order delivered. Customer review required.'); break;
    case 'order.cancelled':
      lines.push('Order was cancelled. Recovery follow-up needed.'); break;
    case 'customer.confirmed':
      lines.push('Customer confirmed the order.'); break;
    case 'vendor.accepted':
      lines.push('Vendor accepted the order.'); break;
    case 'vendor.rejected':
      lines.push('Vendor rejected the order.'); break;
    case 'order.payment.completed':
      lines.push('Payment completed.'); break;
    case 'commerce.order.synced':
      lines.push(`Order ${orderData.newStatus || 'synced'} from commerce system.`); break;
    default:
      lines.push(`Triggered by ${rule.trigger}.`);
  }
  return lines.join(' ');
}

module.exports = { matchesCondition, buildReason };
