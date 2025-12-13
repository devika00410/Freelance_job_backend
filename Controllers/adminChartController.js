const Transaction = require('../Models/Transaction');
const User = require('../Models/User');
const Job = require('../Models/Job');
const Contract = require('../Models/Contract');


const adminChartController = {
    
    // Get revenue chart data
    getRevenueChartData: async (req, res) => {
        try {
            const { period = '30d' } = req.query; // 7d, 30d, 90d, 1y
            
            let days;
            switch (period) {
                case '7d': days = 7; break;
                case '30d': days = 30; break;
                case '90d': days = 90; break;
                case '1y': days = 365; break;
                default: days = 30;
            }
            
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            
            const revenueData = await Transaction.aggregate([
                {
                    $match: {
                        type: 'fee',
                        status: 'completed',
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                        },
                        revenue: { $sum: '$amount' },
                        transactions: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            
            // Fill missing dates with 0
            const chartData = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                const dateStr = date.toISOString().split('T')[0];
                
                const found = revenueData.find(d => d._id === dateStr);
                chartData.push({
                    date: dateStr,
                    revenue: found ? found.revenue : 0,
                    transactions: found ? found.transactions : 0,
                    day: date.toLocaleDateString('en-US', { weekday: 'short' })
                });
            }
            
            res.json({ 
                success: true, 
                period, 
                data: chartData,
                summary: {
                    totalRevenue: chartData.reduce((sum, day) => sum + day.revenue, 0),
                    totalTransactions: chartData.reduce((sum, day) => sum + day.transactions, 0),
                    avgDailyRevenue: chartData.reduce((sum, day) => sum + day.revenue, 0) / chartData.length
                }
            });
            
        } catch (error) {
            console.error("Get revenue chart data error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching revenue chart data"
            });
        }
    },
    
    // Get user growth chart data
    getUserGrowthData: async (req, res) => {
        try {
            const { period = '30d' } = req.query;
            
            let days;
            switch (period) {
                case '7d': days = 7; break;
                case '30d': days = 30; break;
                case '90d': days = 90; break;
                case '1y': days = 365; break;
                default: days = 30;
            }
            
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            
            const userData = await User.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                        },
                        clients: {
                            $sum: { $cond: [{ $eq: ["$role", "client"] }, 1, 0] }
                        },
                        freelancers: {
                            $sum: { $cond: [{ $eq: ["$role", "freelancer"] }, 1, 0] }
                        },
                        total: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            
            // Fill missing dates
            const chartData = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                const dateStr = date.toISOString().split('T')[0];
                
                const found = userData.find(d => d._id === dateStr);
                chartData.push({
                    date: dateStr,
                    clients: found ? found.clients : 0,
                    freelancers: found ? found.freelancers : 0,
                    total: found ? found.total : 0,
                    day: date.toLocaleDateString('en-US', { weekday: 'short' })
                });
            }
            
            // Get cumulative totals
            const cumulativeData = [];
            let totalClients = 0;
            let totalFreelancers = 0;
            let runningTotal = 0;
            
            for (const day of chartData) {
                totalClients += day.clients;
                totalFreelancers += day.freelancers;
                runningTotal += day.total;
                
                cumulativeData.push({
                    date: day.date,
                    clients: totalClients,
                    freelancers: totalFreelancers,
                    total: runningTotal
                });
            }
            
            res.json({
                success: true,
                period,
                dailyData: chartData,
                cumulativeData: cumulativeData,
                totals: {
                    totalClients: await User.countDocuments({ role: 'client' }),
                    totalFreelancers: await User.countDocuments({ role: 'freelancer' }),
                    totalUsers: await User.countDocuments()
                }
            });
            
        } catch (error) {
            console.error("Get user growth data error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching user growth data"
            });
        }
    },
    
    // Get job statistics
    getJobStatsData: async (req, res) => {
        try {
            // Status distribution
            const statusStats = await Job.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalBudget: { $sum: '$budget' },
                        avgBudget: { $avg: '$budget' }
                    }
                },
                { $sort: { count: -1 } }
            ]);
            
            // Category distribution
            const categoryStats = await Job.aggregate([
                { 
                    $match: { 
                        category: { $exists: true, $ne: "" } 
                    } 
                },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        totalBudget: { $sum: '$budget' },
                        avgBudget: { $avg: '$budget' }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);
            
            // Budget range distribution
            const budgetRanges = await Job.aggregate([
                {
                    $bucket: {
                        groupBy: "$budget",
                        boundaries: [0, 100, 500, 1000, 5000, 10000, Infinity],
                        default: "Other",
                        output: {
                            count: { $sum: 1 },
                            avgBudget: { $avg: "$budget" }
                        }
                    }
                }
            ]);
            
            // Monthly job postings (last 6 months)
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            const monthlyPostings = await Job.aggregate([
                {
                    $match: {
                        createdAt: { $gte: sixMonthsAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 },
                        totalBudget: { $sum: '$budget' }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]);
            
            // Success rate (completed vs total)
            const successStats = await Job.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        completed: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        },
                        active: {
                            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                        },
                        cancelled: {
                            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                        }
                    }
                }
            ]);
            
            const successRate = successStats[0]?.total > 0 ? 
                (successStats[0].completed / successStats[0].total) * 100 : 0;
            
            res.json({
                success: true,
                stats: {
                    statusDistribution: statusStats,
                    categoryDistribution: categoryStats,
                    budgetRanges,
                    monthlyPostings,
                    successRate: Math.round(successRate * 100) / 100,
                    totals: successStats[0] || {}
                }
            });
            
        } catch (error) {
            console.error("Get job stats data error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching job statistics"
            });
        }
    },
    
    // Get platform health metrics
    getPlatformHealth: async (req, res) => {
        try {
            const now = new Date();
            const oneHourAgo = new Date(now - 60 * 60 * 1000);
            const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
            const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            
            // Active users
            const activeUsers = await User.countDocuments({
                lastActive: { $gte: oneHourAgo }
            });
            
            // New registrations
            const newRegistrations24h = await User.countDocuments({
                createdAt: { $gte: oneDayAgo }
            });
            
            const newRegistrations7d = await User.countDocuments({
                createdAt: { $gte: sevenDaysAgo }
            });
            
            // Transaction success rate
            const transactions24h = await Transaction.countDocuments({
                createdAt: { $gte: oneDayAgo }
            });
            
            const successfulTransactions24h = await Transaction.countDocuments({
                status: 'completed',
                createdAt: { $gte: oneDayAgo }
            });
            
            const transactionSuccessRate = transactions24h > 0 ?
                (successfulTransactions24h / transactions24h) * 100 : 100;
            
            // Job completion rate
            const totalJobs = await Job.countDocuments({
                createdAt: { $gte: sevenDaysAgo }
            });
            
            const completedJobs = await Job.countDocuments({
                status: 'completed',
                createdAt: { $gte: sevenDaysAgo }
            });
            
            const jobCompletionRate = totalJobs > 0 ?
                (completedJobs / totalJobs) * 100 : 0;
            
            // Average response time (simulated)
            const avgResponseTime = 120; // ms
            
            // System uptime (simulated)
            const uptime = 99.9;
            
            // Error rate (simulated)
            const errorRate = 0.1;
            
            res.json({
                success: true,
                health: {
                    activeUsers,
                    newRegistrations: {
                        last24h: newRegistrations24h,
                        last7d: newRegistrations7d,
                        dailyAvg: Math.round(newRegistrations7d / 7)
                    },
                    transactions: {
                        successRate: Math.round(transactionSuccessRate * 100) / 100,
                        total24h: transactions24h,
                        successful24h: successfulTransactions24h
                    },
                    jobs: {
                        completionRate: Math.round(jobCompletionRate * 100) / 100,
                        totalLast7d: totalJobs,
                        completedLast7d: completedJobs
                    },
                    performance: {
                        avgResponseTime,
                        uptime: `${uptime}%`,
                        errorRate: `${errorRate}%`
                    },
                    lastUpdated: new Date()
                }
            });
            
        } catch (error) {
            console.error("Get platform health error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching platform health"
            });
        }
    },
    
    // Get combined dashboard data (all charts in one)
    getDashboardCharts: async (req, res) => {
        try {
            const [revenueData, userData, jobData, healthData] = await Promise.all([
                adminChartController.getRevenueChartData({ query: { period: '30d' } }, { json: (data) => data }),
                adminChartController.getUserGrowthData({ query: { period: '30d' } }, { json: (data) => data }),
                adminChartController.getJobStatsData({}, { json: (data) => data }),
                adminChartController.getPlatformHealth({}, { json: (data) => data })
            ]);
            
            res.json({
                success: true,
                revenue: revenueData.success ? revenueData : null,
                users: userData.success ? userData : null,
                jobs: jobData.success ? jobData : null,
                health: healthData.success ? healthData.health : null
            });
            
        } catch (error) {
            console.error("Get dashboard charts error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching dashboard charts"
            });
        }
    }
};

// Helper function to simulate response object
const mockRes = {
    json: (data) => data
};

module.exports = adminChartController;