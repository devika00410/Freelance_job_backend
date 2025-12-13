const Transaction = require('../Models/Transaction');
const Contract = require('../Models/Contract');
const Project = require('../Models/Project');
const mongoose = require('mongoose');

const freelancerEarningsController = {
    // Get basic earnings overview
    getFreelancerEarnings: async (req, res) => {
        try {
            const freelancerId = req.userId;
            
            const transactions = await Transaction.find({ 
                toUser: freelancerId,
                type: { $in: ['milestone_payment', 'bonus'] }
            });
            
            const total = transactions
                .filter(t => t.status === 'completed')
                .reduce((sum, transaction) => sum + transaction.amount, 0);
            
            const pending = transactions
                .filter(t => t.status === 'pending')
                .reduce((sum, transaction) => sum + transaction.amount, 0);

            // This month earnings
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            const thisMonth = transactions
                .filter(t => t.status === 'completed' && t.createdAt >= startOfMonth)
                .reduce((sum, transaction) => sum + transaction.amount, 0);

            res.json({
                total: total,
                pending: pending,
                thisMonth: thisMonth,
                totalTransactions: transactions.length
            });

        } catch (error) {
            console.error("Get freelancer earnings error:", error);
            res.status(500).json({ 
                success: false,
                error: error.message 
            });
        }
    },

    getEarningsOverview: async (req, res) => {
        try {
            const freelancerId = req.userId;
            console.log(' Fetching earnings overview for freelancer:', freelancerId);

            // Get current month earnings
            const currentMonth = new Date();
            const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

            const monthlyEarnings = await Transaction.aggregate([
                {
                    $match: {
                        toUser: new mongoose.Types.ObjectId(freelancerId),
                        type: { $in: ['milestone_payment', 'bonus'] },
                        status: 'completed',
                        createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalEarnings: { $sum: '$amount' },
                        transactionCount: { $sum: 1 }
                    }
                }
            ]);

            // Get total earnings
            const totalEarnings = await Transaction.aggregate([
                {
                    $match: {
                        toUser: new mongoose.Types.ObjectId(freelancerId),
                        type: { $in: ['milestone_payment', 'bonus'] },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$amount' },
                        totalTransactions: { $sum: 1 }
                    }
                }
            ]);

            // Get pending payments
            const pendingPayments = await Transaction.aggregate([
                {
                    $match: {
                        toUser: new mongoose.Types.ObjectId(freelancerId),
                        type: { $in: ['milestone_payment', 'bonus'] },
                        status: 'pending'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalPending: { $sum: '$amount' },
                        pendingCount: { $sum: 1 }
                    }
                }
            ]);

            const overview = {
                currentMonthEarnings: monthlyEarnings[0]?.totalEarnings || 0,
                currentMonthTransactions: monthlyEarnings[0]?.transactionCount || 0,
                totalEarnings: totalEarnings[0]?.totalAmount || 0,
                totalTransactions: totalEarnings[0]?.totalTransactions || 0,
                pendingEarnings: pendingPayments[0]?.totalPending || 0,
                pendingTransactions: pendingPayments[0]?.pendingCount || 0,
                earningsByService: []
            };

            console.log('📊 Earnings overview:', overview);
            res.json({
                success: true,
                overview
            });

        } catch (error) {
            console.error("❌ Get earnings overview error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching earnings overview"
            });
        }
    },

    // Get transaction history - FIXED FIELD NAMES
    getTransactionHistory: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { page = 1, limit = 10, type, status, startDate, endDate } = req.query;

            let query = { 
                toUser: freelancerId,
                type: { $in: ['milestone_payment', 'bonus', 'withdrawal'] }
            };

            if (type && type !== 'all') {
                if (type === 'earning') {
                    query.type = { $in: ['milestone_payment', 'bonus'] };
                } else {
                    query.type = type;
                }
            }

            if (status && status !== 'all') {
                query.status = status;
            }

            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            const transactions = await Transaction.find(query)
                .populate('fromUser', 'name companyName profilePicture')
                .populate('relatedWorkspace', 'projectTitle')
                .populate('relatedProject', 'title')
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
            console.error("Get transaction history error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching transaction history"
            });
        }
    },

    // Get monthly earnings breakdown - FIXED FIELD NAMES
    getMonthlyEarnings: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { months = 6 } = req.query;

            const monthlyBreakdown = await Transaction.aggregate([
                {
                    $match: {
                        toUser: new mongoose.Types.ObjectId(freelancerId),
                        type: { $in: ['milestone_payment', 'bonus'] },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        totalEarnings: { $sum: '$amount' },
                        transactionCount: { $sum: 1 },
                        averageAmount: { $avg: '$amount' }
                    }
                },
                {
                    $sort: { '_id.year': -1, '_id.month': -1 }
                },
                {
                    $limit: parseInt(months)
                }
            ]);

            // Format the data for frontend
            const formattedData = monthlyBreakdown.map(item => ({
                year: item._id.year,
                month: item._id.month,
                totalEarnings: item.totalEarnings,
                transactionCount: item.transactionCount,
                averageAmount: Math.round(item.averageAmount || 0)
            })).reverse();

            res.json({
                success: true,
                monthlyEarnings: formattedData,
                period: `${months} months`
            });

        } catch (error) {
            console.error("Get monthly earnings error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching monthly earnings"
            });
        }
    },

    // Get earnings by project - FIXED FIELD NAMES
    getEarningsByProject: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const projectEarnings = await Transaction.aggregate([
                {
                    $match: {
                        toUser: new mongoose.Types.ObjectId(freelancerId),
                        type: { $in: ['milestone_payment', 'bonus'] },
                        status: 'completed',
                        relatedProject: { $ne: null }
                    }
                },
                {
                    $group: {
                        _id: '$relatedProject',
                        totalEarnings: { $sum: '$amount' },
                        transactionCount: { $sum: 1 },
                        firstPayment: { $min: '$createdAt' },
                        lastPayment: { $max: '$createdAt' }
                    }
                },
                {
                    $lookup: {
                        from: 'projects',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'projectDetails'
                    }
                },
                {
                    $unwind: '$projectDetails'
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'projectDetails.clientId',
                        foreignField: '_id',
                        as: 'clientDetails'
                    }
                },
                {
                    $unwind: '$clientDetails'
                },
                {
                    $project: {
                        projectId: '$_id',
                        projectTitle: '$projectDetails.title',
                        clientName: '$clientDetails.name',
                        clientCompany: '$clientDetails.companyName',
                        totalEarnings: 1,
                        transactionCount: 1,
                        firstPayment: 1,
                        lastPayment: 1
                    }
                },
                {
                    $sort: { totalEarnings: -1 }
                }
            ]);

            res.json({
                success: true,
                projectEarnings
            });

        } catch (error) {
            console.error("Get earnings by project error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching earnings by project"
            });
        }
    },

    // Get pending payments - FIXED FIELD NAMES
    getPendingPayments: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const pendingPayments = await Transaction.find({
                toUser: freelancerId,
                type: { $in: ['milestone_payment', 'bonus'] },
                status: 'pending'
            })
                .populate('fromUser', 'name companyName profilePicture')
                .populate('relatedWorkspace', 'projectTitle')
                .populate('relatedProject', 'title')
                .sort({ createdAt: 1 });

            const totalPending = pendingPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

            res.json({
                success: true,
                pendingPayments,
                totalPending,
                pendingCount: pendingPayments.length
            });

        } catch (error) {
            console.error("Get pending payments error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching pending payments"
            });
        }
    },

    // Get transaction details - FIXED FIELD NAMES
    getTransactionDetails: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { transactionId } = req.params;

            const transaction = await Transaction.findOne({
                _id: transactionId,
                toUser: freelancerId
            })
                .populate('fromUser', 'name companyName profilePicture email phone')
                .populate('relatedProject', 'title description budget')
                .populate('relatedWorkspace', 'projectTitle currentPhase')
                .populate('relatedMilestone', 'phaseTitle phaseNumber');

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

    // Get earnings statistics - FIXED FIELD NAMES
    getEarningsStats: async (req, res) => {
        try {
            const freelancerId = req.userId;

            // Current year stats
            const currentYear = new Date().getFullYear();
            const yearlyStats = await Transaction.aggregate([
                {
                    $match: {
                        toUser: new mongoose.Types.ObjectId(freelancerId),
                        type: { $in: ['milestone_payment', 'bonus'] },
                        status: 'completed',
                        createdAt: {
                            $gte: new Date(`${currentYear}-01-01`),
                            $lte: new Date(`${currentYear}-12-31`)
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        yearlyEarnings: { $sum: '$amount' },
                        averageTransaction: { $avg: '$amount' },
                        largestTransaction: { $max: '$amount' },
                        transactionCount: { $sum: 1 }
                    }
                }
            ]);

            // Lifetime stats
            const lifetimeStats = await Transaction.aggregate([
                {
                    $match: {
                        toUser: new mongoose.Types.ObjectId(freelancerId),
                        type: { $in: ['milestone_payment', 'bonus'] },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalEarnings: { $sum: '$amount' },
                        totalTransactions: { $sum: 1 },
                        avgTransactionSize: { $avg: '$amount' }
                    }
                }
            ]);

            // Payment method distribution
            const paymentMethods = await Transaction.aggregate([
                {
                    $match: {
                        toUser: new mongoose.Types.ObjectId(freelancerId),
                        type: { $in: ['milestone_payment', 'bonus'] },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: '$paymentMethod',
                        totalAmount: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                }
            ]);

            const statsData = yearlyStats[0] || {};
            const lifetimeData = lifetimeStats[0] || {};

            const stats = {
                currentYear: {
                    yearlyEarnings: statsData.yearlyEarnings || 0,
                    averageTransaction: Math.round(statsData.averageTransaction || 0),
                    largestTransaction: statsData.largestTransaction || 0,
                    transactionCount: statsData.transactionCount || 0
                },
                lifetime: {
                    totalEarnings: lifetimeData.totalEarnings || 0,
                    totalTransactions: lifetimeData.totalTransactions || 0,
                    avgTransactionSize: Math.round(lifetimeData.avgTransactionSize || 0)
                },
                paymentMethods: paymentMethods
            };

            res.json({
                success: true,
                stats
            });

        } catch (error) {
            console.error("Get earnings stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching earnings statistics"
            });
        }
    },

    // Initiate withdrawal request - FIXED FIELD NAMES
    initiateWithdrawal: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { amount, paymentMethod, accountDetails } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid withdrawal amount"
                });
            }

            // Check available balance
            const availableBalance = await Transaction.aggregate([
                {
                    $match: {
                        toUser: new mongoose.Types.ObjectId(freelancerId),
                        type: { $in: ['milestone_payment', 'bonus'] },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalEarnings: { $sum: '$amount' }
                    }
                }
            ]);

            const totalEarnings = availableBalance[0]?.totalEarnings || 0;

            if (amount > totalEarnings) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance for withdrawal"
                });
            }

            const withdrawalTransaction = new Transaction({
                type: 'withdrawal',
                fromUser: freelancerId,
                fromUserRole: 'freelancer',
                toUser: 'platform',
                toUserRole: 'platform',
                amount: -amount,
                description: `Withdrawal request via ${paymentMethod}`,
                status: 'pending',
                paymentMethod,
                metadata: { accountDetails }
            });

            await withdrawalTransaction.save();

            res.status(201).json({
                success: true,
                message: "Withdrawal request submitted successfully",
                transaction: withdrawalTransaction
            });

        } catch (error) {
            console.error("Initiate withdrawal error:", error);
            res.status(500).json({
                success: false,
                message: "Server error initiating withdrawal"
            });
        }
    },

    // TEST ENDPOINT - Create test transaction
    createTestTransaction: async (req, res) => {
        try {
            const freelancerId = req.userId;
            
            // Create a test transaction
            const testTransaction = new Transaction({
                type: 'milestone_payment',
                fromUser: new mongoose.Types.ObjectId('67d4a5b8e1a2b3c4d5e6f789'), // Any client ID
                fromUserRole: 'client',
                toUser: freelancerId,
                toUserRole: 'freelancer',
                amount: 15000, // $150.00 in cents
                currency: 'USD',
                status: 'completed',
                description: 'Test payment for website development',
                paymentMethod: 'stripe',
                processedAt: new Date(),
                completedAt: new Date()
            });

            await testTransaction.save();

            res.json({
                success: true,
                message: 'Test transaction created successfully',
                transaction: testTransaction
            });

        } catch (error) {
            console.error("Create test transaction error:", error);
            res.status(500).json({
                success: false,
                message: "Error creating test transaction"
            });
        }
    }
};

module.exports = freelancerEarningsController;