const Transaction = require('../Models/Transaction');
const User = require('../Models/User');
const Job = require('../Models/Job');
const Contract = require('../Models/Contract');

const adminPaymentController = {
    // Get escrow overview
    getEscrowOverview: async (req, res) => {
        try {
            // Total escrow balance (held funds)
            const escrowBalanceResult = await Transaction.aggregate([
                { 
                    $match: { 
                        type: 'escrow', 
                        status: 'held' 
                    } 
                },
                { 
                    $group: { 
                        _id: null, 
                        total: { $sum: '$amount' } 
                    } 
                }
            ]);
            
            const escrowBalance = escrowBalanceResult[0]?.total || 0;
            
            // Pending releases (jobs completed, payment pending)
            const pendingJobs = await Job.find({ 
                status: 'completed', 
                paymentStatus: { $in: ['pending', 'escrow'] }
            })
                .populate('clientId', 'name email')
                .populate('freelancerId', 'name email')
                .select('title budget status paymentStatus completedAt')
                .sort({ completedAt: -1 })
                .limit(20);
            
            // Platform revenue (fees collected)
            const platformRevenueResult = await Transaction.aggregate([
                { 
                    $match: { 
                        type: 'fee', 
                        status: 'completed' 
                    } 
                },
                { 
                    $group: { 
                        _id: null, 
                        total: { $sum: '$amount' } 
                    } 
                }
            ]);
            
            const platformRevenue = platformRevenueResult[0]?.total || 0;
            
            // Recent transactions
            const recentTransactions = await Transaction.find()
                .populate('fromUser', 'name email')
                .populate('toUser', 'name email')
                .select('type amount status description createdAt')
                .sort({ createdAt: -1 })
                .limit(15);
            
            // Jobs in escrow count
            const jobsInEscrow = await Job.countDocuments({ 
                paymentStatus: 'escrow' 
            });
            
            res.json({
                success: true,
                overview: {
                    escrowBalance,
                    platformRevenue,
                    jobsInEscrow,
                    pendingReleases: pendingJobs.length,
                    totalProcessed: platformRevenue + escrowBalance
                },
                pendingJobs,
                recentTransactions
            });
            
        } catch (error) {
            console.error("Get escrow overview error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching escrow overview"
            });
        }
    },
    
    // Release payment to freelancer
    releasePayment: async (req, res) => {
        try {
             const adminId = req.userId || req.user?._id;
            const { jobId } = req.params;
            const { adminNotes } = req.body;
            
            const job = await Job.findById(jobId)
                .populate('clientId')
                .populate('freelancerId');
            
            if (!job) {
                return res.status(404).json({
                    success: false,
                    message: "Job not found"
                });
            }
            
            if (job.paymentStatus === 'released') {
                return res.status(400).json({
                    success: false,
                    message: "Payment already released for this job"
                });
            }
            
            // Calculate amounts (75% to freelancer, 25% platform fee)
            const totalAmount = job.budget || 0;
            const platformFee = totalAmount * 0.25;
            const freelancerAmount = totalAmount - platformFee;
            
            // Create transaction records
            const transactions = [];
            
            // 1. Platform fee transaction
            if (platformFee > 0) {
                const feeTransaction = new Transaction({
                    fromUser: job.clientId._id,
                    toUser: null, // Platform/admin
                    amount: platformFee,
                    type: 'fee',
                    status: 'completed',
                    description: `Platform fee for job: ${job.title}`,
                    referenceId: job._id,
                    referenceModel: 'Job',
                    adminNotes: adminNotes || 'Auto-released by admin'
                });
                transactions.push(feeTransaction.save());
            }
            
            // 2. Freelancer payment transaction
            const paymentTransaction = new Transaction({
                fromUser: job.clientId._id,
                toUser: job.freelancerId._id,
                amount: freelancerAmount,
                type: 'payment',
                status: 'completed',
                description: `Payment for completed job: ${job.title}`,
                referenceId: job._id,
                referenceModel: 'Job',
                adminNotes: adminNotes || 'Auto-released by admin'
            });
            transactions.push(paymentTransaction.save());
            
            // 3. Update escrow transaction status if exists
            const escrowTransaction = await Transaction.findOne({
                referenceId: job._id,
                type: 'escrow',
                status: 'held'
            });
            
            if (escrowTransaction) {
                escrowTransaction.status = 'released';
                escrowTransaction.releasedAt = new Date();
                escrowTransaction.adminNotes = adminNotes || 'Released to freelancer';
                transactions.push(escrowTransaction.save());
            }
            
            // 4. Update job payment status
            job.paymentStatus = 'released';
            job.paymentReleasedAt = new Date();
            job.paymentReleasedBy = req.admin?._id;
            
            transactions.push(job.save());
            
            // Execute all transactions
            await Promise.all(transactions);
            
            res.json({
                success: true,
                message: 'Payment released successfully',
                details: {
                    jobTitle: job.title,
                    client: job.clientId.name,
                    freelancer: job.freelancerId.name,
                    totalAmount,
                    platformFee,
                    freelancerAmount,
                    releaseDate: new Date()
                }
            });
            
        } catch (error) {
            console.error("Release payment error:", error);
            res.status(500).json({
                success: false,
                message: "Server error releasing payment"
            });
        }
        console.log(`Admin ${adminId} performed action: ${actionName}`);
    },
    
    // Get payment statistics
    getPaymentStats: async (req, res) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            
            // Today's stats
            const todayStats = await Transaction.aggregate([
                {
                    $match: {
                        type: 'fee',
                        status: 'completed',
                        createdAt: { $gte: today }
                    }
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: '$amount' },
                        transactions: { $sum: 1 }
                    }
                }
            ]);
            
            // Yesterday's stats (for comparison)
            const yesterdayStats = await Transaction.aggregate([
                {
                    $match: {
                        type: 'fee',
                        status: 'completed',
                        createdAt: { $gte: yesterday, $lt: today }
                    }
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: '$amount' },
                        transactions: { $sum: 1 }
                    }
                }
            ]);
            
            // This month's stats
            const monthlyStats = await Transaction.aggregate([
                {
                    $match: {
                        type: 'fee',
                        status: 'completed',
                        createdAt: { $gte: startOfMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: '$amount' },
                        transactions: { $sum: 1 }
                    }
                }
            ]);
            
            // All-time stats
            const allTimeStats = await Transaction.aggregate([
                {
                    $match: {
                        type: 'fee',
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: '$amount' },
                        transactions: { $sum: 1 }
                    }
                }
            ]);
            
            // Pending escrow
            const pendingEscrow = await Transaction.aggregate([
                {
                    $match: {
                        type: 'escrow',
                        status: 'held'
                    }
                },
                {
                    $group: {
                        _id: null,
                        amount: { $sum: '$amount' }
                    }
                }
            ]);
            
            // Payment method distribution
            const paymentMethods = await Transaction.aggregate([
                {
                    $match: {
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: '$paymentMethod',
                        count: { $sum: 1 },
                        amount: { $sum: '$amount' }
                    }
                },
                {
                    $sort: { amount: -1 }
                }
            ]);
            
            const todayRevenue = todayStats[0]?.revenue || 0;
            const yesterdayRevenue = yesterdayStats[0]?.revenue || 0;
            const revenueGrowth = yesterdayRevenue > 0 ? 
                ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
            
            res.json({
                success: true,
                stats: {
                    today: {
                        revenue: todayRevenue,
                        transactions: todayStats[0]?.transactions || 0,
                        avgTransaction: todayStats[0]?.transactions > 0 ? 
                            todayRevenue / todayStats[0].transactions : 0
                    },
                    monthly: {
                        revenue: monthlyStats[0]?.revenue || 0,
                        transactions: monthlyStats[0]?.transactions || 0
                    },
                    allTime: {
                        revenue: allTimeStats[0]?.revenue || 0,
                        transactions: allTimeStats[0]?.transactions || 0
                    },
                    pendingEscrow: pendingEscrow[0]?.amount || 0,
                    revenueGrowth: Math.round(revenueGrowth * 100) / 100, // 2 decimal places
                    paymentMethods
                }
            });
            
        } catch (error) {
            console.error("Get payment stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching payment statistics"
            });
        }
    },
    
    // Bulk release payments
    bulkReleasePayments: async (req, res) => {
        try {
            const { jobIds } = req.body;
            
            if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "jobIds array is required"
                });
            }
            
            const results = {
                successful: [],
                failed: []
            };
            
            for (const jobId of jobIds) {
                try {
                    // Simulate release - in production, call the actual release logic
                    const job = await Job.findById(jobId);
                    
                    if (!job) {
                        results.failed.push({
                            jobId,
                            error: "Job not found"
                        });
                        continue;
                    }
                    
                    if (job.paymentStatus === 'released') {
                        results.failed.push({
                            jobId,
                            error: "Payment already released"
                        });
                        continue;
                    }
                    
                    // Update job status (simplified for bulk)
                    job.paymentStatus = 'released';
                    job.paymentReleasedAt = new Date();
                    await job.save();
                    
                    results.successful.push({
                        jobId,
                        title: job.title,
                        amount: job.budget
                    });
                    
                } catch (error) {
                    results.failed.push({
                        jobId,
                        error: error.message
                    });
                }
            }
            
            res.json({
                success: true,
                message: `Processed ${jobIds.length} payments`,
                results: {
                    total: jobIds.length,
                    successful: results.successful.length,
                    failed: results.failed.length,
                    details: {
                        successful: results.successful,
                        failed: results.failed
                    }
                }
            });
            
        } catch (error) {
            console.error("Bulk release payments error:", error);
            res.status(500).json({
                success: false,
                message: "Server error processing bulk payments"
            });
        }
    },
    
    // Get transaction details
    getTransactionDetails: async (req, res) => {
        try {
            const { transactionId } = req.params;
            
            const transaction = await Transaction.findById(transactionId)
                .populate('fromUser', 'name email profile')
                .populate('toUser', 'name email profile')
                .populate('referenceId');
            
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
    
    // Get pending payments for a specific user
    getUserPendingPayments: async (req, res) => {
        try {
            const { userId } = req.params;
            
            const pendingJobs = await Job.find({
                $or: [
                    { clientId: userId, paymentStatus: { $in: ['pending', 'escrow'] } },
                    { freelancerId: userId, paymentStatus: { $in: ['pending', 'escrow'] } }
                ]
            })
                .populate('clientId', 'name email')
                .populate('freelancerId', 'name email')
                .select('title budget status paymentStatus deadline completedAt')
                .sort({ completedAt: -1 });
            
            res.json({
                success: true,
                pendingJobs,
                totalPending: pendingJobs.length,
                totalAmount: pendingJobs.reduce((sum, job) => sum + (job.budget || 0), 0)
            });
            
        } catch (error) {
            console.error("Get user pending payments error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching user pending payments"
            });
        }
    }
};

module.exports = adminPaymentController;