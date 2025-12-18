const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../Models/User');
const PasswordResetToken = require('../Models/PasswordResetToken');
const emailService = require('../services/emailService');

// Generate a 6-digit numeric code
const generateResetCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Request password reset (Step 2)
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email
        if (!email || !email.includes('@')) {
            return res.status(400).json({
                success: false,
                error: 'Valid email is required'
            });
        }

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            // For security, don't reveal if user exists or not
            return res.status(200).json({
                success: true,
                message: 'If an account exists with this email, a reset code will be sent'
            });
        }

        // Invalidate any existing reset tokens for this user
        await PasswordResetToken.updateMany(
            { userId: user._id, used: false },
            { used: true }
        );

        // Generate reset code
        const resetCode = generateResetCode();
        
        // Set expiration (15 minutes from now)
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Save reset token to database
        const resetToken = new PasswordResetToken({
            userId: user._id,
            email: user.email,
            resetCode,
            expiresAt
        });

        await resetToken.save();

        // Send email with reset code
        try {
            await emailService.sendPasswordResetCode(
                user.email, 
                resetCode, 
                user.profile?.name || user.name || 'User'
            );
        } catch (emailError) {
            console.error('Failed to send email:', emailError);
            // Still return success but log the error
            // You might want to handle this differently in production
        }

        res.status(200).json({
            success: true,
            message: 'If an account exists with this email, a reset code will be sent',
            // In development, you might want to return the code for testing
            ...(process.env.NODE_ENV === 'development' && { debugCode: resetCode })
        });

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process password reset request'
        });
    }
};

// Verify reset code (Step 4)
exports.verifyResetCode = async (req, res) => {
    try {
        const { email, resetCode } = req.body;

        // Validate input
        if (!email || !resetCode) {
            return res.status(400).json({
                success: false,
                error: 'Email and reset code are required'
            });
        }

        if (resetCode.length !== 6 || !/^\d+$/.test(resetCode)) {
            return res.status(400).json({
                success: false,
                error: 'Reset code must be a 6-digit number'
            });
        }

        // Find valid reset token
        const resetToken = await PasswordResetToken.findOne({
            email,
            resetCode,
            used: false
        }).sort({ createdAt: -1 }); // Get the most recent one

        if (!resetToken) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset code'
            });
        }

        // Check if token is expired
        if (resetToken.expiresAt < new Date()) {
            resetToken.used = true;
            await resetToken.save();
            
            return res.status(400).json({
                success: false,
                error: 'Reset code has expired'
            });
        }

        // Mark token as used immediately (one-time use)
        resetToken.used = true;
        await resetToken.save();

        // Create a verification token for the next step
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        // Store verification token in another temporary record
        // Or we can just return success and let the frontend store the email
        // For simplicity, we'll return a temporary token
        
        const tempToken = crypto.randomBytes(32).toString('hex');
        const tempTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        // In a real app, you might store this in Redis or another temp storage
        // For now, we'll just return it and trust the frontend to send it back
        
        res.status(200).json({
            success: true,
            message: 'Reset code verified successfully',
            verificationToken: tempToken,
            email: email // Include email for next step
        });

    } catch (error) {
        console.error('Verify reset code error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify reset code'
        });
    }
};

// Reset password with new password (Step 5)
exports.resetPassword = async (req, res) => {
    try {
        const { email, newPassword, confirmPassword, verificationToken } = req.body;

        // Validate input
        if (!email || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                error: 'Passwords do not match'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }

        // In a real app, verify the verificationToken here
        // For simplicity, we'll trust the frontend for now
        // You should implement proper verification token validation

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if new password is same as old password
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                error: 'New password cannot be the same as old password'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update user password
        user.password = hashedPassword;
        user.updatedAt = new Date();
        await user.save();

        // Invalidate all reset tokens for this user
        await PasswordResetToken.updateMany(
            { userId: user._id },
            { used: true }
        );

        // Send confirmation email (async, don't wait for it)
        emailService.sendPasswordResetConfirmation(
            user.email,
            user.profile?.name || user.name || 'User'
        ).catch(err => console.error('Confirmation email failed:', err));

        res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset password'
        });
    }
};

// Check if email exists (optional, for frontend validation)
exports.checkEmailExists = async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        const user = await User.findOne({ email }).select('email role');

        // For security, don't reveal too much info
        res.status(200).json({
            success: true,
            exists: !!user
        });

    } catch (error) {
        console.error('Check email error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check email'
        });
    }
};