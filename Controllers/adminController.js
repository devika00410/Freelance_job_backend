const User = require('../Models/User');
const Job = require('../Models/Job');
const Proposal = require('../Models/Proposal');
const Contract = require('../Models/Contract');
const Workspace = require('../Models/Workspace');
const Payment = require('../Models/Payment');
const Report = require('../Models/Report');

const adminController = {
    getDashboardStats: async (req, res) => {
        try {
            const [
                totalUsers,
                totalJobs,
                totalProposals,
                totalContracts,
                totalWorkspaces,
                totalPayments,
                totalReports
            ] = await Promise.all([
                User.countDocuments(),
                Job.countDocuments(),
                Proposal.countDocuments(),
                Contract.countDocuments(),
                Workspace.countDocuments(),
                Payment.countDocuments(),
                Report.countDocuments()
            ]);

            const userStats = await User.aggregate([
                {
                    $group: {
                        _id: '$role',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const jobStats = await Job.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const paymentStats = await Payment.aggregate([
                {
                    $match: { status: 'completed' }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amount' },
                        totalTransactions: { $sum: 1 }
                    }
                }
            ]);

            const recentUsers = await User.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .select('name email role createdAt');

            const recentJobs = await Job.find()
                .populate('clientId', 'name companyName')
                .sort({ createdAt: -1 })
                .limit(5)
                .select('title budget status createdAt');

            res.json({
                success: true,
                stats: {
                    totalUsers,
                    totalJobs,
                    totalProposals,
                    totalContracts,
                    totalWorkspaces,
                    totalPayments,
                    totalReports,
                    userStats,
                    jobStats,
                    totalRevenue: paymentStats[0]?.totalRevenue || 0,
                    totalTransactions: paymentStats[0]?.totalTransactions || 0
                },
                recentUsers,
                recentJobs
            });

        } catch (error) {
            console.error("Get dashboard stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching dashboard stats"
            });
        }
    },

    getAnalytics: async (req, res) => {
        try {
            const { period = '30d' } = req.query;
            let days = 30;
            if (period === '7d') days = 7;
            if (period === '90d') days = 90;

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // User registration analytics
            const userRegistrations = await User.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            role: '$role'
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id.date': 1 }
                }
            ]);

            // Job posting analytics
            const jobPostings = await Job.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            status: '$status'
                        },
                        count: { $sum: 1 },
                        totalBudget: { $sum: '$budget' }
                    }
                },
                {
                    $sort: { '_id.date': 1 }
                }
            ]);

            // Payment analytics
            const paymentAnalytics = await Payment.aggregate([
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
                        totalAmount: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id.date': 1 }
                }
            ]);

            // Service category analytics
            const serviceAnalytics = await Job.aggregate([
                {
                    $group: {
                        _id: '$category',
                        totalJobs: { $sum: 1 },
                        totalBudget: { $sum: '$budget' },
                        avgBudget: { $avg: '$budget' }
                    }
                },
                {
                    $sort: { totalJobs: -1 }
                }
            ]);

            res.json({
                success: true,
                analytics: {
                    userRegistrations,
                    jobPostings,
                    paymentAnalytics,
                    serviceAnalytics,
                    period
                }
            });

        } catch (error) {
            console.error("Get analytics error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching analytics"
            });
        }
    },

    getPlatformHealth: async (req, res) => {
        try {
            const activeUsers = await User.countDocuments({
                lastSeen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });

            const successfulProjects = await Workspace.countDocuments({
                status: 'completed'
            });

            const activeProjects = await Workspace.countDocuments({
                status: 'active'
            });

            const disputeRate = await Report.countDocuments({
                status: 'open'
            });

            const platformStats = {
                activeUsers,
                successfulProjects,
                activeProjects,
                disputeRate,
                uptime: '99.9%',
                responseTime: '120ms'
            };

            res.json({
                success: true,
                platformHealth: platformStats
            });

        } catch (error) {
            console.error("Get platform health error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching platform health"
            });
        }
    },

    getRevenueAnalytics: async (req, res) => {
        try {
            const { year = new Date().getFullYear() } = req.query;

            const monthlyRevenue = await Payment.aggregate([
                {
                    $match: {
                        status: 'completed',
                        paidAt: {
                            $gte: new Date(`${year}-01-01`),
                            $lte: new Date(`${year}-12-31`)
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            month: { $month: '$paidAt' },
                            year: { $year: '$paidAt' }
                        },
                        revenue: { $sum: '$amount' },
                        transactions: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id.year': 1, '_id.month': 1 }
                }
            ]);

            const revenueByService = await Job.aggregate([
                {
                    $lookup: {
                        from: 'payments',
                        localField: '_id',
                        foreignField: 'relatedProject',
                        as: 'payments'
                    }
                },
                {
                    $unwind: '$payments'
                },
                {
                    $match: {
                        'payments.status': 'completed'
                    }
                },
                {
                    $group: {
                        _id: '$category',
                        revenue: { $sum: '$payments.amount' },
                        projects: { $sum: 1 }
                    }
                },
                {
                    $sort: { revenue: -1 }
                }
            ]);

            const totalRevenue = monthlyRevenue.reduce((sum, month) => sum + month.revenue, 0);
            const totalTransactions = monthlyRevenue.reduce((sum, month) => sum + month.transactions, 0);

            res.json({
                success: true,
                revenue: {
                    monthlyRevenue,
                    revenueByService,
                    totalRevenue,
                    totalTransactions,
                    averageTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
                    year: parseInt(year)
                }
            });

        } catch (error) {
            console.error("Get revenue analytics error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching revenue analytics"
            });
        }
    }
};

module.exports = adminController;