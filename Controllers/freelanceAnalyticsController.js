const Proposal = require('../Models/Proposal');
const Contract = require('../Models/Contract');
const Project = require('../Models/Project');
const Rating = require('../Models/Ratings');
const analyticsController = require('./analyticsController');

const freelancerAnalyticsController = {
    // Get comprehensive freelancer analytics overview USING SHARED CONTROLLER
    getFreelancerOverview: async (req, res) => {
        try {
            const freelancerId = req.userId;

            // Use shared functions for consistent data
            const proposalStats = await analyticsController.getStatusDistribution(
                { freelancerId }, 
                Proposal,
                'status'
            );

            const projectStats = await analyticsController.getStatusDistribution(
                { freelancerId }, 
                Project,
                'status'
            );

            const contractStats = await analyticsController.getStatusDistribution(
                { freelancerId }, 
                Contract,
                'status'
            );

            // Earnings metrics using shared function
            const earningsStats = await analyticsController.getFinancialMetrics(
                { freelancerId }, 
                freelancerId, 
                'freelancer'
            );

            // Monthly earnings trends
            const monthlyEarningsTrends = await analyticsController.getMonthlyFinancialTrends(
                { freelancerId }, 
                freelancerId, 
                'freelancer',
                6
            );

            // Category distribution for projects
            const categoryDistribution = await analyticsController.getCategoryDistribution(
                { freelancerId },
                Project
            );

            // Success rates for proposals
            const proposalSuccessRates = await analyticsController.calculateSuccessRates(
                { freelancerId }
            );

            // Active projects count
            const activeProjects = await Project.countDocuments({
                freelancerId,
                status: { $in: ['active', 'in_progress'] }
            });

            // Rating statistics
            const ratingStats = await Rating.aggregate([
                { 
                    $match: { 
                        ratedUserId: freelancerId,
                        type: 'freelancer',
                        status: 'published'
                    } 
                },
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: '$overallRating' },
                        totalRatings: { $sum: 1 },
                        fiveStar: { $sum: { $cond: [{ $eq: ['$overallRating', 5] }, 1, 0] } },
                        fourStar: { $sum: { $cond: [{ $eq: ['$overallRating', 4] }, 1, 0] } }
                    }
                }
            ]);

            // Quick Stats Summary
            const totalProposals = await Proposal.countDocuments({ freelancerId });
            const acceptedProposals = await Proposal.countDocuments({ 
                freelancerId, 
                status: 'accepted' 
            });
            const totalProjects = await Project.countDocuments({ freelancerId });
            const totalEarnings = earningsStats[0]?.totalNet || 0;

            // Calculate acceptance rate
            const acceptanceRate = totalProposals > 0 ? 
                (acceptedProposals / totalProposals) * 100 : 0;

            // Calculate growth metrics
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

            // Earnings growth
            const earningsGrowthData = await analyticsController.getComparativeData(
                { freelancerId },
                Proposal,
                currentPeriod,
                previousPeriod
            );

            const earningsGrowth = await analyticsController.calculateGrowthMetrics(
                earningsGrowthData.current,
                earningsGrowthData.previous,
                'amount'
            );

            // Project growth
            const projectGrowthData = await analyticsController.getComparativeData(
                { freelancerId },
                Project,
                currentPeriod,
                previousPeriod
            );

            const projectGrowth = await analyticsController.calculateGrowthMetrics(
                projectGrowthData.current,
                projectGrowthData.previous,
                'count'
            );

            // Format data for frontend using shared formatter
            const formattedProposalStats = analyticsController.formatChartData(proposalStats, '_id', 'count');
            const formattedProjectStats = analyticsController.formatChartData(projectStats, '_id', 'count');
            const formattedCategoryDistribution = analyticsController.formatChartData(categoryDistribution, '_id', 'count');
            const formattedMonthlyEarnings = analyticsController.formatMonthlyData(monthlyEarningsTrends);

            res.json({
                success: true,
                overview: {
                    quickStats: {
                        totalProposals,
                        acceptedProposals,
                        totalProjects,
                        activeProjects,
                        totalEarnings,
                        acceptanceRate: Math.round(acceptanceRate),
                        earningsGrowth: Math.round(earningsGrowth),
                        projectGrowth: Math.round(projectGrowth),
                        avgRating: ratingStats[0]?.averageRating ? 
                            Math.round(ratingStats[0].averageRating * 10) / 10 : 0,
                        totalRatings: ratingStats[0]?.totalRatings || 0
                    },
                    distributions: {
                        proposals: formattedProposalStats,
                        projects: formattedProjectStats,
                        contracts: contractStats,
                        categories: formattedCategoryDistribution
                    },
                    earnings: earningsStats[0] || {
                        totalAmount: 0,
                        totalNet: 0,
                        totalFees: 0,
                        transactionCount: 0,
                        avgTransaction: 0,
                        largestTransaction: 0,
                        smallestTransaction: 0
                    },
                    trends: {
                        monthlyEarnings: formattedMonthlyEarnings,
                        proposalMetrics: proposalSuccessRates[0] || {
                            total: 0,
                            accepted: 0,
                            submitted: 0,
                            rejected: 0,
                            totalValue: 0,
                            avgValue: 0
                        },
                        ratingStats: ratingStats[0] || {
                            averageRating: 0,
                            totalRatings: 0,
                            fiveStar: 0,
                            fourStar: 0
                        }
                    }
                }
            });

        } catch (error) {
            console.error("Get freelancer overview error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching freelancer overview",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Other freelancer analytics methods can be similarly updated...
    getEarningsAnalytics: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { months = 12 } = req.query;

            // Use shared financial trends
            const monthlyEarnings = await analyticsController.getMonthlyFinancialTrends(
                { freelancerId }, 
                freelancerId, 
                'freelancer',
                months
            );

            // Use shared category distribution for earnings
            const earningsByCategory = await analyticsController.getTopCategories(
                { freelancerId },
                Project,
                'budget'
            );

            // Format data using shared formatters
            const formattedMonthlyEarnings = analyticsController.formatMonthlyData(monthlyEarnings);
            const formattedEarningsByCategory = analyticsController.formatChartData(earningsByCategory, '_id', 'totalValue');

            res.json({
                success: true,
                earnings: {
                    monthlyEarnings: formattedMonthlyEarnings,
                    earningsByCategory: formattedEarningsByCategory,
                    period: `${months} months`
                }
            });

        } catch (error) {
            console.error("Get earnings analytics error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching earnings analytics"
            });
        }
    },

    // Get performance metrics and ratings
    getPerformanceStats: async (req, res) => {
        try {
            const freelancerId = req.userId;

            // Rating statistics
            const ratingStats = await Rating.aggregate([
                { 
                    $match: { 
                        ratedUserId: freelancerId,
                        type: 'freelancer',
                        status: 'published'
                    } 
                },
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: '$overallRating' },
                        totalRatings: { $sum: 1 },
                        fiveStar: { $sum: { $cond: [{ $eq: ['$overallRating', 5] }, 1, 0] } },
                        fourStar: { $sum: { $cond: [{ $eq: ['$overallRating', 4] }, 1, 0] } },
                        threeStar: { $sum: { $cond: [{ $eq: ['$overallRating', 3] }, 1, 0] } },
                        twoStar: { $sum: { $cond: [{ $eq: ['$overelancerRating', 2] }, 1, 0] } },
                        oneStar: { $sum: { $cond: [{ $eq: ['$overallRating', 1] }, 1, 0] } }
                    }
                }
            ]);

            // Category ratings breakdown
            const categoryRatings = await Rating.aggregate([
                { 
                    $match: { 
                        ratedUserId: freelancerId,
                        type: 'freelancer',
                        status: 'published'
                    } 
                },
                {
                    $group: {
                        _id: null,
                        avgCommunication: { $avg: '$categoryRatings.communication' },
                        avgQuality: { $avg: '$categoryRatings.quality' },
                        avgProfessionalism: { $avg: '$categoryRatings.professionalism' },
                        avgDeadline: { $avg: '$categoryRatings.deadline' },
                        avgTechnicalSkills: { $avg: '$categoryRatings.technicalSkills' }
                    }
                }
            ]);

            // Project completion metrics
            const completionMetrics = await Project.aggregate([
                { $match: { freelancerId } },
                {
                    $group: {
                        _id: null,
                        totalProjects: { $sum: 1 },
                        completedProjects: { 
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
                        },
                        onTimeProjects: {
                            $sum: {
                                $cond: {
                                    if: {
                                        $and: [
                                            { $eq: ['$status', 'completed'] },
                                            { $lte: ['$timeline.completedAt', '$timeline.deadline'] }
                                        ]
                                    },
                                    then: 1,
                                    else: 0
                                }
                            }
                        },
                        avgCompletionTime: {
                            $avg: {
                                $divide: [
                                    { $subtract: ['$timeline.completedAt', '$timeline.startDate'] },
                                    1000 * 60 * 60 * 24 // Convert to days
                                ]
                            }
                        }
                    }
                }
            ]);

            // Milestone performance
            const milestonePerformance = await Milestone.aggregate([
                {
                    $lookup: {
                        from: 'workspaces',
                        localField: 'workspaceId',
                        foreignField: '_id',
                        as: 'workspace'
                    }
                },
                { $unwind: '$workspace' },
                {
                    $match: {
                        'workspace.freelancerId': freelancerId
                    }
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$phaseAmount' },
                        avgCompletionTime: {
                            $avg: {
                                $divide: [
                                    { $subtract: ['$timeline.actualEndDate', '$timeline.actualStartDate'] },
                                    1000 * 60 * 60 * 24
                                ]
                            }
                        }
                    }
                }
            ]);

            // Client retention metrics
            const clientRetention = await Transaction.aggregate([
                {
                    $match: {
                        toUser: freelancerId,
                        type: 'milestone_payment',
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: '$fromUser',
                        transactionCount: { $sum: 1 },
                        totalEarnings: { $sum: '$netAmount' },
                        firstTransaction: { $min: '$createdAt' },
                        lastTransaction: { $max: '$createdAt' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalClients: { $sum: 1 },
                        repeatClients: {
                            $sum: { $cond: [{ $gt: ['$transactionCount', 1] }, 1, 0] }
                        },
                        avgProjectsPerClient: { $avg: '$transactionCount' }
                    }
                }
            ]);

            res.json({
                success: true,
                performance: {
                    ratingStats: ratingStats[0] || {
                        averageRating: 0,
                        totalRatings: 0,
                        fiveStar: 0,
                        fourStar: 0,
                        threeStar: 0,
                        twoStar: 0,
                        oneStar: 0
                    },
                    categoryRatings: categoryRatings[0] || {
                        avgCommunication: 0,
                        avgQuality: 0,
                        avgProfessionalism: 0,
                        avgDeadline: 0,
                        avgTechnicalSkills: 0
                    },
                    completionMetrics: completionMetrics[0] || {
                        totalProjects: 0,
                        completedProjects: 0,
                        onTimeProjects: 0,
                        avgCompletionTime: 0
                    },
                    milestonePerformance,
                    clientRetention: clientRetention[0] || {
                        totalClients: 0,
                        repeatClients: 0,
                        avgProjectsPerClient: 0
                    }
                }
            });

        } catch (error) {
            console.error("Get performance stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching performance stats",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get project and proposal analytics
    getProjectStats: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { months = 6 } = req.query;

            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - parseInt(months));

            // Proposal trends over time
            const proposalTrends = await Proposal.aggregate([
                {
                    $match: {
                        freelancerId,
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        proposalsSubmitted: { $sum: 1 },
                        proposalsAccepted: {
                            $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
                        },
                        totalProposalValue: { $sum: '$proposalDetails.totalAmount' }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]);

            // Proposal success rate by category
            const successRateByCategory = await Proposal.aggregate([
                {
                    $match: {
                        freelancerId,
                        createdAt: { $gte: startDate }
                    }
                },
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
                    $group: {
                        _id: '$job.category',
                        totalProposals: { $sum: 1 },
                        acceptedProposals: {
                            $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
                        },
                        totalValue: { $sum: '$proposalDetails.totalAmount' },
                        avgProposalAmount: { $avg: '$proposalDetails.totalAmount' }
                    }
                },
                {
                    $project: {
                        category: '$_id',
                        totalProposals: 1,
                        acceptedProposals: 1,
                        successRate: {
                            $multiply: [
                                { $divide: ['$acceptedProposals', '$totalProposals'] },
                                100
                            ]
                        },
                        totalValue: 1,
                        avgProposalAmount: 1
                    }
                },
                { $sort: { successRate: -1 } }
            ]);

            // Project duration analysis
            const projectDuration = await Project.aggregate([
                {
                    $match: {
                        freelancerId,
                        status: 'completed',
                        'timeline.startDate': { $exists: true },
                        'timeline.completedAt': { $exists: true }
                    }
                },
                {
                    $project: {
                        title: 1,
                        budget: 1,
                        category: 1,
                        durationDays: {
                            $divide: [
                                { $subtract: ['$timeline.completedAt', '$timeline.startDate'] },
                                1000 * 60 * 60 * 24
                            ]
                        },
                        estimatedDuration: {
                            $arrayElemAt: [
                                {
                                    $split: ['$duration', ' ']
                                },
                                0
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: '$category',
                        avgActualDuration: { $avg: '$durationDays' },
                        avgEstimatedDuration: { $avg: { $toDouble: '$estimatedDuration' } },
                        projectCount: { $sum: 1 },
                        efficiencyRatio: {
                            $avg: {
                                $divide: [
                                    { $toDouble: '$estimatedDuration' },
                                    '$durationDays'
                                ]
                            }
                        }
                    }
                }
            ]);

            // Skills performance analysis
            const skillsPerformance = await Proposal.aggregate([
                {
                    $match: {
                        freelancerId,
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $lookup: {
                        from: 'jobs',
                        localField: 'projectId',
                        foreignField: '_id',
                        as: 'job'
                    }
                },
                { $unwind: '$job' },
                { $unwind: '$job.skillsRequired' },
                {
                    $group: {
                        _id: '$job.skillsRequired',
                        proposalCount: { $sum: 1 },
                        acceptanceCount: {
                            $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
                        },
                        totalEarnings: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'accepted'] },
                                    '$proposalDetails.totalAmount',
                                    0
                                ]
                            }
                        },
                        avgEarnings: {
                            $avg: {
                                $cond: [
                                    { $eq: ['$status', 'accepted'] },
                                    '$proposalDetails.totalAmount',
                                    null
                                ]
                            }
                        }
                    }
                },
                {
                    $project: {
                        skill: '$_id',
                        proposalCount: 1,
                        acceptanceCount: 1,
                        acceptanceRate: {
                            $multiply: [
                                { $divide: ['$acceptanceCount', '$proposalCount'] },
                                100
                            ]
                        },
                        totalEarnings: 1,
                        avgEarnings: 1
                    }
                },
                { $sort: { totalEarnings: -1 } },
                { $limit: 15 }
            ]);

            res.json({
                success: true,
                projects: {
                    proposalTrends,
                    successRateByCategory,
                    projectDuration,
                    skillsPerformance,
                    period: `${months} months`
                }
            });

        } catch (error) {
            console.error("Get project stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching project statistics",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = freelancerAnalyticsController;