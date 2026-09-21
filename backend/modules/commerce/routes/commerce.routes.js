const express = require('express');
const router = express.Router();
const commerceController = require('../controller/commerce.controller');
const { authenticate, requireAdmin } = require('../../../src/middleware/auth');
const { internalLimiter } = require('../../../src/middleware/rateLimiter');
router.use(authenticate);
router.use(async (req,res,next) => {
 try {
  if (['admin','super-admin'].includes(req.user.role)) return next();
  const order=req.path.match(/^\/orders\/([^/]+)/);
  if(order && order[1]!=='segment-counts') {
   const {Task}=require('../../../database/models');
   if(!await Task.exists({'sourceOrder.orderId':order[1],...require('../../workspace/service').scope(req.user)})) return res.status(404).json({success:false,error:{message:'Order not assigned to your workspace'}});
  }
  next();
 } catch(e){next(e);}
});


router.post('/login', authenticate, requireAdmin, commerceController.login);
router.post('/sync', authenticate, requireAdmin, internalLimiter, commerceController.syncOrders);
router.post('/sync/all', authenticate, requireAdmin, internalLimiter, async (req,res,next) => { try { res.json({success:true,data:await require('../../workspace/routes').runAutomation()}); } catch(e) { next(e); } });
router.get('/sync/all', (req,res) => res.status(405).json({success:false,error:{message:'Use the protected POST /api/v1/workspace/cron endpoint'}}));
router.post('/sync/reset-cursor', authenticate, commerceController.resetCursor);
router.get('/sync/status', authenticate, commerceController.getSyncStatus);
router.post('/sync/external-non-heavy', authenticate, internalLimiter, commerceController.syncExternalNonHeavy);
router.get('/orders', authenticate, commerceController.getOrders);
router.get('/orders/segment-counts', authenticate, commerceController.getSegmentCounts);
router.get('/reviews', authenticate, commerceController.getReviews);
router.get('/orders/:commerceOrderId', authenticate, commerceController.getOrderById);
router.get('/orders/:commerceOrderId/status', authenticate, commerceController.getOrderStatus);
router.get('/orders/:commerceOrderId/detail', authenticate, commerceController.getOrderDetail);
router.get('/orders/:commerceOrderId/comments', authenticate, commerceController.getExternalComments);
router.post('/orders/:commerceOrderId/comment', authenticate, commerceController.postExternalComment);
router.put('/orders/:commerceOrderId/phone', authenticate, commerceController.updateOrderPhone);
router.put('/orders/:commerceOrderId/status', authenticate, commerceController.updateOrderStatus);
router.post('/orders/:commerceOrderId/notes', authenticate, commerceController.addOrderNote);
router.get('/returns', authenticate, commerceController.getReturns);
router.get('/returns/attachment', authenticate, commerceController.getReturnAttachment);
router.put('/returns/:returnId/status', authenticate, commerceController.updateReturnStatus);
router.post('/sync/returns', authenticate, internalLimiter, commerceController.syncReturns);
router.post('/sync/recompute-stages', authenticate, requireAdmin, internalLimiter, commerceController.recomputeStages);

module.exports = router;