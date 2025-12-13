const Job = require('../Models/Job');
const Proposal = require('../Models/Proposal');
const Contract = require('../Models/Contract');
const Project = require('../Models/Project');
const analyticsController = require('../Controllers/analyticsController');

const clientAnalyticsController = {
    // Get comprehensive client analytics overview USING SHARED CONTROLLER
    getClientOverview: async (req, res) => {
        try {
            const clientId = req.userId;

            // Use shared functions for consistent data
            const jobStats = await analyticsController.getStatusDistribution(
                { clientId }, 
                Job,
                'status'
            );

            const proposalStats = await analyticsController.getStatusDistribution(
                { clientId }, 
                Proposal,
                'status'
            );

            const contractStats = await analyticsController.getStatusDistribution(
                { clientId }, 
                Contract,
                'status'
            );

            // Financial metrics using shared function
            const financialStats = await analyticsController.getFinancialMetrics(
                { clientId }, 
                clientId, 
                'client'
            );

            // Monthly trends for jobs
            const monthlyJobTrends = await analyticsController.getMonthlyTrends(
                { clientId },
                Job,
                'budget'
            );

            // Category distribution
            const categoryDistribution = await analyticsController.getCategoryDistribution(
                { clientId },
                Job
            );

            // Success rates for proposals
            const proposalSuccessRates = await analyticsController.calculateSuccessRates(
                { clientId }
            );

            // Active projects count
            const activeProjects = await Project.countDocuments({
                clientId,
                status: { $in: ['active', 'in_progress'] }
            });

            // Quick Stats Summary using shared calculations
            const totalJobs = await Job.countDocuments({ clientId });
            const totalProposals = await Proposal.countDocuments({ clientId });
            const totalContracts = await Contract.countDocuments({ clientId });
            const totalSpent = financialStats[0]?.totalAmount || 0;

            // Calculate growth metrics (current month vs previous month)
            const currentMonth = new Date();
            const previousMonth = new Date();
            previousMonth.setMonth(previousMonth.getMonth() - 1);

            const currentPeriod = {
                start: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
                end: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
            };

            const previousPeriod = {
                start: new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1),
                end: new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0)
            };

            // Job growth
            const jobGrowthData = await analyticsController.getComparativeData(
                { clientId },
                Job,
                currentPeriod,
                previousPeriod
            );

            const jobGrowth = await analyticsController.calculateGrowthMetrics(
                jobGrowthData.current,
                jobGrowthData.previous,
                'count'
            );

            // Spending growth
            const spendingGrowthData = await analyticsController.getComparativeData(
                { clientId },
                Job,
                currentPeriod,
                previousPeriod
            );

            const spendingGrowth = await analyticsController.calculateGrowthMetrics(
                spendingGrowthData.current,
                spendingGrowthData.previous,
                'amount'
            );

            // Format data for frontend using shared formatter
            const formattedJobStats = analyticsController.formatChartData(jobStats, '_id', 'count');
            const formattedProposalStats = analyticsController.formatChartData(proposalStats, '_id', 'count');
            const formattedCategoryDistribution = analyticsController.formatChartData(categoryDistribution, '_id', 'count');

            // Format monthly trends
            const formattedMonthlyTrends = analyticsController.formatMonthlyData(monthlyJobTrends);

            res.json({
                success: true,
                overview: {
                    quickStats: {
                        totalJobs,
                        totalProposals,
                        totalContracts,
                        activeProjects,
                        totalSpent,
                        jobGrowth: Math.round(jobGrowth),
                        spendingGrowth: Math.round(spendingGrowth),
                        acceptanceRate: proposalSuccessRates[0] ? 
                            Math.round((proposalSuccessRates[0].accepted / proposalSuccessRates[0].total) * 100) : 0
                    },
                    distributions: {
                        jobs: formattedJobStats,
                        proposals: formattedProposalStats,
                        contracts: contractStats,
                        categories: formattedCategoryDistribution
                    },
                    financials: financialStats[0] || {
                        totalAmount: 0,
                        totalNet: 0,
                        totalFees: 0,
                        transactionCount: 0,
                        avgTransaction: 0,
                        largestTransaction: 0,
                        smallestTransaction: 0
                    },
                    trends: {
                        monthlyJobs: formattedMonthlyTrends,
                        proposalMetrics: proposalSuccessRates[0] || {
                            total: 0,
                            accepted: 0,
                            submitted: 0,
                            rejected: 0,
                            totalValue: 0,
                            avgValue: 0
                        }
                    }
                }
            });

        } catch (error) {
            console.error("Get client overview error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching client overview",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Other client analytics methods remain the same but can be updated similarly...
    getJobTrends: async (req, res) => {
        try {
            const clientId = req.userId;
            const { months = 6 } = req.query;

            // Use shared date range calculator
            const startDate = analyticsController.calculateDateRange(months);

            // Use shared monthly trends function
            const monthlyJobs = await analyticsController.getMonthlyTrends(
                { 
                    clientId,
                    createdAt: { $gte: startDate }
                },
                Job,
                'budget'
            );

            // Use shared category distribution
            const categoryDistribution = await analyticsController.getCategoryDistribution(
                { clientId },
                Job
            );

            // Use shared skills trends
            const skillsDemand = await analyticsController.getSkillsTrends(
                { clientId }
            );

            // Format data using shared formatters
            const formattedMonthlyJobs = analyticsController.formatMonthlyData(monthlyJobs);
            const formattedCategories = analyticsController.formatChartData(categoryDistribution, '_id', 'count');
            const formattedSkills = analyticsController.formatChartData(skillsDemand, '_id', 'count');

            res.json({
                success: true,
                trends: {
                    monthlyJobs: formattedMonthlyJobs,
                    categoryDistribution: formattedCategories,
                    skillsDemand: formattedSkills,
                    period: `${months} months`
                }
            });

        } catch (error) {
            console.error("Get job trends error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching job trends"
            });
        }
    },

    // Get financial analytics
    getFinancialAnalytics: async (req, res) => {
        try {
            const clientId = req.userId;
            const { months = 12 } = req.query;

            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - parseInt(months));

            // Monthly spending trends
            const monthlySpending = await Transaction.aggregate([
                {
                    $match: {
                        fromUser: clientId,
                        type: 'milestone_payment',
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
                        totalSpent: { $sum: '$amount' },
                        totalFees: { $sum: '$platformFee' },
                        transactionCount: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]);

            // Payment method distribution
            const paymentMethods = await Transaction.aggregate([
                {
                    $match: {
                        fromUser: clientId,
                        type: 'milestone_payment',
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

            // Project cost analysis
            const projectCosts = await Project.aggregate([
                { $match: { clientId } },
                {
                    $lookup: {
                        from: 'transactions',
                        localField: '_id',
                        foreignField: 'relatedProject',
                        as: 'payments'
                    }
                },
                {
                    $project: {
                        title: 1,
                        budget: 1,
                        totalPaid: {
                            $sum: '$payments.amount'
                        },
                        status: 1
                    }
                },
                { $sort: { totalPaid: -1 } }
            ]);

            // Budget vs Actual spending
            const budgetVsActual = await Job.aggregate([
                { $match: { clientId } },
                {
                    $lookup: {
                        from: 'projects',
                        localField: '_id',
                        foreignField: 'jobId',
                        as: 'project'
                    }
                },
                {
                    $lookup: {
                        from: 'transactions',
                        localField: '_id',
                        foreignField: 'relatedProject',
                        as: 'payments'
                    }
                },
                {
                    $project: {
                        title: 1,
                        budget: 1,
                        actualSpent: {
                            $sum: '$payments.amount'
                        },
                        variance: {
                            $subtract: [
                                '$budget',
                                { $sum: '$payments.amount' }
                            ]
                        }
                    }
                }
            ]);

            res.json({
                success: true,
                financials: {
                    monthlySpending,
                    paymentMethods,
                    projectCosts,
                    budgetVsActual,
                    period: `${months} months`
                }
            });

        } catch (error) {
            console.error("Get financial analytics error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching financial analytics",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get proposal analytics
    getProposalAnalytics: async (req, res) => {
        try {
            const clientId = req.userId;

            // Proposal conversion rates
            const proposalConversion = await Proposal.aggregate([
                { $match: { clientId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        avgAmount: { $avg: '$proposalDetails.totalAmount' },
                        totalAmount: { $sum: '$proposalDetails.totalAmount' }
                    }
                }
            ]);

            // Response time analysis (time from job posting to first proposal)
            const responseTimeAnalysis = await Job.aggregate([
                { $match: { clientId } },
                {
                    $lookup: {
                        from: 'proposals',
                        localField: '_id',
                        foreignField: 'projectId',
                        as: 'proposals'
                    }
                },
                {
                    $project: {
                        title: 1,
                        createdAt: 1,
                        firstProposalTime: {
                            $min: '$proposals.createdAt'
                        },
                        proposalCount: { $size: '$proposals' }
                    }
                },
                {
                    $project: {
                        title: 1,
                        responseTimeHours: {
                            $divide: [
                                { $subtract: ['$firstProposalTime', '$createdAt'] },
                                1000 * 60 * 60
                            ]
                        },
                        proposalCount: 1
                    }
                }
            ]);

            // Freelancer quality metrics
            const freelancerMetrics = await Proposal.aggregate([
                { $match: { clientId } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'freelancerId',
                        foreignField: '_id',
                        as: 'freelancer'
                    }
                },
                { $unwind: '$freelancer' },
                {
                    $group: {
                        _id: '$freelancerId',
                        freelancerName: { $first: '$freelancer.name' },
                        proposalCount: { $sum: 1 },
                        acceptanceRate: {
                            $avg: {
                                $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0]
                            }
                        },
                        avgRating: { $first: '$freelancer.rating' },
                        totalValue: { $sum: '$proposalDetails.totalAmount' }
                    }
                },
                { $sort: { proposalCount: -1 } },
                { $limit: 10 }
            ]);

            // Proposal quality score (based on freelancer rating and proposal amount)
            const proposalQuality = await Proposal.aggregate([
                { $match: { clientId } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'freelancerId',
                        foreignField: '_id',
                        as: 'freelancer'
                    }
                },
                { $unwind: '$freelancer' },
                {
                    $project: {
                        projectId: 1,
                        freelancerName: '$freelancer.name',
                        freelancerRating: '$freelancer.rating',
                        proposalAmount: '$proposalDetails.totalAmount',
                        status: 1,
                        qualityScore: {
                            $multiply: [
                                '$freelancer.rating',
                                { $divide: ['$proposalDetails.totalAmount', 1000] }
                            ]
                        }
                    }
                },
                { $sort: { qualityScore: -1 } },
                { $limit: 15 }
            ]);

            res.json({
                success: true,
                proposals: {
                    conversion: proposalConversion,
                    responseTimes: responseTimeAnalysis,
                    freelancerMetrics,
                    qualityAnalysis: proposalQuality
                }
            });

        } catch (error) {
            console.error("Get proposal analytics error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching proposal analytics",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get project performance analytics
    getProjectPerformance: async (req, res) => {
        try {
            const clientId = req.userId;

            // Project completion rates and timelines
            const projectPerformance = await Project.aggregate([
                { $match: { clientId } },
                {
                    $project: {
                        title: 1,
                        status: 1,
                        budget: 1,
                        timeline: 1,
                        durationDays: {
                            $divide: [
                                { $subtract: ['$timeline.completedAt', '$timeline.startDate'] },
                                1000 * 60 * 60 * 24
                            ]
                        },
                        isOnTime: {
                            $cond: {
                                if: {
                                    $and: [
                                        '$timeline.completedAt',
                                        '$timeline.deadline',
                                        { $lte: ['$timeline.completedAt', '$timeline.deadline'] }
                                    ]
                                },
                                then: true,
                                else: false
                            }
                        }
                    }
                }
            ]);

            // Milestone completion analysis
            const milestonePerformance = await Project.aggregate([
                { $match: { clientId } },
                { $unwind: '$milestones' },
                {
                    $group: {
                        _id: '$milestones.status',
                        count: { $sum: 1 },
                        avgAmount: { $avg: '$milestones.amount' },
                        totalAmount: { $sum: '$milestones.amount' }
                    }
                }
            ]);

            // Freelancer performance metrics
            const freelancerPerformance = await Project.aggregate([
                { $match: { clientId } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'freelancerId',
                        foreignField: '_id',
                        as: 'freelancer'
                    }
                },
                { $unwind: '$freelancer' },
                {
                    $group: {
                        _id: '$freelancerId',
                        freelancerName: { $first: '$freelancer.name' },
                        completedProjects: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        },
                        totalProjects: { $sum: 1 },
                        totalValue: { $sum: '$budget' },
                        onTimeDelivery: {
                            $avg: {
                                $cond: {
                                    if: {
                                        $and: [
                                            '$timeline.completedAt',
                                            '$timeline.deadline',
                                            { $lte: ['$timeline.completedAt', '$timeline.deadline'] }
                                        ]
                                    },
                                    then: 1,
                                    else: 0
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        freelancerName: 1,
                        completedProjects: 1,
                        totalProjects: 1,
                        completionRate: {
                            $divide: ['$completedProjects', '$totalProjects']
                        },
                        totalValue: 1,
                        onTimeDelivery: 1
                    }
                },
                { $sort: { totalValue: -1 } }
            ]);

            res.json({
                success: true,
                performance: {
                    projectPerformance,
                    milestonePerformance,
                    freelancerPerformance
                }
            });

        } catch (error) {
            console.error("Get project performance error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching project performance",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = clientAnalyticsController;