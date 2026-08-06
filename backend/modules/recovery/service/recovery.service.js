const { RecoveryCampaign } = require('../../../database/models');
const { NotFoundError } = require('../../../src/middleware/errorHandler');

class RecoveryService {
  async createCampaign(data) {
    return RecoveryCampaign.create(data);
  }

  async recordOrderRecovery({ order, isCancel, fromStatus, toStatus, recoveredBy }) {
    const orderId = order.commerceOrderId || String(order._id);
    const customerName = order.customer && typeof order.customer === 'object' ? order.customer.name : order.customer;
    const customerPhone = order.customer?.phone || order.customerPhone;
    const totalAmount = order.commerce?.totalAmount || order.totalAmount || 0;
    const reason = order.commerce?.cancelledReason || order.cancelledReason || 'Not specified';
    const orderNumber = order.orderNumber || order.orderId || orderId;

    const existing = await RecoveryCampaign.findOne({ commerceOrderId: orderId });

    if (isCancel) {
      if (existing) {
        existing.outcome = 'in-progress';
        existing.cancellationReason = reason;
        existing.customerName = customerName;
        existing.customerPhone = customerPhone;
        existing.revenueAmount = totalAmount;
        existing.recoveredRevenue = 0;
        existing.steps = [];
        return existing.save();
      }
      return RecoveryCampaign.create({
        orderId: order._id,
        commerceOrderId: orderId,
        orderNumber,
        customerName,
        customerPhone,
        revenueAmount: totalAmount,
        cancellationReason: reason,
        outcome: 'in-progress',
      });
    }

    const revivedStep = {
      action: 'Order revived',
      note: `${fromStatus || 'Cancelled'} → ${toStatus || 'Active'}`,
      outcome: 'success',
      completedAt: new Date(),
    };

    if (!existing) {
      return RecoveryCampaign.create({
        orderId: order._id,
        commerceOrderId: orderId,
        orderNumber,
        customerName,
        customerPhone,
        revenueAmount: totalAmount,
        cancellationReason: reason,
        outcome: 'recovered',
        recoveredBy: recoveredBy || undefined,
        recoveredRevenue: totalAmount,
        steps: [revivedStep],
      });
    }
    if (existing.outcome !== 'recovered') {
      existing.outcome = 'recovered';
      existing.recoveredBy = recoveredBy || existing.recoveredBy;
      existing.recoveredRevenue = totalAmount || existing.revenueAmount;
      existing.steps.push(revivedStep);
      await existing.save();
    }
    return existing;
  }

  async getCampaignById(id) {
    const campaign = await RecoveryCampaign.findById(id);
    if (!campaign) throw new NotFoundError('Recovery campaign not found');
    return campaign;
  }

  async listCampaigns(filters = {}) {
    return RecoveryCampaign.find(filters).sort({ createdAt: -1 });
  }

  async updateCampaign(id, data) {
    const campaign = await RecoveryCampaign.findById(id);
    if (!campaign) throw new NotFoundError('Recovery campaign not found');

    if (data.stepIndex !== undefined && data.stepOutcome !== undefined) {
      const step = campaign.steps[data.stepIndex];
      if (step) {
        step.outcome = data.stepOutcome;
        if (data.stepOutcome === 'success') step.completedAt = new Date();
        if (data.stepNote) step.note = data.stepNote;
      }
      const hasAllResolved = campaign.steps.every(s => s.outcome === 'success' || s.outcome === 'failed');
      if (hasAllResolved && data.outcome) campaign.outcome = data.outcome;
    }
    if (data.outcome !== undefined) campaign.outcome = data.outcome;
    if (data.recoveredBy !== undefined) campaign.recoveredBy = data.recoveredBy;
    if (data.recoveredRevenue !== undefined) campaign.recoveredRevenue = data.recoveredRevenue;

    return RecoveryCampaign.findByIdAndUpdate(id, campaign, { new: true, runValidators: true });
  }

  async deleteCampaign(id) {
    return RecoveryCampaign.findByIdAndDelete(id);
  }

  async getRecoveryStats() {
    const [stats, reasonStats, total, recovered, lost] = await Promise.all([
      RecoveryCampaign.aggregate([{ $group: { _id: '$outcome', count: { $sum: 1 }, totalRevenue: { $sum: '$recoveredRevenue' }, avgRevenue: { $avg: '$recoveredRevenue' } } }]),
      RecoveryCampaign.aggregate([{ $group: { _id: '$cancellationReason', count: { $sum: 1 }, recovered: { $sum: { $cond: [{ $eq: ['$outcome', 'recovered'] }, 1, 0] } } } }, { $sort: { count: -1 } }]),
      RecoveryCampaign.countDocuments(),
      RecoveryCampaign.countDocuments({ outcome: 'recovered' }),
      RecoveryCampaign.countDocuments({ outcome: 'lost' }),
    ]);
    return { total, recovered, lost, recoveryRate: total > 0 ? ((recovered / total) * 100).toFixed(1) + '%' : '0%', byOutcome: stats, byReason: reasonStats };
  }
}

module.exports = new RecoveryService();
