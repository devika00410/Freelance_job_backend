const express = require('express');
const router = express.Router();
const reportController = require('../Controllers/reportController');
const {authenticate} = require('../Middlewares/authMiddleware');

router.use(authenticate);

// Report management
router.get('/', reportController.getUserReports);
router.get('/stats', reportController.getReportStats);
router.get('/categories', reportController.getReportCategories);
router.get('/:reportId', reportController.getReportDetails);

// Report actions
router.post('/', reportController.submitReport);
router.put('/:reportId', reportController.updateReport);
router.put('/:reportId/withdraw', reportController.withdrawReport);

module.exports = router;