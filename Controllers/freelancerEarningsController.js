const Transaction = require('../Models/Transaction');
const Contract = require('../Models/Contract');
const Project = require('../Models/Project');

const freelancerEarningsController = {
    // Get earnings overview
    getEarningsOverview: async (req, res) => {
        try {
            const freelancerId = req.userId;

            // Get current month earnings
            const currentMonth = new Date();
            const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

            const monthlyEarnings = await Transaction.aggregate([
                {
                    $match: {
                        userId: freelancerId,
                        type: 'earning',
                        status: 'completed',
                        date: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
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
                        userId: freelancerId,
                        type: 'earning',
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
                        userId: freelancerId,
                        type: 'earning',
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

            // Get earnings by service type
            const earningsByService = await Contract.aggregate([
                {
                    $match: {
                        freelancerId: freelancerId,
                        status: 'active'
                    }
                },
                {
                    $group: {
                        _id: '$serviceType',
                        totalValue: { $sum: '$totalBudget' },
                        projectCount: { $sum: 1 }
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
                earningsByService: earningsByService
            };

            res.json({
                success: true,
                overview
            });

        } catch (error) {
            console.error("Get earnings overview error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching earnings overview"
            });
        }
    },

    // Get transaction history
    getTransactionHistory: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { page = 1, limit = 10, type, status, startDate, endDate } = req.query;

            let query = { userId: freelancerId };

            if (type && type !== 'all') {
                query.type = type;
            }

            if (status && status !== 'all') {
                query.status = status;
            }

            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }

            const transactions = await Transaction.find(query)
                .populate('relatedProject', 'title clientId')
                .populate({
                    path: 'relatedProject',
                    populate: {
                        path: 'clientId',
                        select: 'name companyName'
                    }
                })
                .sort({ date: -1 })
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

    // Get monthly earnings breakdown
    getMonthlyEarnings: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { months = 6 } = req.query;

            const monthlyBreakdown = await Transaction.aggregate([
                {
                    $match: {
                        userId: freelancerId,
                        type: 'earning',
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$date' },
                            month: { $month: '$date' }
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

    // Get earnings by project
    getEarningsByProject: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const projectEarnings = await Transaction.aggregate([
                {
                    $match: {
                        userId: freelancerId,
                        type: 'earning',
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: '$relatedProject',
                        totalEarnings: { $sum: '$amount' },
                        transactionCount: { $sum: 1 },
                        firstPayment: { $min: '$date' },
                        lastPayment: { $max: '$date' }
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

    // Get pending payments
    getPendingPayments: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const pendingPayments = await Transaction.find({
                userId: freelancerId,
                type: 'earning',
                status: 'pending'
            })
                .populate('relatedProject', 'title clientId')
                .populate({
                    path: 'relatedProject',
                    populate: {
                        path: 'clientId',
                        select: 'name companyName'
                    }
                })
                .sort({ date: 1 });

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

    // Get transaction details
    getTransactionDetails: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { transactionId } = req.params;

            const transaction = await Transaction.findOne({
                _id: transactionId,
                userId: freelancerId
            })
                .populate('relatedProject', 'title description budget')
                .populate({
                    path: 'relatedProject',
                    populate: {
                        path: 'clientId',
                        select: 'name companyName profilePicture email'
                    }
                });

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

    // Get earnings statistics
    getEarningsStats: async (req, res) => {
        try {
            const freelancerId = req.userId;

            // Current year stats
            const currentYear = new Date().getFullYear();
            const yearlyStats = await Transaction.aggregate([
                {
                    $match: {
                        userId: freelancerId,
                        type: 'earning',
                        status: 'completed',
                        date: {
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
                        userId: freelancerId,
                        type: 'earning',
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
                        userId: freelancerId,
                        type: 'earning',
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

    // Initiate withdrawal request
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
                        userId: freelancerId,
                        type: 'earning',
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
                userId: freelancerId,
                type: 'withdrawal',
                amount: -amount,
                description: `Withdrawal request via ${paymentMethod}`,
                status: 'pending',
                paymentMethod,
                accountDetails,
                date: new Date()
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
    }
};

module.exports = freelancerEarningsController;