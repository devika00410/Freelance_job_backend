const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../Middlewares/authMiddleware');
const adminTransactionController = require('../Controllers/adminTransactionController');

// Apply authentication and admin authorization to all routes
router.use(authenticate);
router.use(authorize('admin'));

// Transaction Monitoring
router.get('/transactions', adminTransactionController.getAllTransactions);
router.get('/transactions/:transactionId', adminTransactionController.getTransactionDetails);
router.get('/transactions/user/:userId', adminTransactionController.getUserTransactions);

// Payment Verification & Fraud Prevention
router.put('/transactions/:transactionId/verify-payment', adminTransactionController.verifyPayment);
router.put('/transactions/:transactionId/confirm-receipt', adminTransactionController.confirmReceipt);
router.put('/transactions/:transactionId/flag', adminTransactionController.flagTransaction);
router.put('/transactions/:transactionId/clear-flag', adminTransactionController.clearFlag);
router.get('/transactions/suspicious/list', adminTransactionController.getSuspiciousTransactions);

// Analytics
router.get('/transactions/analytics/overview', adminTransactionController.getTransactionAnalytics);

module.exports = router;