const Proposal = require('../Models/Proposal');
const Job = require('../Models/Job');
const User = require('../Models/User');


const validateProposalData = (data) => {
    const errors = [];

    if (!data.projectId) errors.push('Project ID is required');
    if (!data.proposalDetails?.coverLetter) errors.push('Cover letter is required');
    if (!data.proposalDetails?.totalAmount || data.proposalDetails.totalAmount <= 0) {
        errors.push('Valid total amount is required');
    }
    if (!data.proposalDetails?.estimatedDays || data.proposalDetails.estimatedDays <= 0) {
        errors.push('Valid estimated days is required');
    }

    return errors;
};


const freelancerProposalController = {
    submitProposal: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const proposalData = req.body;

            const validationErrors = validateProposalData(proposalData);
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors
                });
            }

            const job = await Job.findOne({
                _id: proposalData.projectId,
                status: 'active',
                hiringStatus: 'accepting_proposals',
                deadline: { $gt: new Date() }
            });

            if (!job) {
                return res.status(400).json({
                    success: false,
                    message: "Job not found or not accepting proposals"
                });
            }

            const existingProposal = await Proposal.findOne({
                projectId: proposalData.projectId,
                freelancerId: freelancerId
            });

            if (existingProposal) {
                return res.status(400).json({
                    success: false,
                    message: "You have already submitted a proposal for this job"
                });
            }


            // Get ACTUAL user data from User model
            const User = require('../Models/User');
            const clientUser = await User.findById(job.clientId);
            const freelancerUser = await User.findById(freelancerId);

            // Prepare proposal
            proposalData.freelancerId = freelancerId;
            proposalData.clientId = job.clientId;

            // Force-set the names (don't rely on pre-save)
            proposalData.clientName = clientUser?.name || 'Client';
            proposalData.clientCompany = clientUser?.companyName || '';
            proposalData.freelancerName = freelancerUser?.name || 'Freelancer';
            proposalData.freelancerEmail = freelancerUser?.email || '';
            proposalData.freelancerPicture = freelancerUser?.profilePicture || '';

            console.log('✅ Proposal names set:', {
                clientName: proposalData.clientName,
                freelancerName: proposalData.freelancerName
            });


            if (!proposalData._id) {
                proposalData._id = `proposal_${Date.now()}`;
            }

            proposalData.status = 'submitted';
            proposalData.submittedAt = new Date();

            const newProposal = new Proposal(proposalData);
            await newProposal.save();

            await Job.findByIdAndUpdate(proposalData.projectId, {
                $inc: { proposalCount: 1 }
            });

            // Populate for response
            await newProposal.populate('projectId', 'title budget category');
            await newProposal.populate('clientId', 'name email companyName');
            await newProposal.populate('freelancerId', 'name email profilePicture rating skills');

            console.log('✅ Proposal created with correct names:');
            console.log('   Client:', newProposal.clientName);
            console.log('   Freelancer:', newProposal.freelancerName);

            res.status(201).json({
                success: true,
                message: "Proposal submitted successfully",
                proposal: newProposal
            });

        } catch (error) {
            console.error("❌ Submit proposal error:", error);
            res.status(500).json({
                success: false,
                message: "Server error submitting proposal",
                error: error.message
            });
        }
    },

    getFreelancerProposals: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { freelancerId };
            if (status && status !== 'all') {
                query.status = status;
            }

            const proposals = await Proposal.find(query)
                .populate('projectId', 'title budget category status deadline hiringStatus')
                .populate('clientId', 'name companyName rating profilePicture')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalProposals = await Proposal.countDocuments(query);

            res.json({
                success: true,
                proposals,
                totalPages: Math.ceil(totalProposals / limit),
                currentPage: parseInt(page),
                totalProposals
            });

        } catch (error) {
            console.error("Get proposals error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching proposals"
            });
        }
    },

    getProposalDetails: async (req, res) => {
        try {
            const { proposalId } = req.params;
            const freelancerId = req.userId;

            const proposal = await Proposal.findOne({
                _id: proposalId,
                freelancerId
            })
                .populate('projectId', 'title description budget skillsRequired duration experienceLevel category')
                .populate('clientId', 'name companyName rating profilePicture totalProjects companySize')
                .populate('freelancerId', 'name profilePicture rating skills bio completedProjects');

            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    message: "Proposal not found"
                });
            }

            res.json({
                success: true,
                proposal
            });
        } catch (error) {
            console.error("Get proposal details error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching proposal details"
            });
        }
    },

    updateProposal: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { proposalId } = req.params;
            const updateData = req.body;

            const proposal = await Proposal.findOne({
                _id: proposalId,
                freelancerId
            });

            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    message: "Proposal not found or access denied"
                });
            }

            if (!['submitted', 'under_review'].includes(proposal.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot update proposal in current status"
                });
            }

            delete updateData._id;
            delete updateData.freelancerId;
            delete updateData.clientId;
            delete updateData.projectId;
            delete updateData.status;
            delete updateData.isHired;

            const updatedProposal = await Proposal.findByIdAndUpdate(
                proposalId,
                updateData,
                { new: true, runValidators: true }
            )
                .populate('projectId', 'title budget')
                .populate('clientId', 'name companyName');

            res.json({
                success: true,
                message: "Proposal updated successfully",
                proposal: updatedProposal
            });
        } catch (error) {
            console.error("Update proposal error:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating proposal"
            });
        }
    },

    withdrawProposal: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { proposalId } = req.params;

            const proposal = await Proposal.findOne({
                _id: proposalId,
                freelancerId
            });

            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    message: 'Proposal not found or access denied'
                });
            }

            if (!['submitted', 'under_review'].includes(proposal.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot withdraw proposal in current status"
                });
            }

            proposal.status = 'withdrawn';
            await proposal.save();

            await Job.findByIdAndUpdate(proposal.projectId, {
                $inc: { proposalCount: -1 }
            });

            res.json({
                success: true,
                message: "Proposal withdrawn successfully"
            });
        } catch (error) {
            console.error('Withdraw proposal error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error withdrawing proposal'
            });
        }
    },

    getProposalStats: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const stats = await Proposal.aggregate([
                { $match: { freelancerId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$proposalDetails.totalAmount' }
                    }
                }
            ]);

            const totalStats = await Proposal.aggregate([
                { $match: { freelancerId } },
                {
                    $group: {
                        _id: null,
                        totalProposals: { $sum: 1 },
                        avgProposalAmount: { $avg: '$proposalDetails.totalAmount' },
                        acceptanceRate: {
                            $avg: {
                                $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0]
                            }
                        }
                    }
                }
            ]);

            const recentActivity = await Proposal.find({ freelancerId })
                .populate('projectId', 'title')
                .populate('clientId', 'name')
                .sort({ createdAt: -1 })
                .limit(5)
                .select('status createdAt projectId clientId');

            res.json({
                success: true,
                statusDistribution: stats,
                overview: totalStats[0] || {
                    totalProposals: 0,
                    avgProposalAmount: 0,
                    acceptanceRate: 0
                },
                recentActivity
            });
        } catch (error) {
            console.error('Get proposal stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error fetching proposal stats'
            });
        }
    }
};

module.exports = freelancerProposalController;