const Job = require('../Models/Job');
const Proposal = require('../Models/Proposal');
const User = require('../Models/User')

const freelancerController = {
    getFreelancerDashboard: async (req, res) => {
        try {
            const freelancerId = req.userId;

            // get freelancer stats

            const totalProposals = await Proposal.countDocuments({ freelancerId })
            const activeProposals = await Proposal.countDocuments({
                freelancerId,
                status: "submitted"
            });

            const acceptedProposals = await Proposal.countDocuments({
                freelancerId,
                status: 'accepted'
            });

            // get available jobs(that freelancer han't applied)

            const appliedJobIds = await Proposal.find({ freelancerId }).distinct('projectId')

            const availableJobs = await Job.find({
                _id: { $nin: appliedJobIds },
                status: 'active'
            })
                .select('title description budget skillsRequired deadline createdAt')
                .limit(5);

            // get recent proposals

            const recentProposals = await Proposal.find({ freelancerId })
                .populate('projectId', 'title budget')
                .sort({ createdAt: -1 })
                .limit(5)
                .select('projectId status proposalDetails.totalAmount createdAt')

            res.json({
                quickStats: {
                    totalProposals,
                    activeProposals,
                    acceptedProposals,
                    availableJobs: availableJobs.length
                },
                availableJobs,
                recentProposals
            })
        }
        catch (error) {
            console.error('Freelancer dahboard error:', error)
            res.status(500).json({
                success: false,
                message: "Server error fetching dashboard data",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        }
    },

    // get available jobs for freelancers

    getAvailableJobs: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { page = 1, limit = 10, skills, budgetMin, budgetMax } = req.query;

            // get jobs freelancer hasn't applied to
            const appliedJobIds = await Proposal.find({ freelancerId }).distinct('projectId');

            let query = {
                _id: { $nin: appliedJobIds },
                status: 'active'
            };
            // filter by skills
            if (skills) {
                query.skillsRequired = { $in: skills.split(',') }
            }

            // filter by budget

            if (budgetMin || budgetMax) {
                query.budget = {};
                if (budgetMin) query.budget.$gte = parseInt(budgetMin);
                if (budgetMax) query.budget.$lte = parseInt(budgetMax)
            }

            const jobs = await Job.find(query)
                .populate('clientId', 'profile.name profile.company')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .select('title description budget skillsRequired deadline duration createdAt')

            const totalJobs = await Job.countDocuments(query)
            res.json({
                jobs,
                totalPages: Math.ceil(totalJobs / limit),
                currentPage: page,
                totalJobs

            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: "Server error fetching jobs",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        }
    },

    // submit a proposal
    submitProposal: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { jobId, coverLetter, totalAmount, estimatedDays } = req.body;

            const job = await Job.findById(jobId);
            if (!job) {
                return res.status(404).json({ message: "Job not found" })
            }
            // check if already applied

            const existingProposal = await Proposal.findOne({
                freelancerId,
                projectId: jobId
            });
            if (existingProposal) {
                return res.status(400).json({ message: 'You have already applied to this job' })
            }

            // create proposal
            const proposal = new Proposal({
                freelancerId,
                client: job.clientId,
                projectId: jobId,
                proposalDetails: {
                    coverLetter,
                    totalAmount: parseFloat(totalAmount),
                    estimatedDays: parseInt(estimatedDays)
                },
                status: 'submitted'
            });
            await Job.findByIdAndUpdate(jobId, { $inc: { proposalCount: 1 } });
            res.status(201).json({
                message: "Proposal submitted successfully",
                proposal
            })

        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Server error submitting proposal",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            })

        }
    },

    // get freelancer's proposals
    getMyProposals: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { freelancerId };
            if (status && status !== 'all') {
                query.status = status;
            }

            const proposals = await Proposal.find(query)
                .populate('projectId', 'title budget duration')
                .populate('clientId', 'profile.name profile.company')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)

            const totalProposals = await Proposal.countDocuments(query)

            res.json({
                proposals,
                totalPages: Math.ceil(totalProposals / limit),
                currentPage: page,
                totalProposals
            })
        } catch (error) {
            res.status(500).json({ message: 'Server error fetching proposals' })
        }
    },

    // get freelancer profile
    getFreelancerProfile: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const freelancer = await User.findById(freelancerId).select('-password')

            if (!freelancer) {
                return res.status(404).json({ message: "Freelancer not found" })
            }
            res.json(freelancer)
        } catch (error) {
            res.status(500).json({ message: "Server error fetching profile" })
        }
    },

    // update freelancer profile

    updateFreelancerProfile: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const updateData = req.body;

            // remove restricted fields
            delete updateData.password;
            delete updateData.role;
            delete updateData._id;

            const updatedFreelancer = await User.findByIdAndUpdate(
                freelancerId,
                updateData,
                { new: true, runValidators: true }
            ).select('-password')

            res.json({
                message: "Profile updated successfully",
                freelancer: updatedFreelancer
            })
        } catch (error) {
            res.status(500).json({ message: 'Server error updating profile' })
        }
    }
};

module.exports = freelancerController;