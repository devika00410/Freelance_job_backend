const express = require('express');
const router = express.Router();
const passwordController = require('../Controllers/passwordController');
const rateLimit = require('express-rate-limit');

// Rate limiting for password reset requests
const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        success: false,
        error: 'Too many reset attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 verification attempts
    message: {
        success: false,
        error: 'Too many verification attempts. Please try again later.'
    }
});

// Public routes for password reset
router.post('/forgot-password', resetLimiter, passwordController.requestPasswordReset);
router.post('/verify-reset-code', verifyLimiter, passwordController.verifyResetCode);
router.post('/reset-password', passwordController.resetPassword);
router.get('/check-email', passwordController.checkEmailExists);

module.exports = router;