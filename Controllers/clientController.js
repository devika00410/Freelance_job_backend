const User = require('../Models/User')
const Job = require('../Models/Job')
const Proposal = require('../Models/Proposal')
const Chat = require('../Models/Chat')

const clientController = {
    getClientDashboard: async (req, res) => {
        try {
            const clientId = req.userId;

            const totalJobs = await Job.countDocuments({ clientId })
            const activeJobs = await Job.countDocuments({ clientId, status: 'active' })
            const totalProposals = await Proposal.countDocuments({ clientId })
            const pendingProposals = await Proposal.countDocuments({
                clientId,
                status: 'submitted'
            });

            const activeChats = 0
            // calculate total spent
            const completedJobs = await Job.find({
                clientId,
                status: 'completed',
                hiredFreelancer: { $exists: true }

            });
            const totalSpent = completedJobs.reduce((sum, job) => sum + job.budget, 0)

            // get recent jobs
            const recentJobs = await Job.find({ clientId })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('title status budget createdAt proposalCount hiringStatus')

            // get recent proposals with freelancer info
            const recentProposals = await Proposal.find({ clientId })
                .populate('freelancerId', 'name profilePicture rating')
                .populate('projectId', 'title')
                .sort({ createdAt: -1 })
                .limit(5)
                .select('projectId freelancerId status proposalDetails.totalAmount createdAt')

            // Format recent activity

            const recentActivity = [
                ...recentJobs.map(job => ({
                    type: 'job',
                    message: `Job "${job.title}" ${job.status === 'draft' ? 'drafted' : "published"}`,
                    time: job.createdAt,
                    status: job.status
                })),
                ...recentProposals.map(proposal => ({
                    type: 'proposal',
                    message: `New proposal from ${proposal.freelancerId.name} for "${proposal.projectId.title}"`,
                    time: proposal.createdAt,
                    status: proposal.status
                }))

            ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8)

            res.json({
                quickStats: {
                    totalJobs,
                    activeJobs,
                    totalProposals,
                    pendingProposals,
                    activeChats,
                    totalSpent
                },
                recentActivity,
                recentJobs,
                recentProposals
            })
        } catch (error) {
            console.error('Dashboard error:', error)
            res.status(500).json({ message: 'Server error fetching dashboard data' })
        }

    },
    // Get client Profile

    getClientProfile: async (req, res) => {
        try {
            const clientId = req.userId;
            const client = await User.findById(clientId)
                .select('-password');

            if (!client) {
                return res.status(404).json({ message: "Client not found" })
            }
            res.json(client);
        } catch (error) {
            res.status(500).json({ message: "Server error fetching profile" })
        }
    },

    // Updatw client profile
    updateClientProfile: async (req, res) => {
        try {
            const clientId = req.userId;
            const updateData = req.body

            delete updateData.password;
            delete updateData.role;
            delete updateData._id;

            const updateClient = await User.findByIdAndUpdate(
                clientId,
                updateData,
                { new: true, runValidators: true }
            ).select('-password')

            res.json({
                message: 'Profile updated successfully',
                client: updateClient
            })
        } catch (error) {
            res.status(500).json({ message: 'Server error updating profile' })
        }
    },
    // Get client's job

    getClientJobs: async (req, res) => {
        try {
            const clientId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { clientId };
            if (status && status !== 'all') {
                query.status = status
            }
            const jobs = await Job.find(query)
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .select('title status budget proposalCount hiringStatus deadline')

            const totalJobs = await Job.countDocuments(query)

            res.json({
                jobs,
                totalPages: Math.ceil(totalJobs / limit),
                currentPage: page,
                totalJobs
            })
        } catch (error) {
            res.status(500).json({ message: 'Server error fetching jobs' })
        }
    },

    // Get clients proposal

    getClientProposals: async (req, res) => {
        try {
            const clientId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { clientId };
            if (status && status !== 'all') {
                query.status = status;
            }

            const proposals = await Proposal.find(query)
                .populate('freelancerId', 'name profilePicture rating skills')
                .populate('projectId', 'title budget duration')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalProposals = await Proposal.countDocuments(query);
            res.json({
                proposals,
                totalPages: Math.ceil(totalProposals / limit),
                currentPage: page,
                totalProposals
            });
        } catch (error) {
            res.status(500).json({ message: 'Server error fetching proposals' });
        }
    },

    // get proposal details
    getProposalDetails: async (req, res) => {
        try {
            const clientId = req.userId;
            const { proposalId } = req.params
            const proposal = await Proposal.findOne({ _id: proposalId, clientId })
                .populate('freelancerId', 'name profilePicture rating skills bio completedProjects')
                .populate('projectId', 'title description budget skillsRequired')

            if (!proposal) {
                return res.status(404).json({ message: 'Proposal not found' })
            }
            res.json(proposal)
        } catch (error) {
            res.status(500).json({ message: 'Server error fetching proposal details' })
        }
    },
    // Accept proposal

    acceptProposal: async (req, res) => {
        try {
            const clientId = req.userId;
            const { proposalId } = req.params;

            const proposal = await Proposal.findOne({ _id: proposalId, clientId })

            if (!proposal) {
                return res.status(400).json({ message: 'Proposal cannot be accepted' })
            }

            // update proposal status

            proposal.status = 'accepted';
            proposal.isHired = true;
            proposal.hiredAt = new Date()
            await proposal.save();

            //update job to mark as hired
            await Job.findByIdAndUpdate(proposal.projectId, {
                hiredFreelancer: proposal.freelancerId,
                hiringStatus: 'hired',
                status: 'active'
            });

            // Reject all other proposals for this job

            await Proposal.updateMany(
                {
                    projectId: Proposal.projectId,
                    _id: { $ne: proposalId },
                    status: 'submitted'
                },
                { status: 'rejected', rejectionReason: 'Another freelancer was selected' }
            );
            res.json({ message: 'Proposal accepted successfully', proposal })
        } catch (error) {
            res.status(500).json({ message: 'Server error accepting proposal' })
        }
    },

    // Reject proposal

    rejectProposal: async (req, res) => {
        try {
            const clientId = req.userId;
            const { proposalId } = req.params;
            const { rejectionReason } = req.body;

            const proposal = await Proposal.findOne({ _id: proposalId, clientId });
            if (!proposal) {
                return res.status(404).json({ message: 'Proposal not found' })
            }

            proposal.status = 'rejected';
            proposal.rejectionReason = rejectionReason || 'Not selected';
            await proposal.save();

            res.json({ message: 'Proposal rejected successfully' })
        } catch (error) {
            res.status(500).json({ message: 'Server error rejecting proposal' })
        }
    },
 getClientDashboard: async (req, res) => {
    try {
        console.log('1. Starting dashboard function');
        const clientId = req.userId;
        console.log('2. Client ID:', clientId);

        // Test basic database connection first
        console.log('3. Testing User model...');
        const userExists = await User.findById(clientId);
        console.log('4. User found:', !!userExists);

        console.log('5. Testing Job model...');
        const totalJobs = await Job.countDocuments({ clientId });
        console.log('6. Total jobs:', totalJobs);

        console.log('7. Testing Proposal model...');
        const totalProposals = await Proposal.countDocuments({ clientId });
        console.log('8. Total proposals:', totalProposals);

        // If we get here, return simple response
        res.json({
            success: true,
            message: 'Dashboard working',
            stats: {
                totalJobs,
                totalProposals
            }
        });

    } catch (error) {
        console.error('🚨 Dashboard ERROR:', error);
        res.status(500).json({ 
            message: 'Dashboard error',
            error: error.message 
        });
    }
},
    // Get client analytics

    getClientAnalytics: async (req, res) => {
        try {
            const clientId = req.userId;

            // Job status distribution
            const jobStats = await Job.aggregate([
                { $match: { clientId } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);
            // proposal status
            const proposalStats = await Proposal.aggregate([
                { $match: { clientId } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);

            // Monthly job posts

            const monthlyJobs = await Job.aggregate([
                { $match: { clientId } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                { $limit: 6 }
            ]);
            res.json({
                jobStats, proposalStats, monthlyJobs
            })
        } catch (error) {
            res.status(500).json({ message: 'Server error fetching analytics' })
        }
    },

    // verify mobile

    verifyMobile: async (req, res) => {
        try {
            const clientId = req.userId;
            const { mobileNumber } = req.body

            const updatedClient = await User.findByIdAndUpdate(
                clientId,
                {
                    mobileNumber,
                    isMobileVerified: true
                },
                { new: true }
            ).select('-password');
            res.json({
                message: 'Mobile number verified successfully',
                client: updatedClient
            });
        } catch (error) {
            res.status(500).json({ message: 'Server error verifying mobile' })
        }
    },
   
    createJob: async (req, res) => {
        res.status(501).json({ message: 'Not implemented yet' });
    },
    
    getClientJobStats: async (req, res) => {
        res.status(501).json({ message: 'Not implemented yet' });
    },
    
    updateJob: async (req, res) => {
        res.status(501).json({ message: 'Not implemented yet' });
    },
    
    deleteJob: async (req, res) => {
        res.status(501).json({ message: 'Not implemented yet' });
    },
    
    updateJobStatus: async (req, res) => {
        res.status(501).json({ message: 'Not implemented yet' });
    },
    
    closeJob: async (req, res) => {
        res.status(501).json({ message: 'Not implemented yet' });
    },
    
    getJobProposals: async (req, res) => {
        res.status(501).json({ message: 'Not implemented yet' });
    }
};




module.exports = clientController;