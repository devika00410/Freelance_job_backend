const express = require('express');
const router = express.Router();
const { 
    register, 
    login, 
    adminLogin, 
    adminRegister, 
    getProfile, 
    logout,
    checkAdminEmail 
} = require('../Controllers/authController');

const { authenticate, authorize } = require('../Middlewares/authMiddleware');
const passwordRoutes = require('./passwordRoutes');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/admin/register', adminRegister);
router.post('/check-admin-email', checkAdminEmail); 

// Protected routes
router.get('/profile', authenticate, getProfile);
router.get('/admin/profile', authenticate, authorize('admin'), getProfile);
router.post('/logout', logout);

// Password reset routes
router.use('/password', passwordRoutes);

module.exports = router;