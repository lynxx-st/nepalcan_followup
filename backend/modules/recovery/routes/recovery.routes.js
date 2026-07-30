const express = require('express');
const router = express.Router();
const recoveryController = require('../controller/recovery.controller');
const { authenticate } = require('../../../src/middleware/auth');
const { validate } = require('../../../src/middleware/validate');
const { ROLES, requireRole } = require('../../../src/middleware/rbac');
const { createRecoverySchema, updateRecoverySchema } = require('../validation/recovery.schema');

router.get('/', authenticate, recoveryController.listCampaigns);
router.get('/stats', authenticate, recoveryController.getStats);
router.get('/:id', authenticate, recoveryController.getCampaignById);
router.post('/', authenticate, requireRole([ROLES.admin, ROLES.manager]), validate(createRecoverySchema), recoveryController.createCampaign);
router.put('/:id', authenticate, requireRole([ROLES.admin, ROLES.manager]), validate(updateRecoverySchema), recoveryController.updateCampaign);
router.delete('/:id', authenticate, requireRole([ROLES.admin]), recoveryController.deleteCampaign);

module.exports = router;