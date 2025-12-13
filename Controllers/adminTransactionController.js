const Transaction = require('../Models/Transaction');
const User = require('../Models/User');
const Contract = require('../Models/Contract');

const adminTransactionController = {
    // Get all transactions with filters
    getAllTransactions: async (req, res) => {
        try {
            const { page = 1, limit = 10, status, type, userId, startDate, endDate, isFlagged } = req.query;
            
            let query = {};
            if (status && status !== 'all') query.status = status;
            if (type && type !== 'all') query.type = type;
            if (isFlagged === 'true') query.isFlagged = true;
            
            if (userId) {
                query.$or = [
                    { fromUser: userId },
                    { toUser: userId }
                ];
            }
            
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            const transactions = await Transaction.find(query)
                .populate('fromUser', 'name email profile')
                .populate('toUser', 'name email profile')
                .populate('relatedWorkspace', 'title')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalTransactions = await Transaction.countDocuments(query);

            res.json({
                success: true,
                transactions,
                totalPages: Math.ceil(totalTransactions / limit),
                currentPage: parseInt(page),
                totalTransactions
            });

        } catch (error) {
            console.error("Get transactions error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching transactions"
            });
        }
    },

    // Get specific transaction details
    getTransactionDetails: async (req, res) => {
        try {
            const { transactionId } = req.params;

            const transaction = await Transaction.findById(transactionId)
                .populate('fromUser', 'name email profile')
                .populate('toUser', 'name email profile')
                .populate('relatedWorkspace')
                .populate('relatedProject');

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: "Transaction not found"
                });
            }

            res.json({
                success: true,
                transaction
            });

        } catch (error) {
            console.error("Get transaction details error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching transaction details"
            });
        }
    },

    // Verify client payment
    verifyPayment: async (req, res) => {
        try {
             const adminId = req.userId || req.user?._id;
            const { transactionId } = req.params;
            const { adminNotes } = req.body;

            const transaction = await Transaction.findByIdAndUpdate(
                transactionId,
                {
                    status: 'verified',
                    adminVerified: true,
                    adminNotes,
                    verifiedAt: new Date()
                },
                { new: true }
            ).populate('fromUser toUser');

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: "Transaction not found"
                });
            }

            res.json({
                success: true,
                message: "Payment verified successfully",
                transaction
            });

        } catch (error) {
            console.error("Verify payment error:", error);
            res.status(500).json({
                success: false,
                message: "Server error verifying payment"
            });
        }
    },

    // Confirm freelancer receipt
    confirmReceipt: async (req, res) => {
        try {
            const { transactionId } = req.params;
            const { adminNotes } = req.body;

            const transaction = await Transaction.findByIdAndUpdate(
                transactionId,
                {
                    freelancerReceived: true,
                    receiptConfirmedAt: new Date(),
                    adminNotes
                },
                { new: true }
            );

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: "Transaction not found"
                });
            }

            res.json({
                success: true,
                message: "Payment receipt confirmed",
                transaction
            });

        } catch (error) {
            console.error("Confirm receipt error:", error);
            res.status(500).json({
                success: false,
                message: "Server error confirming receipt"
            });
        }
    },

    // Flag suspicious transaction
    flagTransaction: async (req, res) => {
        try {
             const adminId = req.userId || req.user?._id;
            const { transactionId } = req.params;
            const { flagReason, adminNotes } = req.body;

            const transaction = await Transaction.findByIdAndUpdate(
                transactionId,
                {
                    isFlagged: true,
                    flagReason,
                    adminNotes,
                    flaggedAt: new Date(),
                    status: 'under_review'
                },
                { new: true }
            );

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: "Transaction not found"
                });
            }

            res.json({
                success: true,
                message: "Transaction flagged for review",
                transaction
            });

        } catch (error) {
            console.error("Flag transaction error:", error);
            res.status(500).json({
                success: false,
                message: "Server error flagging transaction"
            });
        }
        console.log(`Admin ${adminId} performed action: ${actionName}`);
    },

    // Clear transaction flag
    clearFlag: async (req, res) => {
        try {
            const { transactionId } = req.params;
            const { adminNotes } = req.body;

            const transaction = await Transaction.findByIdAndUpdate(
                transactionId,
                {
                    isFlagged: false,
                    flagReason: null,
                    adminNotes,
                    status: 'completed'
                },
                { new: true }
            );

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: "Transaction not found"
                });
            }

            res.json({
                success: true,
                message: "Transaction flag cleared",
                transaction
            });

        } catch (error) {
            console.error("Clear flag error:", error);
            res.status(500).json({
                success: false,
                message: "Server error clearing flag"
            });
        }
    },

    // Get suspicious transactions
    getSuspiciousTransactions: async (req, res) => {
        try {
            const { page = 1, limit = 10 } = req.query;

            const transactions = await Transaction.find({ isFlagged: true })
                .populate('fromUser', 'name email')
                .populate('toUser', 'name email')
                .sort({ flaggedAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalFlagged = await Transaction.countDocuments({ isFlagged: true });

            res.json({
                success: true,
                transactions,
                totalPages: Math.ceil(totalFlagged / limit),
                currentPage: parseInt(page),
                totalFlagged
            });

        } catch (error) {
            console.error("Get suspicious transactions error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching suspicious transactions"
            });
        }
    },

    // Get transaction analytics
    getTransactionAnalytics: async (req, res) => {
        try {
            const { period = '30d' } = req.query;
            let days = 30;
            if (period === '7d') days = 7;
            if (period === '90d') days = 90;

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const transactionStats = await Transaction.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                        },
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount' }
                    }
                },
                {
                    $sort: { '_id.date': 1 }
                }
            ]);

            const statusStats = await Transaction.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount' }
                    }
                }
            ]);

            const typeStats = await Transaction.aggregate([
                {
                    $match: { status: 'completed' }
                },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount' }
                    }
                }
            ]);

            const totalRevenue = await Transaction.aggregate([
                {
                    $match: { 
                        status: 'completed',
                        type: { $in: ['milestone_payment', 'commission'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$platformFee' },
                        totalVolume: { $sum: '$amount' }
                    }
                }
            ]);

            res.json({
                success: true,
                analytics: {
                    transactionStats,
                    statusStats,
                    typeStats,
                    totalRevenue: totalRevenue[0]?.totalRevenue || 0,
                    totalVolume: totalRevenue[0]?.totalVolume || 0,
                    period
                }
            });

        } catch (error) {
            console.error("Get transaction analytics error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching transaction analytics"
            });
        }
    },

    // Get user transaction history
    getUserTransactions: async (req, res) => {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const transactions = await Transaction.find({
                $or: [
                    { fromUser: userId },
                    { toUser: userId }
                ]
            })
            .populate('fromUser', 'name email')
            .populate('toUser', 'name email')
            .populate('relatedWorkspace', 'title')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

            const totalTransactions = await Transaction.countDocuments({
                $or: [
                    { fromUser: userId },
                    { toUser: userId }
                ]
            });

            res.json({
                success: true,
                transactions,
                totalPages: Math.ceil(totalTransactions / limit),
                currentPage: parseInt(page),
                totalTransactions
            });

        } catch (error) {
            console.error("Get user transactions error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching user transactions"
            });
        }
    }
};

module.exports = adminTransactionController;