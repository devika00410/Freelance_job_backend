const Job = require('../Models/Job');
const Proposal = require('../Models/Proposal');
const Transaction = require('../Models/Transaction');
const Project = require('../Models/Project');
const Contract = require('../Models/Contract');

// Shared aggregation pipelines and utility functions
const analyticsController = {
    // Common date range calculator
    calculateDateRange: (months = 6) => {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - parseInt(months));
        return startDate;
    },

    // Format monthly data for charts
    formatMonthlyData: (aggregationResults, fillEmptyMonths = true) => {
        const monthlyData = {};
        
        aggregationResults.forEach(item => {
            const key = `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`;
            monthlyData[key] = item;
        });

        if (fillEmptyMonths) {
            const result = [];
            const currentDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 6); // Last 6 months by default

            for (let date = new Date(startDate); date <= currentDate; date.setMonth(date.getMonth() + 1)) {
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const key = `${year}-${month.toString().padStart(2, '0')}`;
                
                result.push({
                    year,
                    month,
                    label: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
                    ...(monthlyData[key] || { count: 0, amount: 0, total: 0 })
                });
            }
            return result;
        }

        return aggregationResults;
    },

    // Get monthly trends (shared for both clients and freelancers)
    getMonthlyTrends: async (matchQuery, collection, valueField = 'amount') => {
        return await collection.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 },
                    amount: { $sum: `$${valueField}` },
                    average: { $avg: `$${valueField}` }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            { $limit: 12 }
        ]);
    },

    // Get status distribution (shared)
    getStatusDistribution: async (matchQuery, collection, statusField = 'status') => {
        return await collection.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: `$${statusField}`,
                    count: { $sum: 1 },
                    total: { $sum: '$budget' }
                }
            },
            { $sort: { count: -1 } }
        ]);
    },

    // Get category distribution (shared)
    getCategoryDistribution: async (matchQuery, collection, categoryField = 'category') => {
        return await collection.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: `$${categoryField}`,
                    count: { $sum: 1 },
                    total: { $sum: '$budget' },
                    average: { $avg: '$budget' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
    },

    // Calculate success rates (for proposals)
    calculateSuccessRates: async (matchQuery) => {
        return await Proposal.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    accepted: { 
                        $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } 
                    },
                    submitted: { 
                        $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } 
                    },
                    rejected: { 
                        $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } 
                    },
                    totalValue: { $sum: '$proposalDetails.totalAmount' },
                    avgValue: { $avg: '$proposalDetails.totalAmount' }
                }
            }
        ]);
    },

    // Get financial metrics (shared for both)
    getFinancialMetrics: async (matchQuery, userField, userRole) => {
        const baseMatch = {
            status: 'completed',
            ...matchQuery
        };

        // For clients: fromUser, for freelancers: toUser
        const userMatchField = userRole === 'client' ? 'fromUser' : 'toUser';

        return await Transaction.aggregate([
            {
                $match: {
                    [userMatchField]: matchQuery[userField],
                    ...baseMatch
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    totalNet: { $sum: '$netAmount' },
                    totalFees: { $sum: '$platformFee' },
                    transactionCount: { $sum: 1 },
                    avgTransaction: { $avg: '$amount' },
                    largestTransaction: { $max: '$amount' },
                    smallestTransaction: { $min: '$amount' }
                }
            }
        ]);
    },

    // Get monthly financial trends
    getMonthlyFinancialTrends: async (matchQuery, userField, userRole, months = 12) => {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - parseInt(months));

        const userMatchField = userRole === 'client' ? 'fromUser' : 'toUser';

        return await Transaction.aggregate([
            {
                $match: {
                    [userMatchField]: matchQuery[userField],
                    status: 'completed',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalAmount: { $sum: '$amount' },
                    totalNet: { $sum: '$netAmount' },
                    totalFees: { $sum: '$platformFee' },
                    transactionCount: { $sum: 1 },
                    avgTransaction: { $avg: '$amount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
    },

    // Get top performing categories
    getTopCategories: async (matchQuery, collection, valueField = 'budget') => {
        return await collection.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    totalValue: { $sum: `$${valueField}` },
                    avgValue: { $avg: `$${valueField}` },
                    successRate: {
                        $avg: {
                            $cond: [
                                { $in: ['$status', ['completed', 'accepted', 'active']] },
                                1, 0
                            ]
                        }
                    }
                }
            },
            { $sort: { totalValue: -1 } },
            { $limit: 8 }
        ]);
    },

    // Get timeline metrics (for projects/contracts)
    getTimelineMetrics: async (matchQuery, collection) => {
        return await collection.aggregate([
            { $match: matchQuery },
            {
                $project: {
                    title: 1,
                    status: 1,
                    budget: 1,
                    startDate: 1,
                    endDate: 1,
                    completedAt: 1,
                    durationDays: {
                        $cond: {
                            if: { $and: ['$startDate', '$completedAt'] },
                            then: {
                                $divide: [
                                    { $subtract: ['$completedAt', '$startDate'] },
                                    1000 * 60 * 60 * 24
                                ]
                            },
                            else: null
                        }
                    },
                    isOnTime: {
                        $cond: {
                            if: { $and: ['$completedAt', '$endDate'] },
                            then: { $lte: ['$completedAt', '$endDate'] },
                            else: null
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalProjects: { $sum: 1 },
                    completedProjects: { 
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
                    },
                    onTimeProjects: {
                        $sum: { $cond: ['$isOnTime', 1, 0] }
                    },
                    avgDuration: { $avg: '$durationDays' },
                    onTimeRate: {
                        $avg: { $cond: ['$isOnTime', 1, 0] }
                    }
                }
            }
        ]);
    },

    // Get skills/technology trends
    getSkillsTrends: async (matchQuery) => {
        return await Job.aggregate([
            { $match: matchQuery },
            { $unwind: '$skillsRequired' },
            {
                $group: {
                    _id: '$skillsRequired',
                    count: { $sum: 1 },
                    avgBudget: { $avg: '$budget' },
                    totalBudget: { $sum: '$budget' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 15 }
        ]);
    },

    // Calculate growth metrics
    calculateGrowthMetrics: async (currentData, previousData, field = 'count') => {
        const current = currentData[0]?.[field] || 0;
        const previous = previousData[0]?.[field] || 0;
        
        if (previous === 0) return current > 0 ? 100 : 0;
        
        return ((current - previous) / previous) * 100;
    },

    // Get comparative period data
    getComparativeData: async (matchQuery, collection, currentPeriod, previousPeriod, groupField = null) => {
        const currentData = await collection.aggregate([
            { 
                $match: {
                    ...matchQuery,
                    createdAt: { $gte: currentPeriod.start, $lte: currentPeriod.end }
                }
            },
            {
                $group: {
                    _id: groupField ? `$${groupField}` : null,
                    count: { $sum: 1 },
                    amount: { $sum: '$budget' }
                }
            }
        ]);

        const previousData = await collection.aggregate([
            { 
                $match: {
                    ...matchQuery,
                    createdAt: { $gte: previousPeriod.start, $lte: previousPeriod.end }
                }
            },
            {
                $group: {
                    _id: groupField ? `$${groupField}` : null,
                    count: { $sum: 1 },
                    amount: { $sum: '$budget' }
                }
            }
        ]);

        return { current: currentData, previous: previousData };
    },

    // Format data for charts (common function)
    formatChartData: (data, labelField = '_id', valueField = 'count') => {
        return data.map(item => ({
            label: item[labelField],
            value: item[valueField],
            ...item
        }));
    },

    // Calculate average response times
    calculateResponseTimes: async (matchQuery) => {
        return await Proposal.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'jobs',
                    localField: 'projectId',
                    foreignField: '_id',
                    as: 'job'
                }
            },
            { $unwind: '$job' },
            {
                $project: {
                    responseTime: {
                        $divide: [
                            { $subtract: ['$createdAt', '$job.createdAt'] },
                            1000 * 60 * 60 // Convert to hours
                        ]
                    },
                    projectTitle: '$job.title',
                    proposalAmount: '$proposalDetails.totalAmount'
                }
            },
            {
                $group: {
                    _id: null,
                    avgResponseTime: { $avg: '$responseTime' },
                    minResponseTime: { $min: '$responseTime' },
                    maxResponseTime: { $max: '$responseTime' },
                    count: { $sum: 1 }
                }
            }
        ]);
    }
};

module.exports = analyticsController;