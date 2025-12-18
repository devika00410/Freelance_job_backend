const PasswordResetToken = require('../Models/PasswordResetToken');

const verifyResetToken = async (req, res, next) => {
    try {
        const { email, verificationToken } = req.body;

        if (!email || !verificationToken) {
            return res.status(400).json({
                success: false,
                error: 'Email and verification token required'
            });
        }

        // In a real implementation, you would validate the verificationToken
        // This could be stored in Redis, database, or signed JWT
        
        // For now, we'll skip detailed validation for simplicity
        // You should implement proper token validation
        
        req.resetEmail = email;
        next();
        
    } catch (error) {
        console.error('Reset token verification error:', error);
        res.status(401).json({
            success: false,
            error: 'Invalid reset session'
        });
    }
};

module.exports = verifyResetToken;