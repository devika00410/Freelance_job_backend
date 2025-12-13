const express = require('express');
const router = express.Router();
const transactionController = require('../Controllers/transactionController');
const { authenticate } = require('../Middlewares/authMiddleware');

router.use(authenticate);

// GET Routes
router.get('/', transactionController.getUserTransactions);
router.get('/stats', transactionController.getTransactionStats);
router.get('/:transactionId', transactionController.getTransactionDetails);

// POST Routes
router.post('/payment', transactionController.createPaymentTransaction);
router.post('/client-payment', transactionController.createClientPayment);
router.post('/withdrawal', transactionController.createWithdrawalRequest);

// PUT Routes (Admin only)
router.put('/:transactionId/status', transactionController.updateTransactionStatus);

module.exports = router;