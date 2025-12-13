const Proposal = require('../Models/Proposal')
const Job = require('../Models/Job')
const User = require('../Models/User')

const proposalController = {
    // submit proposal(Freelancer)
   submitProposal: async (req, res) => {
    try {
        console.log('1. Starting submitProposal function');
        const freelancerId = req.userId;
        const proposalData = req.body;
        
        console.log('2. Freelancer ID:', freelancerId);
        console.log('3. Proposal data:', proposalData);

        // verify job exists and its accepting proposals
        console.log('4. Checking job exists:', proposalData.projectId);
        const job = await Job.findOne({
            _id: proposalData.projectId,
            status: 'active',
            hiringStatus: 'accepting_proposals',
            deadline: { $gt: new Date() }
        });

        console.log('5. Job found:', job);

        if (!job) {
            return res.status(400).json({
                message: "Job not found or not accepting proposals"
            })
        }

        // Checking if freelancer already submitted proposal
        console.log('6. Checking for existing proposals...');
        const existingProposal = await Proposal.findOne({
            projectId: proposalData.projectId,
            freelancerId: freelancerId
        });

        console.log('7. Existing proposal:', existingProposal);

        if (existingProposal) {
            return res.status(400).json({
                message: "You have already submitted a proposal for this job"
            })
        }

        // Add client and freelancer info
        proposalData.freelancerId = freelancerId;
        proposalData.clientId = job.clientId;

        // Generate custom ID if not provided
        if (!proposalData._id) {
            proposalData._id = `proposal_${Date.now()}`;
        }

        // set default status
        proposalData.status = 'submitted';

        console.log('8. Final proposal data:', proposalData);

        const newProposal = new Proposal(proposalData);
        console.log('9. Proposal model created');
        
        await newProposal.save();
        console.log('10. Proposal saved to database');

        // Increment job proposal count
        await Job.findByIdAndUpdate(proposalData.projectId, {
            $inc: { proposalCount: 1 }
        });
        console.log('11. Job proposal count updated');

        // populate for response
        await newProposal.populate('projectId', 'title budget');
        await newProposal.populate('clientId', 'name companyName');

        console.log('12. Proposal populated successfully');

        res.status(201).json({
            message: "Proposal submitted successfully",
            proposal: newProposal
        });
        
    } catch (error) {
        console.error("Submit proposal error:", error);
        res.status(500).json({ 
            message: "Server error submitting proposal",
            error: error.message 
        });
    }
},
    // Get freelancers proposal

    getFreelancerProposals: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { freelancerId };
            if (status && status !== 'all') {
                query.status = status
            }

            const proposals = await Proposal.find(query)
                .populate('projectId', 'title budget category status deadline')
                .populate('clientId', ' name companyName rating profilePicture')

                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)

            const totalProposals = await Proposal.countDocuments(query)
            res.json({
                proposals,
                totalPages: Math.ceil(totalProposals / limit),
                currentPage: page,
                totalProposals
            });

        } catch (error) {
            res.status(500).json({ message: "Server error fetching proposals" })
        }

    },

    // get proposal details

    getProposalDetails: async (req, res) => {
        try {
            const { proposalId } = req.params;
            const userId = req.userId;

            const proposal = await Proposal.findOne({ _id: proposalId })
                .populate('projectId', 'title description budget skillsRequired duration experienceLevel')
                .populate('freelancerId', 'name profilePicture rating skills bio completedProjects')
                .populate('clientId', 'name companyName rating profilePicture')

            if (!proposal) {
                return res.status(404).json({ message: "Proposal not found" });
            }
            // check access(either client or freelancer who owns the proposal)
            if (proposal.clientId._id.toString() !== userId &&
                proposal.freelancerId._id.toString() !== userId) {
                return res.status(403).json({ message: "Access denied" })
            }
            res.json(proposal)
        } catch (error) {
            res.status(500).json({ message: "Server error fetching proposal details" })
        }
    },

    // Update proposal(freelancer)
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
                return res.status(404).json({ message: "Proposal not found or access denied" })

            }

            // prevent updating certain fields and status changes
            delete updateData._id;
            delete updateData.freelancerId;
            delete updateData.clientId;
            delete updateData.projectId;
            delete updateData.status;
            delete updateData.isHired;

            // Only allow updates if proposal is till submitted/under_review
            if (!['submitted', 'under_review'].includes(proposal.status)) {
                return res.status(400).json({ message: "Cannot update proposal in current status" })
            }

            const updatedProposal = await Proposal.findByIdAndUpdate(
                proposalId,
                updateData,
                { new: true, runValidators: true }
            )
                .populate('projectId', 'title budget')
                .populate('clientId', 'name companyName')

            res.json({
                message: "Proposal updated successfully",
                proposal: updatedProposal
            })
        } catch (error) {
            res.status(500).json({ message: "Server error updating proposal" })
        }
    },

    // withdraw proposal(freelancer)
    withdrawProposal: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { proposalId } = req.params;

            const proposal = await Proposal.findOne({
                _id: proposalId,
                freelancerId
            });
            if (!proposal) {
                return res.status(404).json({ message: 'Proposal not found or access denied' })

            }

            // Only allow withdrawals if not already accpeted/rejected
            if (!['submitted', 'under_review'].includes(proposal.status)) {
                return res.status(400).json({
                    message: "Cannot withdraw proposal in current status"
                })
            };
            proposal.status = 'withdrawn';
            await proposal.save();

            // Decrement job proposal count
            await Job.findByIdAndUpdate(proposal.projectId, {
                $inc: { proposalCount: -1 }
            });
            res.json({ message: "Proposal withdrawn successfully" })
        } catch (error) {
            res.status(500).json({ message: 'Server error withdrawing proposal' })
        }
    },

  
acceptProposal: async (req, res) => {
    try {
        const { proposalId } = req.params;
        const clientId = req.userId;

        const proposal = await Proposal.findOne({
            _id: proposalId,
            clientId: clientId
        });

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: "Proposal not found"
            });
        }

        // Update proposal status to 'accepted'
        proposal.status = 'accepted';
        proposal.acceptedAt = new Date();
        
        await proposal.save();

        // Also update other proposals for the same project to 'rejected'
        await Proposal.updateMany(
            {
                projectId: proposal.projectId,
                _id: { $ne: proposalId },
                status: { $in: ['pending', 'submitted'] }
            },
            {
                status: 'rejected',
                rejectedAt: new Date()
            }
        );

        res.json({
            success: true,
            message: "Proposal accepted successfully",
            proposal
        });
    } catch (error) {
        console.error("Accept proposal error:", error);
        res.status(500).json({
            success: false,
            message: "Server error accepting proposal"
        });
    }
},
    // client:Reject proposal
    rejectProposal: async (req, res) => {
        try {
            const clientId = req.user.id;
            const { proposalId } = req.params;
            const { rejectionReason } = req.body;

            const proposal = await Proposal.findOne({
                _id: proposalId,
                clientId
            });

            if (!proposal) {
                return res.status(404).json({ message: "Proposal not found" })
            }

            proposal.status = 'rejected';
            proposal.rejectionReason = rejectionReason || 'Not selected';
            await proposal.save();

            res.json({ message: "Proposal rejected successfully" })
        }
        catch (error) {
            res.status(500).json({ message: "Server error rejecting proposal" })
        }

    },
  
getClientProposalCount: async (req, res) => {
  try {
    const clientId = req.userId;
    
    const totalProposals = await Proposal.countDocuments({ clientId });
    const pendingProposals = await Proposal.countDocuments({ 
      clientId, 
      status: 'submitted' 
    });

    res.json({
      success: true,
      count: totalProposals,
      total: totalProposals,
      pending: pendingProposals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching proposal count'
    });
  }
},

    getProposalStats: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;

            let matchQuery = {};
            if (userRole === 'freelancer') {
                matchQuery.freelancerId = userId;
            } else if (userRole === 'client') {
                matchQuery.clientId = userId
            }

            const stats = await Proposal.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$proposalDetails.totalAmount' }
                    }
                }
            ]);
            const totalStats = await Proposal.aggregate([
                { $match: matchQuery },
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
            ])

            res.json({
                statusDistribution: stats,
                overview: totalStats[0] || {
                    totalProposals: 0,
                    avgProposalAmount: 0,
                    acceptanceRate: 0
                }
            })
        } catch (error) {
            res.status(500).json({ message: 'Server error fetching proposal stats' })
        }
    }
};

module.exports = proposalController;
