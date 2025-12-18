const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    async sendPasswordResetCode(email, resetCode, userName = 'User') {
        const mailOptions = {
            from: `"FreelanceHub" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: email,
            subject: 'Password Reset Code - FreelanceHub',
            html: `<div>Your reset code is: <strong>${resetCode}</strong></div>`,
            text: `Your password reset code is: ${resetCode}`
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Password reset email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            throw new Error('Failed to send reset email');
        }
    }

    async sendPasswordResetConfirmation(email, userName = 'User') {
        const mailOptions = {
            from: `"FreelanceHub" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: email,
            subject: 'Password Reset Successful - FreelanceHub',
            html: `<div>Your password has been successfully reset.</div>`,
            text: 'Your password has been successfully reset.'
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Password reset confirmation sent to ${email}`);
            return true;
        } catch (error) {
            console.error('Error sending confirmation email:', error);
        }
    }
}

module.exports = new EmailService();