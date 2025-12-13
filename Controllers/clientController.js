const User = require('../Models/User')
const Job = require('../Models/Job')
const Proposal = require('../Models/Proposal')
const Message = require('../Models/Message')

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
            }).lean();

            const totalSpent = (completedJobs || []).reduce((sum, job) => {
                return sum + (job.budget || 0);
            }, 0);


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
            const { proposalId } = req.params;
            const clientId = req.userId;

            console.log('=== ACCEPT PROPOSAL ===');
            console.log('1. Proposal ID:', proposalId);
            console.log('2. Client ID from token:', clientId);
            console.log('3. Client ID type:', typeof clientId);
            console.log('4. Full request params:', req.params);
            console.log('5. Full request body:', req.body);

            // Find the proposal by string _id
            console.log('6. Finding proposal in database...');
            const proposal = await Proposal.findOne({ _id: proposalId });
            console.log('7. Proposal found:', !!proposal);

            if (!proposal) {
                console.log('❌ ERROR: Proposal not found in database');
                return res.status(404).json({
                    success: false,
                    message: "Proposal not found"
                });
            }

            console.log('8. Proposal details:', {
                id: proposal._id,
                clientId: proposal.clientId,
                clientIdType: typeof proposal.clientId,
                status: proposal.status,
                freelancerId: proposal.freelancerId,
                projectId: proposal.projectId
            });

            console.log('9. Checking client authorization...');
            // CRITICAL FIX: Convert both to string for comparison
            const proposalClientId = proposal.clientId.toString();
            const requestClientId = clientId.toString();

            console.log('10. Comparing IDs:', {
                proposalClientId,
                requestClientId,
                equal: proposalClientId === requestClientId,
                proposalClientIdType: typeof proposalClientId,
                requestClientIdType: typeof requestClientId
            });

            // Check if proposal belongs to this client
            if (proposalClientId !== requestClientId) {
                console.log('❌ CLIENT ID MISMATCH!');
                return res.status(403).json({
                    success: false,
                    message: "Not authorized to accept this proposal. You are not the client who received this proposal.",
                    debug: {
                        proposalClientId,
                        requestClientId
                    }
                });
            }

            // Check if proposal is already accepted
            if (proposal.status === 'accepted') {
                console.log('❌ Proposal already accepted');
                return res.status(400).json({
                    success: false,
                    message: "Proposal already accepted"
                });
            }

            console.log('11. Updating proposal status to "accepted"...');
            // Update proposal status
            proposal.status = 'accepted';
            proposal.acceptedAt = new Date();

            console.log('12. Populating freelancer and project info...');
            try {
                // Populate freelancer info before saving
                await proposal.populate('freelancerId', 'name email profile');
                await proposal.populate('projectId', 'title category description');
            } catch (populateError) {
                console.log('⚠️ Warning: Error during population:', populateError.message);
                // Continue even if population fails
            }

            console.log('13. Saving proposal...');
            await proposal.save();

            console.log('✅ Proposal accepted successfully');

            // Prepare response data
            const responseData = {
                success: true,
                message: "Proposal accepted successfully",
                proposal: {
                    _id: proposal._id,
                    status: proposal.status,
                    freelancerId: proposal.freelancerId?._id || proposal.freelancerId,
                    freelancerName: proposal.freelancerId?.name ||
                        proposal.freelancerId?.profile?.name ||
                        'Freelancer',
                    projectId: proposal.projectId?._id || proposal.projectId,
                    projectTitle: proposal.projectId?.title || 'Project',
                    clientId: proposal.clientId,
                    proposalDetails: proposal.proposalDetails,
                    acceptedAt: proposal.acceptedAt
                }
            };

            console.log('14. Sending response:', responseData);

            res.json(responseData);

        } catch (error) {
            console.error("❌ ACCEPT PROPOSAL ERROR:", error);
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            console.error("Full error stack:", error.stack);

            res.status(500).json({
                success: false,
                message: "Server error accepting proposal",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },
    // Add this function to clientController.js
    rejectProposal: async (req, res) => {
        try {
            const { proposalId } = req.params;
            const clientId = req.userId;
            const { rejectionReason } = req.body;

            console.log('=== REJECT PROPOSAL ===');
            console.log('Proposal ID:', proposalId);
            console.log('Client ID:', clientId);

            // Find the proposal by string _id
            const proposal = await Proposal.findOne({ _id: proposalId });
            console.log('Proposal found:', !!proposal);

            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    message: "Proposal not found"
                });
            }

            // Check if proposal belongs to this client
            const proposalClientId = proposal.clientId.toString();
            const requestClientId = clientId.toString();

            if (proposalClientId !== requestClientId) {
                console.log('❌ CLIENT ID MISMATCH!');
                return res.status(403).json({
                    success: false,
                    message: "Not authorized to reject this proposal"
                });
            }

            // Check if proposal is already accepted or rejected
            if (proposal.status === 'accepted') {
                return res.status(400).json({
                    success: false,
                    message: "Cannot reject an already accepted proposal"
                });
            }

            if (proposal.status === 'rejected') {
                return res.status(400).json({
                    success: false,
                    message: "Proposal already rejected"
                });
            }

            // Update proposal status
            proposal.status = 'rejected';
            proposal.rejectionReason = rejectionReason || 'No reason provided';
            proposal.rejectedAt = new Date();

            await proposal.save();

            console.log('✅ Proposal rejected successfully');

            res.json({
                success: true,
                message: "Proposal rejected successfully",
                proposal: {
                    _id: proposal._id,
                    status: proposal.status,
                    rejectionReason: proposal.rejectionReason,
                    rejectedAt: proposal.rejectedAt
                }
            });

        } catch (error) {
            console.error("Reject proposal error:", error);
            res.status(500).json({
                success: false,
                message: "Server error rejecting proposal"
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
            res.status(500).json({
                success: false,
                message: 'Server error fetching analytics',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
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
        try {
            console.log('🎯 CREATEJOB STARTED!')
            console.log('Request body:', req.body)
            console.log('User ID:', req.userId)

            // Check if Job model is loaded
            console.log('Job model available:', !!Job)
            if (!Job) {
                throw new Error('Job model is not loaded!')
            }

            // Extract data
            const { title, description, budget, category } = req.body
            console.log('Extracted data:', { title, description, budget, category })

            // Create SIMPLE job data with ONLY required fields
            const jobData = {
                title: title,
                description: description,
                budget: Number(budget),
                category: category,
                clientId: req.userId,
                status: 'active'
                // REMOVE all other fields temporarily
            }

            console.log('Job data:', jobData)
            console.log('About to create Job instance...')

            const job = new Job(jobData)
            console.log('Job instance created')

            console.log('About to save job...')
            const savedJob = await job.save()
            console.log('✅ JOB SAVED SUCCESSFULLY:', savedJob._id)

            res.json({
                success: true,
                message: 'Job created successfully!',
                data: savedJob
            })

        } catch (error) {
            console.error('💥 CREATEJOB REAL ERROR:', error.message)
            console.error('💥 ERROR NAME:', error.name)
            console.error('💥 FULL ERROR:', error)

            // TEMPORARILY return the actual error
            res.status(500).json({
                success: false,
                message: 'Server error creating job',
                realError: error.message,  // This will show the actual error
                errorName: error.name,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        }
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