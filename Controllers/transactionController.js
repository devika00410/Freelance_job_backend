const Transaction = require('../Models/Transaction');
const User = require('../Models/User');
const Workspace = require('../Models/Workspace');
const Milestone = require('../Models/Milestone');
const mongoose = require('mongoose');

const calculateAvailableBalance = async (userId) => {
    const balanceStats = await Transaction.aggregate([
        {
            $match: {
                $or: [{ fromUser: userId }, { toUser: userId }],
                status: 'completed'
            }
        },
        {
            $group: {
                _id: null,
                totalEarnings: {
                    $sum: {
                        $cond: [
                            { $eq: ['$toUser', userId] },
                            '$netAmount',
                            0]
                    }
                },
                totalWithdrawals: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ['$fromUser', userId] },
                                    { $eq: ['$type', 'withdrawal'] }
                                ]
                            },
                            { $abs: '$amount' },
                            0]
                    }
                }
            }
        }
    ]);

    const stats = balanceStats[0] || { totalEarnings: 0, totalWithdrawals: 0 };
    return stats.totalEarnings - stats.totalWithdrawals;
};

const transactionController = {

    // Get transactions for current user (role-based)
    getUserTransactions: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const {
                page = 1,
                limit = 10,
                type,
                status,
                startDate,
                endDate
            } = req.query;

            let query = {
                $or: [
                    { fromUser: userId },
                    { toUser: userId }
                ]
            };

            // Apply filters
            if (type && type !== 'all') query.type = type;
            if (status && status !== 'all') query.status = status;
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            const transactions = await Transaction.find(query)
                .populate('fromUser', 'name profilePicture email')
                .populate('toUser', 'name profilePicture email')
                .populate('relatedProject', 'title')
                .populate('relatedWorkspace', 'projectTitle')
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
            res.status(500).json({
                success: false,
                message: "Server error fetching transactions",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

createClientPayment: async (req, res) => {
    try {
        const clientId = req.userId;
        const { amount, description, freelancerId } = req.body;

        console.log('💰 Creating client payment request:', {
            clientId,
            freelancerId,
            amount,
            description
        });

        // Validate inputs
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid amount is required"
            });
        }

        if (!freelancerId) {
            return res.status(400).json({
                success: false,
                message: "Freelancer ID is required"
            });
        }

        // Validate that freelancerId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(freelancerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid freelancer ID format"
            });
        }

        // Check if freelancer exists
        const freelancer = await User.findById(freelancerId);
        if (!freelancer || freelancer.role !== 'freelancer') {
            return res.status(404).json({
                success: false,
                message: "Freelancer not found"
            });
        }

        // Calculate platform fee (example: 10%)
        const platformFee = amount * 0.10;
        const netAmount = amount - platformFee;

        // Create transaction - Use valid paymentMethod enum value
        const transactionData = {
            type: 'milestone_payment',
            fromUser: new mongoose.Types.ObjectId(clientId),
            fromUserRole: 'client',
            toUser: new mongoose.Types.ObjectId(freelancerId),
            toUserRole: 'freelancer',
            amount: amount,
            platformFee: platformFee,
            netAmount: netAmount,
            paymentMethod: 'stripe', // Changed from 'card' to 'stripe'
            description: description || `Payment of $${amount/100}`,
            status: 'completed',
            processedAt: new Date(),
            completedAt: new Date()
        };

        const newTransaction = new Transaction(transactionData);
        await newTransaction.save();

        // Populate for response
        await newTransaction.populate('toUser', 'name profilePicture');

        console.log('✅ Client payment transaction created successfully:', newTransaction._id);

        res.status(201).json({
            success: true,
            message: "Payment transaction created successfully",
            transaction: newTransaction
        });

    } catch (error) {
        console.error('❌ Create client payment error:', error);
        res.status(500).json({
            success: false,
            message: "Server error creating payment transaction",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
},
    // Get transaction details
    getTransactionDetails: async (req, res) => {
        try {
            const userId = req.userId;
            const { transactionId } = req.params;

            const transaction = await Transaction.findOne({
                transactionId,
                $or: [
                    { fromUser: userId },
                    { toUser: userId }
                ]
            })
                .populate('fromUser', 'name profilePicture email phone')
                .populate('toUser', 'name profilePicture email phone')
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
            res.status(500).json({
                success: false,
                message: "Server error fetching transaction details",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Create a payment transaction (Client to Freelancer)
    createPaymentTransaction: async (req, res) => {
        try {
            const clientId = req.userId;
            const { workspaceId, milestoneId, amount, description } = req.body;

            // Validate inputs
            if (!workspaceId || !amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Valid workspace ID and amount are required"
                });
            }

            // Verify workspace and client access
            const workspace = await Workspace.findOne({
                _id: workspaceId,
                clientId
            }).populate('freelancerId', '_id name');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
                });
            }

            // Verify milestone if provided
            if (milestoneId) {
                const milestone = await Milestone.findOne({
                    _id: milestoneId,
                    workspaceId
                });
                if (!milestone) {
                    return res.status(404).json({
                        success: false,
                        message: "Milestone not found"
                    });
                }
            }

            // Calculate platform fee (example: 10%)
            const platformFee = amount * 0.10;
            const netAmount = amount - platformFee;

            // Create transaction
            const transactionData = {
                type: 'milestone_payment',
                fromUser: clientId,
                fromUserRole: 'client',
                toUser: workspace.freelancerId._id,
                toUserRole: 'freelancer',
                amount: amount,
                platformFee: platformFee,
                netAmount: netAmount,
                relatedWorkspace: workspaceId,
                relatedMilestone: milestoneId || null,
                paymentMethod: 'stripe', // Default, can be overridden
                description: description || `Payment for ${workspace.projectTitle}`,
                status: 'pending'
            };

            const newTransaction = new Transaction(transactionData);
            await newTransaction.save();

            // Populate for response
            await newTransaction.populate('toUser', 'name profilePicture');
            await newTransaction.populate('relatedWorkspace', 'projectTitle');

            res.status(201).json({
                success: true,
                message: "Payment transaction created successfully",
                transaction: newTransaction
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Server error creating payment transaction",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Create withdrawal request (Freelancer to Bank)
    createWithdrawalRequest: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { amount, paymentMethod, accountDetails } = req.body;

            // Validate inputs
            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Valid withdrawal amount is required"
                });
            }

            if (!paymentMethod) {
                return res.status(400).json({
                    success: false,
                    message: "Payment method is required"
                });
            }

            // Check available balance (you need to implement this logic)
            const availableBalance = await calculateAvailableBalance(freelancerId);
            if (amount > availableBalance) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance for withdrawal"
                });
            }

            // Create withdrawal transaction
            const withdrawalData = {
                type: 'withdrawal',
                fromUser: freelancerId,
                fromUserRole: 'freelancer',
                toUser: 'platform', 
                toUserRole: 'platform',
                amount: -amount, 
                paymentMethod: paymentMethod,
                description: `Withdrawal request via ${paymentMethod}`,
                status: 'pending',
                metadata: { accountDetails }
            };

            const withdrawalTransaction = new Transaction(withdrawalData);
            await withdrawalTransaction.save();

            res.status(201).json({
                success: true,
                message: "Withdrawal request submitted successfully",
                transaction: withdrawalTransaction
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Server error creating withdrawal request",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get transaction statistics for user
    getTransactionStats: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;

            // Current month stats
            const currentMonth = new Date();
            const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

            const monthlyStats = await Transaction.aggregate([
                {
                    $match: {
                        $or: [{ fromUser: userId }, { toUser: userId }],
                        status: 'completed',
                        createdAt: { $gte: firstDayOfMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalIncome: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$toUser', userId] },
                                    '$netAmount',
                                    0
                                ]
                            }
                        },
                        totalExpenses: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$fromUser', userId] },
                                    { $abs: '$amount' },
                                    0
                                ]
                            }
                        },
                        transactionCount: { $sum: 1 }
                    }
                }
            ]);

            // Lifetime stats
            const lifetimeStats = await Transaction.aggregate([
                {
                    $match: {
                        $or: [{ fromUser: userId }, { toUser: userId }],
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalIncome: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$toUser', userId] },
                                    '$netAmount',
                                    0
                                ]
                            }
                        },
                        totalExpenses: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$fromUser', userId] },
                                    { $abs: '$amount' },
                                    0
                                ]
                            }
                        },
                        totalTransactions: { $sum: 1 }
                    }
                }
            ]);

            // Pending transactions count
            const pendingCount = await Transaction.countDocuments({
                $or: [{ fromUser: userId }, { toUser: userId }],
                status: 'pending'
            });

            const stats = {
                monthly: monthlyStats[0] || { totalIncome: 0, totalExpenses: 0, transactionCount: 0 },
                lifetime: lifetimeStats[0] || { totalIncome: 0, totalExpenses: 0, totalTransactions: 0 },
                pendingCount
            };

            res.json({
                success: true,
                stats
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Server error fetching transaction statistics",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Admin: Update transaction status
    updateTransactionStatus: async (req, res) => {
        try {
            const { transactionId } = req.params;
            const { status, adminNotes } = req.body;

            // Check if user is admin (you should have admin middleware)
            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required"
                });
            }

            const transaction = await Transaction.findOne({ transactionId });
            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: "Transaction not found"
                });
            }

            transaction.status = status;
            if (status === 'completed') {
                transaction.completedAt = new Date();
            } else if (status === 'failed') {
                transaction.failedAt = new Date();
            }

            if (adminNotes) {
                transaction.metadata = { ...transaction.metadata, adminNotes };
            }

            await transaction.save();

            res.json({
                success: true,
                message: "Transaction status updated successfully",
                transaction
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Server error updating transaction status",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

                         

    

module.exports = transactionController;