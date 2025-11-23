// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../Models/Payment');
const Contract = require('../Models/Contract');
const Workspace = require('../Models/Workspace');
const Milestone = require('../Models/Milestone');

const clientPaymentController = {
    createPaymentIntent: async (req, res) => {
        try {
            const clientId = req.userId;
            const { workspaceId, milestoneId, amount } = req.body;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                clientId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            const milestone = await Milestone.findOne({
                _id: milestoneId,
                workspaceId
            });

            if (!milestone || milestone.status !== 'completed') {
                return res.status(400).json({
                    success: false,
                    message: "Milestone not found or not completed"
                });
            }

            // Create Stripe Payment Intent
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount * 100, // Convert to cents
                currency: 'inr',
                metadata: {
                    workspaceId,
                    milestoneId,
                    clientId,
                    freelancerId: workspace.freelancerId
                }
            });

            // Create payment record
            const paymentData = {
                workspaceId,
                milestoneId,
                clientId,
                freelancerId: workspace.freelancerId,
                amount,
                type: 'milestone',
                status: 'pending',
                paymentMethod: 'stripe',
                stripePaymentIntentId: paymentIntent.id,
                description: `Payment for ${milestone.phaseTitle}`
            };

            if (!paymentData._id) {
                paymentData._id = `payment_${Date.now()}`;
            }

            const newPayment = new Payment(paymentData);
            await newPayment.save();

            res.json({
                success: true,
                clientSecret: paymentIntent.client_secret,
                paymentId: newPayment._id
            });

        } catch (error) {
            console.error("Create payment intent error:", error);
            res.status(500).json({
                success: false,
                message: "Server error creating payment"
            });
        }
    },

    confirmPayment: async (req, res) => {
        try {
            const clientId = req.userId;
            const { paymentId } = req.params;

            const payment = await Payment.findOne({
                _id: paymentId,
                clientId
            });

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: "Payment not found"
                });
            }

            // Verify payment with Stripe
            const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);

            if (paymentIntent.status === 'succeeded') {
                payment.status = 'completed';
                payment.paidAt = new Date();
                await payment.save();

                // Update milestone payment status
                await Milestone.findByIdAndUpdate(payment.milestoneId, {
                    'progress.paymentProcessed': true,
                    'progress.paymentDate': new Date()
                });

                res.json({
                    success: true,
                    message: "Payment confirmed successfully",
                    payment
                });
            } else {
                payment.status = 'failed';
                await payment.save();

                res.status(400).json({
                    success: false,
                    message: "Payment not completed"
                });
            }

        } catch (error) {
            console.error("Confirm payment error:", error);
            res.status(500).json({
                success: false,
                message: "Server error confirming payment"
            });
        }
    },

    getPaymentHistory: async (req, res) => {
        try {
            const clientId = req.userId;
            const { page = 1, limit = 10 } = req.query;

            const payments = await Payment.find({ clientId })
                .populate('workspaceId', 'projectTitle')
                .populate('freelancerId', 'name profilePicture')
                .populate('milestoneId', 'phaseTitle phaseNumber')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalPayments = await Payment.countDocuments({ clientId });

            res.json({
                success: true,
                payments,
                totalPages: Math.ceil(totalPayments / limit),
                currentPage: parseInt(page),
                totalPayments
            });

        } catch (error) {
            console.error("Get payment history error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching payment history"
            });
        }
    },

    getPendingPayments: async (req, res) => {
        try {
            const clientId = req.userId;

            const pendingMilestones = await Milestone.aggregate([
                {
                    $lookup: {
                        from: 'workspaces',
                        localField: 'workspaceId',
                        foreignField: '_id',
                        as: 'workspace'
                    }
                },
                {
                    $unwind: '$workspace'
                },
                {
                    $match: {
                        'workspace.clientId': clientId,
                        'status': 'completed',
                        'progress.paymentProcessed': false
                    }
                },
                {
                    $lookup: {
                        from: 'payments',
                        let: { milestoneId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$milestoneId', '$$milestoneId'] },
                                    status: { $in: ['pending', 'completed'] }
                                }
                            }
                        ],
                        as: 'existingPayments'
                    }
                },
                {
                    $match: {
                        'existingPayments.0': { $exists: false }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        phaseTitle: 1,
                        phaseNumber: 1,
                        phaseAmount: 1,
                        workspaceId: 1,
                        'workspace.projectTitle': 1,
                        'workspace.freelancerId': 1
                    }
                }
            ]);

            // Populate freelancer info
            const populatedMilestones = await Milestone.populate(pendingMilestones, {
                path: 'workspace.freelancerId',
                select: 'name profilePicture'
            });

            res.json({
                success: true,
                pendingPayments: populatedMilestones,
                totalPending: populatedMilestones.reduce((sum, milestone) => sum + milestone.phaseAmount, 0)
            });

        } catch (error) {
            console.error("Get pending payments error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching pending payments"
            });
        }
    },

    getPaymentDetails: async (req, res) => {
        try {
            const clientId = req.userId;
            const { paymentId } = req.params;

            const payment = await Payment.findOne({
                _id: paymentId,
                clientId
            })
                .populate('workspaceId', 'projectTitle')
                .populate('freelancerId', 'name profilePicture email')
                .populate('milestoneId', 'phaseTitle phaseNumber')
                .populate('clientId', 'name companyName');

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: "Payment not found"
                });
            }

            // Get Stripe payment details if available
            let stripeDetails = null;
            if (payment.stripePaymentIntentId) {
                try {
                    stripeDetails = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
                } catch (stripeError) {
                    console.error("Stripe retrieval error:", stripeError);
                }
            }

            res.json({
                success: true,
                payment: {
                    ...payment.toObject(),
                    stripeDetails
                }
            });

        } catch (error) {
            console.error("Get payment details error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching payment details"
            });
        }
    },

    getPaymentStats: async (req, res) => {
        try {
            const clientId = req.userId;

            const stats = await Payment.aggregate([
                {
                    $match: {
                        clientId,
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalPaid: { $sum: '$amount' },
                        totalTransactions: { $sum: 1 },
                        avgPayment: { $avg: '$amount' }
                    }
                }
            ]);

            const monthlyStats = await Payment.aggregate([
                {
                    $match: {
                        clientId,
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$paidAt' },
                            month: { $month: '$paidAt' }
                        },
                        amount: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id.year': -1, '_id.month': -1 }
                },
                {
                    $limit: 6
                }
            ]);

            const pendingStats = await Payment.aggregate([
                {
                    $match: {
                        clientId,
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

            res.json({
                success: true,
                stats: {
                    totalPaid: stats[0]?.totalPaid || 0,
                    totalTransactions: stats[0]?.totalTransactions || 0,
                    avgPayment: Math.round(stats[0]?.avgPayment || 0),
                    totalPending: pendingStats[0]?.totalPending || 0,
                    pendingCount: pendingStats[0]?.pendingCount || 0,
                    monthlyBreakdown: monthlyStats.reverse()
                }
            });

        } catch (error) {
            console.error("Get payment stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching payment stats"
            });
        }
    }
};

module.exports = clientPaymentController;