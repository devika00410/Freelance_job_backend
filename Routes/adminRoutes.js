const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../Middlewares/authMiddleware');
const adminUserController = require('../Controllers/adminUserController');
const adminController = require('../Controllers/adminController');


router.use(authenticate);
router.use(authorize('admin'));

// Dashboard and Analytics Routes
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/analytics', adminController.getAnalytics);
router.get('/dashboard/platform-health', adminController.getPlatformHealth);
router.get('/dashboard/revenue-analytics', adminController.getRevenueAnalytics);

// User Management Routes
router.get('/users', adminUserController.getAllUsers);
router.get('/users/stats', adminUserController.getUserStats);
router.get('/users/:userId', adminUserController.getUserDetails);
router.put('/users/:userId/verify', adminUserController.verifyUser);
router.put('/users/:userId/suspend', adminUserController.suspendUser);
router.put('/users/:userId/activate', adminUserController.activateUser);
router.put('/users/:userId/role', adminUserController.updateUserRole);
router.delete('/users/:userId', adminUserController.deleteUser);

module.exports = router;