const Job = require('../Models/Job');
const Proposal = require('../Models/Proposal');
const User = require('../Models/User');
const Contract = require('../Models/Contract');
const Workspace = require('../Models/Workspace');
const Transaction = require('../Models/Transaction');
const Notification = require('../Models/Notification');

// Helper functions
const calculateMonthlyEarnings = async (freelancerId) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyTransactions = await Transaction.find({
        toUser: freelancerId,
        type: 'payment',
        status: 'completed',
        createdAt: { $gte: startOfMonth }
    });
    
    return monthlyTransactions.reduce((total, transaction) => total + (transaction.amount || 0), 0);
};

const getFreelancerDashboardData = async (freelancerId) => {
    const proposalsSent = await Proposal.countDocuments({ freelancerId });
    const user = await User.findById(freelancerId).select('profileViews invitations');
    
    return {
        quickStats: {
            proposalsSent,
            jobsApplied: proposalsSent,
            profileViews: user?.profileViews || 0,
            invitations: user?.invitations?.length || 0
        }
    };
};

const getRelativeTime = (date) => {
    if (!date) return 'recently';
    
    const diff = Date.now() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
};

const calculateFreelancerScore = (acceptedProposals, completedProjects, rating) => {
    const proposalScore = Math.min(acceptedProposals * 2, 30);
    const projectScore = Math.min(completedProjects * 5, 50);
    const ratingScore = (rating / 5) * 20;
    
    return Math.round(proposalScore + projectScore + ratingScore);
};

const freelancerController = {
    // ============= REAL-TIME DASHBOARD METHODS =============
    
    // Get dashboard stats with real data
    getDashboardStats: async (req, res) => {
        try {
            console.log('🚀 Fetching real-time dashboard stats for freelancer:', req.user.id);
            
            const freelancerId = req.user.id;
            
            // Get all stats in parallel
            const [
                activeProjects,
                totalEarnings,
                monthlyEarnings,
                totalProposals,
                activeProposals,
                acceptedProposals,
                completedProjects,
                rating,
                userSkills,
                recentNotifications,
                successRate,
                onTimeDelivery
            ] = await Promise.all([
                // Active projects
                Contract.countDocuments({ 
                    freelancerId, 
                    status: { $in: ['active', 'in_progress'] } 
                }),
                
                // Total earnings
                Transaction.aggregate([
                    { 
                        $match: { 
                            toUser: freelancerId, 
                            type: 'payment',
                            status: 'completed' 
                        } 
                    },
                    { 
                        $group: { 
                            _id: null, 
                            total: { $sum: '$amount' } 
                        } 
                    }
                ]),
                
                // Monthly earnings
                calculateMonthlyEarnings(freelancerId),
                
                // Total proposals
                Proposal.countDocuments({ freelancerId }),
                
                // Active proposals
                Proposal.countDocuments({ 
                    freelancerId, 
                    status: { $in: ['submitted', 'reviewed'] } 
                }),
                
                // Accepted proposals
                Proposal.countDocuments({ 
                    freelancerId, 
                    status: 'accepted' 
                }),
                
                // Completed projects
                Contract.countDocuments({ 
                    freelancerId, 
                    status: 'completed' 
                }),
                
                // Get rating
                User.findById(freelancerId).select('rating'),
                
                // Get user skills
                User.findById(freelancerId).select('skills'),
                
                // Recent notifications count
                Notification.countDocuments({
                    userId: freelancerId,
                    userType: 'freelancer',
                    isRead: false,
                    createdAt: { 
                        $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
                    }
                }),
                
                // Success rate calculation
                Contract.aggregate([
                    {
                        $match: {
                            freelancerId,
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            successful: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$completionStatus", "successful"] },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ]),
                
                // On-time delivery calculation
                Contract.aggregate([
                    {
                        $match: {
                            freelancerId,
                            status: 'completed',
                            endDate: { $exists: true, $ne: null },
                            completedAt: { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            onTime: {
                                $sum: {
                                    $cond: [
                                        { $lte: ["$completedAt", "$endDate"] },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ])
            ]);

            // Calculate success rate
            let calculatedSuccessRate = 85; // Default
            if (successRate[0] && successRate[0].total > 0) {
                calculatedSuccessRate = Math.round((successRate[0].successful / successRate[0].total) * 100);
            }

            // Calculate on-time delivery
            let calculatedOnTimeDelivery = 90; // Default
            if (onTimeDelivery[0] && onTimeDelivery[0].total > 0) {
                calculatedOnTimeDelivery = Math.round((onTimeDelivery[0].onTime / onTimeDelivery[0].total) * 100);
            }

            // Calculate freelancer score
            const freelancerScore = calculateFreelancerScore(
                acceptedProposals,
                completedProjects,
                rating?.rating || 4.5
            );

            // Get user data
            const userData = await User.findById(freelancerId)
                .select('name email profile role')
                .lean();

            res.json({
                success: true,
                stats: {
                    monthlyEarnings,
                    activeProjects,
                    freelancerScore,
                    rating: rating?.rating || 4.5,
                    totalEarnings: totalEarnings[0]?.total || 0,
                    successRate: calculatedSuccessRate,
                    onTimeDelivery: calculatedOnTimeDelivery,
                    totalProposals,
                    activeProposals,
                    acceptedProposals,
                    completedProjects,
                    recentNotifications,
                    userSkills: userSkills?.skills || []
                },
                user: {
                    name: userData?.profile?.name || userData?.name || 'Freelancer',
                    email: userData?.email,
                    role: userData?.role,
                    profilePicture: userData?.profile?.picture
                }
            });

        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            res.status(500).json({
                success: false,
                message: "Server error fetching dashboard stats",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get real activities (notifications)
    getActivities: async (req, res) => {
        try {
            const freelancerId = req.user.id;
            
            const activities = await Notification.find({
                userId: freelancerId,
                userType: 'freelancer'
            })
            .sort({ createdAt: -1 })
            .limit(20)
            .select('type title message data createdAt isRead priority');

            // Format activities for frontend
            const formattedActivities = activities.map(activity => {
                const timeAgo = getRelativeTime(activity.createdAt);
                let type = 'system';
                
                // Map notification types to activity types
                switch(activity.type) {
                    case 'proposal_submitted':
                    case 'proposal_accepted':
                    case 'proposal_rejected':
                        type = 'proposal';
                        break;
                    case 'contract_sent':
                    case 'contract_accepted':
                    case 'contract_completed':
                        type = 'contract';
                        break;
                    case 'payment_received':
                        type = 'payment';
                        break;
                    case 'milestone_submitted':
                    case 'milestone_approved':
                        type = 'milestone';
                        break;
                    case 'message_received':
                        type = 'message';
                        break;
                    case 'workspace_created':
                    case 'workspace_updated':
                        type = 'workspace';
                        break;
                    default:
                        type = 'system';
                }
                
                return {
                    _id: activity._id,
                    type: type,
                    message: activity.message,
                    time: timeAgo,
                    status: activity.isRead ? 'read' : 'unread',
                    priority: activity.priority,
                    data: activity.data,
                    createdAt: activity.createdAt
                };
            });

            res.json({
                success: true,
                activities: formattedActivities
            });
        } catch (error) {
            console.error('Error fetching activities:', error);
            res.status(500).json({
                success: false,
                message: "Server error fetching activities",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get latest activities (for polling)
    getLatestActivities: async (req, res) => {
        try {
            const freelancerId = req.user.id;
            const lastActivityTime = req.query.since || new Date(Date.now() - 5 * 60 * 1000);
            
            const activities = await Notification.find({
                userId: freelancerId,
                userType: 'freelancer',
                createdAt: { $gt: new Date(lastActivityTime) }
            })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('type title message data createdAt isRead');
            
            res.json({
                success: true,
                activities
            });
        } catch (error) {
            console.error('Error fetching latest activities:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    },

    // Search functionality
    search: async (req, res) => {
        try {
            const { query } = req.query;
            const freelancerId = req.user.id;
            
            if (!query || query.trim().length < 2) {
                return res.json({
                    success: true,
                    results: {
                        jobs: [],
                        clients: [],
                        messages: []
                    }
                });
            }
            
            const searchRegex = new RegExp(query, 'i');
            
            // Search jobs
            const jobs = await Job.find({
                $or: [
                    { title: searchRegex },
                    { description: searchRegex },
                    { category: searchRegex },
                    { skillsRequired: searchRegex }
                ],
                status: 'active'
            })
            .populate('clientId', 'name profile')
            .limit(5)
            .select('title description budget skillsRequired deadline');
            
            // Search clients from your contracts
            const clientIds = await Contract.distinct('clientId', { freelancerId });
            
            const clients = await User.find({
                _id: { $in: clientIds },
                $or: [
                    { name: searchRegex },
                    { email: searchRegex },
                    { 'profile.company': searchRegex }
                ]
            })
            .limit(5)
            .select('name email profile.picture profile.company');
            
            // Search messages (you'll need to implement this based on your message model)
            const messages = []; // Placeholder
            
            res.json({
                success: true,
                results: {
                    jobs,
                    clients,
                    messages
                }
            });
        } catch (error) {
            console.error('Error searching:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    },

    // Get analytics data
    getAnalytics: async (req, res) => {
        try {
            const freelancerId = req.user.id;
            const { period = 'month' } = req.query;
            
            // Calculate time range
            const now = new Date();
            let startDate;
            
            switch (period) {
                case 'day':
                    startDate = new Date(now.setDate(now.getDate() - 1));
                    break;
                case 'week':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    startDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                case 'year':
                    startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
                default:
                    startDate = new Date(now.setMonth(now.getMonth() - 1));
            }
            
            // Get earnings over time
            const earningsOverTime = await Transaction.aggregate([
                {
                    $match: {
                        toUser: freelancerId,
                        type: 'payment',
                        status: 'completed',
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                        },
                        total: { $sum: "$amount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            
            // Get proposal success rate
            const proposals = await Proposal.aggregate([
                {
                    $match: {
                        freelancerId,
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 }
                    }
                }
            ]);
            
            // Get project completion stats
            const projects = await Contract.aggregate([
                {
                    $match: {
                        freelancerId,
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                        totalBudget: { $sum: "$totalAmount" }
                    }
                }
            ]);
            
            // Get workspaces activity
            const workspaces = await Workspace.aggregate([
                {
                    $match: {
                        freelancerId,
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            
            // Get project analytics
            const projectAnalytics = await Contract.aggregate([
                {
                    $match: {
                        freelancerId
                    }
                },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                        totalBudget: { $sum: "$totalAmount" },
                        avgBudget: { $avg: "$totalAmount" },
                        minBudget: { $min: "$totalAmount" },
                        maxBudget: { $max: "$totalAmount" }
                    }
                }
            ]);
            
            // Get timeline data
            const timelineData = await Contract.aggregate([
                {
                    $match: {
                        freelancerId,
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m", date: "$updatedAt" }
                        },
                        count: { $sum: 1 },
                        totalEarnings: { $sum: "$totalAmount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            
            res.json({
                success: true,
                analytics: {
                    period,
                    earningsOverTime,
                    proposals,
                    projects,
                    workspaces,
                    projectAnalytics,
                    timelineData,
                    startDate,
                    endDate: new Date()
                }
            });
        } catch (error) {
            console.error('Error fetching analytics:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    },

    getProjectAnalytics: async (req, res) => {
        try {
            const freelancerId = req.user.id;
            
            const projectAnalytics = await Contract.aggregate([
                {
                    $match: {
                        freelancerId
                    }
                },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                        totalBudget: { $sum: "$totalAmount" },
                        avgBudget: { $avg: "$totalAmount" },
                        minBudget: { $min: "$totalAmount" },
                        maxBudget: { $max: "$totalAmount" }
                    }
                }
            ]);
            
            const timelineData = await Contract.aggregate([
                {
                    $match: {
                        freelancerId,
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m", date: "$updatedAt" }
                        },
                        count: { $sum: 1 },
                        totalEarnings: { $sum: "$totalAmount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            
            res.json({
                success: true,
                projectAnalytics,
                timelineData
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    },

    // ============= EXISTING METHODS (keep these) =============
    
    // Get freelancer dashboard data
    getFreelancerDashboard: async (req, res) => {
        try {
            const freelancerId = req.userId;

            // Get basic stats from helper function
            const dashboardData = await getFreelancerDashboardData(freelancerId);
            
            // Get freelancer profile
            const freelancer = await User.findById(freelancerId).select('-password');
            
            if (!freelancer) {
                return res.status(404).json({
                    success: false,
                    message: "Freelancer not found"
                });
            }

            // Calculate additional stats
            const monthlyEarnings = await calculateMonthlyEarnings(freelancerId);
            const activeProjects = await Contract.countDocuments({
                freelancerId,
                status: 'active'
            });

            // Calculate freelancer stats with defaults
            const freelancerStats = freelancer.freelancerStats || {};
            const totalEarnings = freelancerStats.totalEarnings || 0;
            const avgRating = freelancerStats.avgRating || 4.5;
            const successRate = freelancerStats.successRate || 85;
            const onTimeDelivery = freelancerStats.onTimeDelivery || 90;
            const creditScore = freelancer.creditScore || 75;

            res.json({
                success: true,
                monthlyEarnings,
                activeProjects,
                freelancerScore: creditScore,
                rating: avgRating,
                totalEarnings,
                successRate,
                onTimeDelivery,
                quickStats: dashboardData.quickStats,
                user: {
                    name: freelancer.profile?.name || freelancer.name,
                    email: freelancer.email,
                    role: freelancer.role,
                    profilePicture: freelancer.profile?.picture,
                    title: freelancer.profile?.title
                }
            });
        } catch (error) {
            console.error('Freelancer dashboard error:', error);
            res.status(500).json({
                success: false,
                message: "Server error fetching dashboard data",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    getPublicProfile: async (req, res) => {
        try {
            const { freelancerId } = req.params;
            
            const freelancer = await User.findById(freelancerId)
                .select('-password -emailOTP -phoneOTP -adminPermission -securityLevel')
                .populate('portfolio');
            
            if (!freelancer) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Freelancer not found' 
                });
            }
            
            res.json({
                success: true,
                profile: freelancer
            });
        } catch (error) {
            console.error('Error fetching public profile:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Server error fetching profile' 
            });
        }
    },

    createFreelancerProfile: async (req, res) => {
        try {
            const profileData = req.body;
            const freelancerId = req.userId;

            // Validate required fields
            if (!profileData.title || !profileData.skills || !profileData.bio) {
                return res.status(400).json({
                    success: false,
                    message: 'Title, skills, and bio are required'
                });
            }

            // Update user with profile data
            const updatedUser = await User.findByIdAndUpdate(
                freelancerId,
                {
                    $set: {
                        'profile.title': profileData.title,
                        'profile.bio': profileData.bio,
                        'profile.skills': Array.isArray(profileData.skills) 
                            ? profileData.skills 
                            : profileData.skills.split(',').map(skill => skill.trim()),
                        'profile.hourlyRate': profileData.hourlyRate,
                        'profile.experience': profileData.experience,
                        'profile.education': profileData.education,
                        'profile.portfolio': profileData.portfolio,
                        'profile.socialLinks': profileData.socialLinks,
                        'isProfileComplete': true
                    }
                },
                { new: true, runValidators: true }
            ).select('-password');

            res.status(201).json({
                success: true,
                message: 'Profile created successfully',
                profile: updatedUser.profile
            });

        } catch (error) {
            console.error('Error creating profile:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create profile',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    getAvailableJobs: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { page = 1, limit = 10, skills, budgetMin, budgetMax } = req.query;

            // Get jobs freelancer hasn't applied to
            const appliedJobIds = await Proposal.find({ freelancerId }).distinct('projectId');

            let query = {
                _id: { $nin: appliedJobIds },
                status: 'active'
            };

            // Filter by skills
            if (skills) {
                const skillsArray = skills.split(',').map(skill => skill.trim());
                query.skillsRequired = { $in: skillsArray };
            }

            // Filter by budget
            if (budgetMin || budgetMax) {
                query.budget = {};
                if (budgetMin) query.budget.$gte = parseFloat(budgetMin);
                if (budgetMax) query.budget.$lte = parseFloat(budgetMax);
            }

            const jobs = await Job.find(query)
                .populate('clientId', 'profile.name profile.company')
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit))
                .select('title description budget skillsRequired deadline duration createdAt clientId');

            const totalJobs = await Job.countDocuments(query);
            
            res.json({
                success: true,
                jobs,
                totalPages: Math.ceil(totalJobs / parseInt(limit)),
                currentPage: parseInt(page),
                totalJobs
            });
        } catch (error) {
            console.error('Error fetching available jobs:', error);
            res.status(500).json({
                success: false,
                message: "Server error fetching jobs",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    submitProposal: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { jobId, coverLetter, totalAmount, estimatedDays } = req.body;

            // Validate required fields
            if (!jobId || !coverLetter || !totalAmount || !estimatedDays) {
                return res.status(400).json({
                    success: false,
                    message: 'jobId, coverLetter, totalAmount, and estimatedDays are required'
                });
            }

            const job = await Job.findById(jobId);
            if (!job) {
                return res.status(404).json({
                    success: false,
                    message: "Job not found"
                });
            }

            // Check if job is still active
            if (job.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    message: 'This job is no longer accepting proposals'
                });
            }

            // Check if already applied
            const existingProposal = await Proposal.findOne({
                freelancerId,
                projectId: jobId
            });
            
            if (existingProposal) {
                return res.status(400).json({
                    success: false,
                    message: 'You have already applied to this job'
                });
            }

            // Create proposal
            const proposal = new Proposal({
                freelancerId,
                clientId: job.clientId,
                projectId: jobId,
                proposalDetails: {
                    coverLetter,
                    totalAmount: parseFloat(totalAmount),
                    estimatedDays: parseInt(estimatedDays)
                },
                status: 'submitted'
            });

            await proposal.save();

            // Increment proposal count on job
            await Job.findByIdAndUpdate(jobId, { $inc: { proposalCount: 1 } });

            res.status(201).json({
                success: true,
                message: "Proposal submitted successfully",
                proposal
            });

        } catch (error) {
            console.error('Error submitting proposal:', error);
            res.status(500).json({
                success: false,
                message: "Server error submitting proposal",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    getMyProposals: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { freelancerId };
            if (status && status !== 'all') {
                query.status = status;
            }

            const proposals = await Proposal.find(query)
                .populate('projectId', 'title budget duration status')
                .populate('clientId', 'profile.name profile.company email')
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));

            const totalProposals = await Proposal.countDocuments(query);

            res.json({
                success: true,
                proposals,
                totalPages: Math.ceil(totalProposals / parseInt(limit)),
                currentPage: parseInt(page),
                totalProposals
            });
        } catch (error) {
            console.error('Error fetching proposals:', error);
            res.status(500).json({
                success: false,
                message: 'Server error fetching proposals',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    getFreelancerProfile: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const freelancer = await User.findById(freelancerId)
                .select('-password -__v')
                .populate('contracts', 'title status totalAmount')
                .populate('reviews', 'rating comment clientId')
                .lean();

            if (!freelancer) {
                return res.status(404).json({
                    success: false,
                    message: "Freelancer not found"
                });
            }

            // Calculate additional stats
            const activeContracts = await Contract.countDocuments({
                freelancerId,
                status: 'active'
            });

            const completedContracts = await Contract.countDocuments({
                freelancerId,
                status: 'completed'
            });

            // Add stats to response
            freelancer.stats = {
                activeContracts,
                completedContracts,
                totalEarnings: freelancer.freelancerStats?.totalEarnings || 0,
                avgRating: freelancer.freelancerStats?.avgRating || 0,
                successRate: freelancer.freelancerStats?.successRate || 0
            };

            res.json({
                success: true,
                freelancer
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
            res.status(500).json({
                success: false,
                message: "Server error fetching profile",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    updateFreelancerProfile: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const updateData = req.body;

            // Get current user to check what fields are allowed to update
            const currentUser = await User.findById(freelancerId);
            if (!currentUser) {
                return res.status(404).json({
                    success: false,
                    message: "Freelancer not found"
                });
            }

            // Remove restricted fields
            delete updateData.password;
            delete updateData.role;
            delete updateData._id;
            delete updateData.email;
            delete updateData.isVerified;
            delete updateData.createdAt;

            // If updating profile field, merge with existing profile data
            if (updateData.profile) {
                updateData.profile = {
                    ...currentUser.profile.toObject(),
                    ...updateData.profile
                };
            }

            const updatedFreelancer = await User.findByIdAndUpdate(
                freelancerId,
                { $set: updateData },
                { new: true, runValidators: true }
            ).select('-password -__v');

            res.json({
                success: true,
                message: "Profile updated successfully",
                freelancer: updatedFreelancer
            });
        } catch (error) {
            console.error('Error updating profile:', error);
            res.status(500).json({
                success: false,
                message: 'Server error updating profile',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    getProfile: async (req, res) => {
        try {
            const freelancerId = req.user.id;
            
            const profile = await User.findById(freelancerId)
                .select('basicInfo professionalService skillsTools experiencePortfolio')
                .lean();
            
            if (!profile) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Profile not found' 
                });
            }
            
            res.json({
                success: true,
                profile
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    },

    getJobMatchScore: async (req, res) => {
        try {
            const { jobId } = req.params;
            const freelancerId = req.user.id;
            
            // Get job
            const job = await Job.findById(jobId)
                .select('title serviceCategory skillsRequired experienceLevel budget')
                .lean();
            
            if (!job) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Job not found' 
                });
            }
            
            // Get freelancer profile
            const freelancer = await User.findById(freelancerId)
                .select('professionalService skillsTools')
                .lean();
            
            let score = 0;
            
            // Calculate match score
            if (freelancer.professionalService?.primaryService === job.serviceCategory) {
                score += 50;
            }
            
            const freelancerSkills = freelancer.skillsTools?.skills || [];
            if (job.skillsRequired && freelancerSkills.length > 0) {
                const matchingSkills = job.skillsRequired.filter(skill => 
                    freelancerSkills.includes(skill)
                );
                const skillMatchPercentage = (matchingSkills.length / job.skillsRequired.length) * 40;
                score += skillMatchPercentage;
            }
            
            res.json({
                success: true,
                score: Math.min(Math.round(score), 100),
                job,
                freelancer
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    },

    // Get freelancer statistics
    getFreelancerStats: async (freelancerId) => {
        try {
            const proposals = await Proposal.countDocuments({ freelancerId });
            const activeContracts = await Contract.countDocuments({
                freelancerId,
                status: 'active'
            });
            const completedContracts = await Contract.countDocuments({
                freelancerId,
                status: 'completed'
            });
            
            const totalEarningsAgg = await Contract.aggregate([
                { $match: { freelancerId: freelancerId, status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]);
            
            const totalEarnings = totalEarningsAgg[0]?.total || 0;

            return {
                proposalsCount: proposals,
                activeContracts,
                completedContracts,
                totalEarnings
            };
        } catch (error) {
            console.error('Error calculating freelancer stats:', error);
            return null;
        }
    }
};

module.exports = freelancerController;