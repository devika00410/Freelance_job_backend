const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../Middlewares/authMiddleware');
const adminReportController = require('../Controllers/adminReportController');

// Apply authentication and admin authorization to all routes
router.use(authenticate);
router.use(authorize('admin'));

// Report Management
router.get('/reports', adminReportController.getAllReports);
router.get('/reports/urgent', adminReportController.getUrgentReports);
router.get('/reports/my-assigned', adminReportController.getMyAssignedReports);
router.get('/reports/stats', adminReportController.getReportStats);
router.get('/reports/:reportId', adminReportController.getReportDetails);

// Report Actions
router.put('/reports/:reportId/assign', adminReportController.assignReport);
router.put('/reports/:reportId/priority', adminReportController.updateReportPriority);
router.put('/reports/:reportId/resolve', adminReportController.resolveReport);

// Report Communication & Actions
router.post('/reports/:reportId/actions', adminReportController.addAdminAction);
router.post('/reports/:reportId/communication', adminReportController.addCommunication);
router.post('/reports/:reportId/follow-up', adminReportController.addFollowUpAction);
router.put('/reports/:reportId/complete-action', adminReportController.completeFollowUpAction);

module.exports = router;