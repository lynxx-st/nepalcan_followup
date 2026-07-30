const { RecoveryCampaign } = require('../../../database/models');
const { NotFoundError } = require('../../../src/middleware/errorHandler');

class RecoveryService {
  async createCampaign(data) {
    return RecoveryCampaign.create(data);
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
