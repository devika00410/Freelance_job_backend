const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../Models/Payment');
const Milestone = require('../Models/Milestone');
const Workspace = require('../Models/Workspace');

const clientPaymentController = {
createPaymentIntent: async (req, res) => {
  try {
    const { amount, freelancerId, projectId, description } = req.body;
    const clientId = req.userId;

    // Create payment record
    const payment = new Payment({
      clientId,
      freelancerId,
      projectId,
      amount,
      description,
      status: 'pending'
    });

    await payment.save();

    // Create notification for freelancer
    const notification = new Notification({
      userId: freelancerId,
      type: 'payment_received',
      title: 'New Payment Received',
      message: `Client has sent you $${(amount/100).toFixed(2)} for ${description}`,
      relatedId: payment._id
    });

    await notification.save();

    // In real Stripe, you would create Payment Intent here
    res.json({
      success: true,
      paymentId: payment._id,
      message: 'Payment initiated successfully'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
},

confirmPayment : async (req, res) => {
  try {
    const { paymentId } = req.body;
    
    // Update payment status
    const payment = await Payment.findByIdAndUpdate(
      paymentId,
      { status: 'completed', completedAt: new Date() },
      { new: true }
    ).populate('freelancerId', 'name email')
     .populate('clientId', 'name');

    // Update freelancer's earnings
    await User.findByIdAndUpdate(
      payment.freelancerId,
      { $inc: { totalEarnings: payment.amount } }
    );

    // Send success notification to freelancer
    const notification = new Notification({
      userId: payment.freelancerId,
      type: 'payment_completed',
      title: 'Payment Completed',
      message: `Payment of $${(payment.amount/100).toFixed(2)} from ${payment.clientId.name} has been processed`,
      relatedId: payment._id
    });

    await notification.save();

    res.json({
      success: true,
      message: 'Payment completed successfully',
      payment
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
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


    getClientProposalCount: async (req, res) => {
        try {
            const clientId = req.userId;

            const totalProposals = await Proposal.countDocuments({ clientId });
            const pendingProposals = await Proposal.countDocuments({
                clientId,
                status: 'submitted'
            });
            const acceptedProposals = await Proposal.countDocuments({
                clientId,
                status: 'accepted'
            });

            res.json({
                success: true,
                count: totalProposals,
                total: totalProposals,
                pending: pendingProposals,
                accepted: acceptedProposals
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error fetching proposal count'
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