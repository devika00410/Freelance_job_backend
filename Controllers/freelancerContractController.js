const Contract = require('../Models/Contract');
const Proposal = require('../Models/Proposal');
const Job = require('../Models/Job');
const User = require('../Models/User');

const freelancerContractController = {
 

// Get all contracts for freelancer
getFreelancerContracts: async (req, res) => {
    try {
        const freelancerId = req.userId;
        const { status, page = 1, limit = 10 } = req.query;

        let query = { freelancerId }; // Use freelancerId string, not ObjectId
        if (status && status !== 'all') {
            query.status = status;
        }

        const contracts = await Contract.find(query)
            .populate('projectId', 'title description category budget')
            .populate('clientId', 'name companyName profilePicture rating')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalContracts = await Contract.countDocuments(query);

        res.json({
            success: true,
            contracts,
            totalPages: Math.ceil(totalContracts / limit),
            currentPage: parseInt(page),
            totalContracts
        });

    } catch (error) {
        console.error("Get contracts error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching contracts"
        });
    }
},

// Get single contract details - FIXED
getContractDetails: async (req, res) => {
    try {
        const freelancerId = req.userId;
        const { contractId } = req.params;

        console.log('🔍 Get Contract Details:', { freelancerId, contractId });

        const contract = await Contract.findOne({
            contractId: contractId, // ✅ Use contractId field, not _id
            freelancerId
        })
        .populate('projectId', 'title description budget category skillsRequired duration')
        .populate('clientId', 'name companyName profilePicture rating email phone')
        .populate('freelancerId', 'name profilePicture rating skills email phone');

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found"
            });
        }

        res.json({
            success: true,
            contract
        });
    } catch (error) {
        console.error("Get contract details error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching contract details"
        });
    }
},

// Sign contract - FIXED
// In freelancerContractController.js - signContract function
signContract: async (req, res) => {
    try {
        const freelancerId = req.userId;
        const { contractId } = req.params;

        console.log('🔍 Sign Contract:', { freelancerId, contractId });

        const contract = await Contract.findOne({
            contractId: contractId,
            freelancerId
        });

        if (!contract) {
            console.log('❌ Contract not found with contractId:', contractId);
            return res.status(404).json({
                success: false,
                message: "Contract not found"
            });
        }

        console.log('✅ Contract found:', contract.contractId, 'Status:', contract.status);

        // ✅ FIX: Use valid statuses from your Contract model
        if (!['draft', 'pending'].includes(contract.status)) {
            return res.status(400).json({
                success: false,
                message: `Contract cannot be signed in current status: ${contract.status}. Must be 'draft' or 'pending'.`
            });
        }

        // Update contract with freelancer signature
        contract.freelancerSigned = true;
        contract.freelancerSignedAt = new Date();
        
        // If both parties have signed, update status to active
        if (contract.clientSigned && contract.freelancerSigned) {
            contract.status = 'active';
            contract.startDate = new Date();
        } else {
            // If only freelancer signed, update status to signed
            contract.status = 'signed';
        }

        await contract.save();

        res.json({
            success: true,
            message: "Contract signed successfully",
            contract: {
                contractId: contract.contractId,
                status: contract.status,
                freelancerSigned: contract.freelancerSigned,
                freelancerSignedAt: contract.freelancerSignedAt,
                clientSigned: contract.clientSigned
            }
        });
    } catch (error) {
        console.error("Sign contract error:", error);
        res.status(500).json({
            success: false,
            message: "Server error signing contract",
            error: error.message
        });
    }
},
// Request contract modifications - FIXED
requestContractChanges: async (req, res) => {
    try {
        const freelancerId = req.userId;
        const { contractId } = req.params;
        const { requestedChanges, comments } = req.body;

        const contract = await Contract.findOne({
            contractId: contractId, // ✅ Use contractId field, not _id
            freelancerId
        });

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found"
            });
        }

        if (contract.status !== 'sent') {
            return res.status(400).json({
                success: false,
                message: "Cannot request changes in current contract status"
            });
        }

        // Update contract with requested changes
        contract.status = 'changes_requested';
        contract.requestedChanges = {
            requestedBy: freelancerId,
            changes: requestedChanges,
            comments: comments,
            requestedAt: new Date()
        };

        await contract.save();

        res.json({
            success: true,
            message: "Contract changes requested successfully",
            contract
        });
    } catch (error) {
        console.error("Request contract changes error:", error);
        res.status(500).json({
            success: false,
            message: "Server error requesting contract changes"
        });
    }
},

// Decline contract - FIXED
declineContract: async (req, res) => {
    try {
        const freelancerId = req.userId;
        const { contractId } = req.params;
        const { declineReason } = req.body;

        const contract = await Contract.findOne({
            contractId: contractId, // ✅ Use contractId field, not _id
            freelancerId
        });

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found"
            });
        }

        if (contract.status !== 'sent') {
            return res.status(400).json({
                success: false,
                message: "Cannot decline contract in current status"
            });
        }

        // Update contract status to declined
        contract.status = 'declined';
        contract.declineReason = declineReason || 'No reason provided';
        contract.declinedAt = new Date();

        await contract.save();

        res.json({
            success: true,
            message: "Contract declined successfully",
            contract
        });
    } catch (error) {
        console.error("Decline contract error:", error);
        res.status(500).json({
            success: false,
            message: "Server error declining contract"
        });
    }
},
    // Get contract statistics
    getContractStats: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const stats = await Contract.aggregate([
                { $match: { freelancerId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalValue: { $sum: '$totalBudget' }
                    }
                }
            ]);

            const totalStats = await Contract.aggregate([
                { $match: { freelancerId } },
                {
                    $group: {
                        _id: null,
                        totalContracts: { $sum: 1 },
                        totalEarnings: { $sum: '$totalBudget' },
                        activeContracts: {
                            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                        },
                        completedContracts: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        }
                    }
                }
            ]);

            // Get recent contract activity
            const recentContracts = await Contract.find({ freelancerId })
                .populate('projectId', 'title')
                .populate('clientId', 'name')
                .sort({ updatedAt: -1 })
                .limit(5)
                .select('status projectId clientId updatedAt');

            res.json({
                success: true,
                statusDistribution: stats,
                overview: totalStats[0] || {
                    totalContracts: 0,
                    totalEarnings: 0,
                    activeContracts: 0,
                    completedContracts: 0
                },
                recentContracts
            });
        } catch (error) {
            console.error('Get contract stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error fetching contract stats'
            });
        }
    },

    // Get contracts needing action (unsigned, changes requested)
    getPendingActions: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const pendingContracts = await Contract.find({
                freelancerId,
                status: { $in: ['sent', 'changes_requested'] }
            })
                .populate('projectId', 'title budget')
                .populate('clientId', 'name companyName')
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                pendingContracts,
                count: pendingContracts.length
            });
        } catch (error) {
            console.error("Get pending actions error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching pending actions"
            });
        }
    }
};

module.exports = freelancerContractController;