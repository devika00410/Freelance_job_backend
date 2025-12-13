const Job = require('../Models/Job');
const Proposal = require('../Models/Proposal');
const User = require('../Models/User');
const Contract = require('../Models/Contract');

// Helper functions
const calculateMonthlyEarnings = async (freelancerId) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyContracts = await Contract.find({
        freelancerId,
        status: 'completed',
        updatedAt: { $gte: startOfMonth }
    });
    
    return monthlyContracts.reduce((total, contract) => total + (contract.totalAmount || 0), 0);
};

const getFreelancerDashboardData = async (freelancerId) => {
    const proposalsSent = await Proposal.countDocuments({ freelancerId });
    const user = await User.findById(freelancerId).select('profileViews invitations');
    
    return {
        quickStats: {
            proposalsSent,
            jobsApplied: proposalsSent, // Same as proposals sent
            profileViews: user.profileViews || 0,
            invitations: user.invitations?.length || 0
        }
    };
};

const getRelativeTime = (date) => {
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

const freelancerController = {
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
    // Get recent activity
    getRecentActivity: async (req, res) => {
        try {
            const freelancerId = req.userId;
            
            // Get recent proposals activity
            const recentProposals = await Proposal.find({ freelancerId })
                .populate('projectId', 'title')
                .sort({ createdAt: -1 })
                .limit(5);
            
            // Get recent contracts
            const recentContracts = await Contract.find({ freelancerId })
                .populate('clientId', 'profile.name')
                .sort({ createdAt: -1 })
                .limit(3);

            const activities = [];
            
            // Format proposal activities
            recentProposals.forEach(proposal => {
                activities.push({
                    type: 'proposal',
                    message: `Your proposal for "${proposal.projectId?.title || 'Deleted Job'}" was ${proposal.status}`,
                    time: getRelativeTime(proposal.createdAt),
                    status: proposal.status,
                    createdAt: proposal.createdAt
                });
            });

            // Format contract activities
            recentContracts.forEach(contract => {
                activities.push({
                    type: 'contract',
                    message: `New contract with ${contract.clientId?.profile?.name || 'Client'}`,
                    time: getRelativeTime(contract.createdAt),
                    status: contract.status,
                    createdAt: contract.createdAt
                });
            });

            // Sort all activities by date (newest first)
            activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            res.json({
                success: true,
                activities: activities.slice(0, 8) // Return max 8 activities
            });
        } catch (error) {
            console.error('Recent activity error:', error);
            res.status(500).json({
                success: false,
                message: "Server error fetching recent activity",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    // Get available jobs for freelancers
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

    // Submit a proposal
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

    // Get freelancer's proposals
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

    // Get freelancer profile
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

    // Update freelancer profile
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

    // Get freelancer statistics (can be used by other functions)
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