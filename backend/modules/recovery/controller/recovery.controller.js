const recoveryService = require('../service/recovery.service');

async function createCampaign(req, res, next) {
  try {
    const campaign = await recoveryService.createCampaign(req.validatedBody);
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
}

async function getCampaignById(req, res, next) {
  try {
    const campaign = await recoveryService.getCampaignById(req.params.id);
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
}

async function listCampaigns(req, res, next) {
  try {
    const campaigns = await recoveryService.listCampaigns();
    res.json({ success: true, data: campaigns });
  } catch (error) {
    next(error);
  }
}

async function updateCampaign(req, res, next) {
  try {
    const campaign = await recoveryService.updateCampaign(req.params.id, req.validatedBody);
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
}

async function deleteCampaign(req, res, next) {
  try {
    await recoveryService.deleteCampaign(req.params.id);
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    next(error);
  }
}

async function getStats(req, res, next) {
  try {
    const stats = await recoveryService.getRecoveryStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCampaign,
  getCampaignById,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  getStats,
};