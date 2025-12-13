const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../Middlewares/authMiddleware');

// Import EXISTING controllers
const adminUserController = require('../Controllers/adminUserController');
const adminController = require('../Controllers/adminController');
const adminTransactionController = require('../Controllers/adminTransactionController');

// Import NEW controllers
const adminVerificationController = require('../Controllers/adminVerificationController');
const adminPaymentController = require('../Controllers/adminPaymentController');
const adminChartController = require('../Controllers/adminChartController');

// Apply authentication and authorization middleware to ALL admin routes
router.use(authenticate); // This sets req.user, req.userId, req.userRole
router.use(authorize('admin')); // This checks if userRole === 'admin'

// ===== DASHBOARD ROUTES =====
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/analytics', adminController.getAnalytics);
router.get('/dashboard/platform-health', adminController.getPlatformHealth);
router.get('/dashboard/revenue-analytics', adminController.getRevenueAnalytics);

// ===== USER MANAGEMENT ROUTES =====
router.get('/users', adminUserController.getAllUsers);
router.get('/users/stats', adminUserController.getUserStats);
router.get('/users/:userId', adminUserController.getUserDetails);
router.put('/users/:userId/verify', adminUserController.verifyUser);
router.put('/users/:userId/suspend', adminUserController.suspendUser);
router.put('/users/:userId/activate', adminUserController.activateUser);
router.put('/users/:userId/role', adminUserController.updateUserRole);
router.delete('/users/:userId', adminUserController.deleteUser);

// ===== TRANSACTION ROUTES =====
router.get('/transactions', adminTransactionController.getAllTransactions);
router.get('/transactions/:transactionId', adminTransactionController.getTransactionDetails);
router.put('/transactions/:transactionId/verify-payment', adminTransactionController.verifyPayment);
router.put('/transactions/:transactionId/confirm-receipt', adminTransactionController.confirmReceipt);
router.put('/transactions/:transactionId/flag', adminTransactionController.flagTransaction);
router.put('/transactions/:transactionId/clear-flag', adminTransactionController.clearFlag);
router.get('/transactions/suspicious/list', adminTransactionController.getSuspiciousTransactions);
router.get('/transactions/analytics/overview', adminTransactionController.getTransactionAnalytics);
router.get('/users/:userId/transactions', adminTransactionController.getUserTransactions);

// ===== VERIFICATION ROUTES (NEW) =====
router.get('/verification/queue', adminVerificationController.getVerificationQueue);
router.post('/verification/auto-verify', adminVerificationController.autoVerifyUsers);
router.put('/verification/manual/:userId', adminVerificationController.manualVerifyUser);
router.post('/verification/bulk-verify', adminVerificationController.bulkVerifyUsers);
router.get('/verification/stats', adminVerificationController.getVerificationStats);
router.get('/verification/user/:userId', adminVerificationController.getUserVerificationDetails);

// ===== PAYMENT/ESCROW ROUTES (NEW) =====
router.get('/payments/overview', adminPaymentController.getEscrowOverview);
router.put('/payments/release/:jobId', adminPaymentController.releasePayment);
router.post('/payments/bulk-release', adminPaymentController.bulkReleasePayments);
router.get('/payments/stats', adminPaymentController.getPaymentStats);
router.get('/payments/transaction/:transactionId', adminPaymentController.getTransactionDetails);
router.get('/payments/user/:userId/pending', adminPaymentController.getUserPendingPayments);

// ===== CHART/ANALYTICS ROUTES (NEW) =====
router.get('/charts/revenue', adminChartController.getRevenueChartData);
router.get('/charts/users', adminChartController.getUserGrowthData);
router.get('/charts/jobs', adminChartController.getJobStatsData);
router.get('/charts/health', adminChartController.getPlatformHealth);
router.get('/charts/dashboard', adminChartController.getDashboardCharts);

module.exports = router;