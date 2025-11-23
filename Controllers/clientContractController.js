const Contract = require('../Models/Contract');
const Proposal = require('../Models/Proposal');
const Job = require('../Models/Job');
const Workspace = require('../Models/Workspace');


const validateContractData = (data) => {
    const errors = [];

    if (!data.proposalId) errors.push('Proposal ID is required');
    if (!data.terms || data.terms.trim().length < 10) {
        errors.push('Terms must be at least 10 characters long');
    }

    return errors;
};

const clientContractController = {
    createContract: async (req, res) => {
        try {
            const clientId = req.userId;
            const { proposalId, terms, additionalClauses } = req.body;

            console.log('=== CONTRACT CREATION START ===');
            console.log('Client ID:', clientId);
            console.log('Proposal ID:', proposalId);
            console.log('Request body:', req.body);

            // Validation
            const validationErrors = validateContractData({ proposalId, terms });
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors
                });
            }

            const proposal = await Proposal.findOne({
                _id: proposalId,
                clientId,
                status: 'accepted'
            }).populate('freelancerId', 'name email profilePicture');

            console.log('Proposal found:', !!proposal);

            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    message: "Accepted proposal not found"
                });
            }

            const job = await Job.findById(proposal.projectId);
            console.log('Job found:', !!job);

            if (!job) {
                return res.status(404).json({
                    success: false,
                    message: "Job not found"
                });
            }

            const contractData = {
                contractId: `contract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                milestoneStructure: "Phased milestone structure based on project deliverables",
                startDate: new Date(),
                projectId: proposal.projectId.toString(),
                clientId: clientId.toString(),
                freelancerId: proposal.freelancerId._id.toString(),
                serviceType: job.category,
                title: job.title,
                totalBudget: proposal.proposalDetails?.totalAmount || 10000,


                timeline: proposal.proposalDetails?.timeline || proposal.proposalDetails?.deliveryTime || '1 month',
                terms: terms || 'Standard contract terms apply',
                additionalClauses: additionalClauses || [],
                phases: [
                    {
                        phase: 1,
                        title: "Planning & Design",
                        amount: Math.round((proposal.proposalDetails?.totalAmount || 10000) * 0.2),
                        status: 'pending'
                    },
                    {
                        phase: 2,
                        title: "Development Phase 1",
                        amount: Math.round((proposal.proposalDetails?.totalAmount || 10000) * 0.3),
                        status: 'pending'
                    },
                    {
                        phase: 3,
                        title: "Development Phase 2",
                        amount: Math.round((proposal.proposalDetails?.totalAmount || 10000) * 0.3),
                        status: 'pending'
                    },
                    {
                        phase: 4,
                        title: "Testing & Delivery",
                        amount: Math.round((proposal.proposalDetails?.totalAmount || 10000) * 0.2),
                        status: 'pending'
                    }
                ],
                status: 'draft'
            };

            console.log('Contract data prepared:', contractData);

            const newContract = new Contract(contractData);
            const savedContract = await newContract.save();
            console.log('Contract saved successfully:', savedContract._id);

            await savedContract.populate('freelancerId', 'name profilePicture email');
            await savedContract.populate('projectId', 'title');

            res.status(201).json({
                success: true,
                message: "Contract created successfully",
                contract: savedContract
            });

        } catch (error) {
            console.error("=== CONTRACT CREATION ERROR ===");
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);

            if (error.name === 'ValidationError') {
                const errors = Object.values(error.errors).map(err => err.message);
                return res.status(400).json({
                    success: false,
                    message: "Contract validation failed",
                    errors: errors
                });
            }

            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: "Contract ID already exists"
                });
            }

            res.status(500).json({
                success: false,
                message: "Server error creating contract",
                error: error.message
            });
        }
    },

    getClientContracts: async (req, res) => {
        try {
            const clientId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { clientId };
            if (status && status !== 'all') {
                query.status = status;
            }

            const contracts = await Contract.find(query)
                .populate('projectId', 'title description')
                .populate('freelancerId', 'name profilePicture rating')
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

    getContractDetails: async (req, res) => {
        try {
            const clientId = req.userId;
            const { contractId } = req.params;

            console.log('Getting contract details - Client:', clientId, 'Contract:', contractId);

            // ✅ FIX: Remove ObjectId casting - use string ID directly
            const contract = await Contract.findOne({
                contractId: contractId,  // Use string ID directly, no casting
                clientId: clientId
            })
                .populate('projectId', 'title description budget category skillsRequired')
                .populate('freelancerId', 'name profilePicture rating email phone skills')
                .populate('clientId', 'name companyName email phone');

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
                message: "Server error fetching contract details",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    signContract: async (req, res) => {
        try {
            const clientId = req.userId;
            const { contractId } = req.params;

            const contract = await Contract.findOne({
                contractId: contractId,
                clientId
            });

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Contract not found"
                });
            }

            if (contract.status !== 'sent' && contract.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    message: "Contract cannot be signed in current status"
                });
            }

            contract.clientSigned = true;
            contract.clientSignedAt = new Date();

            if (contract.freelancerSigned) {
                contract.status = 'active';
                contract.startDate = new Date();

                // Create workspace when both parties sign
                // In signContract method - add workspaceId
                const workspaceData = {
                    workspaceId: `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    projectId: contract.projectId,
                    clientId: contract.clientId,
                    freelancerId: contract.freelancerId,
                    projectTitle: contract.title,
                    serviceType: contract.serviceType,
                    status: 'active',
                    currentPhase: 1,
                    overallProgress: 0
                };
                if (!workspaceData._id) {
                    workspaceData._id = `workspace_${Date.now()}`;
                }

                const newWorkspace = new Workspace(workspaceData);
                await newWorkspace.save();
            } else {
                contract.status = 'sent';
            }

            await contract.save();

            res.json({
                success: true,
                message: "Contract signed successfully",
                contract
            });
        } catch (error) {
            console.error("Sign contract error:", error);
            res.status(500).json({
                success: false,
                message: "Server error signing contract"
            });
        }
    },

    updateContract: async (req, res) => {
        try {
            const clientId = req.userId;
            const { contractId } = req.params;
            const updateData = req.body;

            const contract = await Contract.findOne({
                contractId: contractId,
                clientId,
                status: { $in: ['draft', 'sent'] }
            });

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Contract not found or cannot be updated"
                });
            }

            // Prevent updating certain fields
            delete updateData._id;
            delete updateData.clientId;
            delete updateData.freelancerId;
            delete updateData.projectId;
            delete updateData.clientSigned;
            delete updateData.freelancerSigned;
            delete updateData.status;

            const updatedContract = await Contract.findByIdAndUpdate(
                contractId,
                updateData,
                { new: true, runValidators: true }
            )
                .populate('projectId', 'title')
                .populate('freelancerId', 'name profilePicture');

            res.json({
                success: true,
                message: "Contract updated successfully",
                contract: updatedContract
            });
        } catch (error) {
            console.error("Update contract error:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating contract"
            });
        }
    },

    sendContract: async (req, res) => {
        try {
            const clientId = req.userId;
            const { contractId } = req.params;

            const contract = await Contract.findOne({
                contractId: contractId,
                clientId,
                status: 'draft'
            });

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Draft contract not found"
                });
            }

            contract.status = 'sent';
            contract.sentAt = new Date();
            await contract.save();

            res.json({
                success: true,
                message: "Contract sent to freelancer successfully",
                contract
            });
        } catch (error) {
            console.error("Send contract error:", error);
            res.status(500).json({
                success: false,
                message: "Server error sending contract"
            });
        }
    },

    cancelContract: async (req, res) => {
        try {
            const clientId = req.userId;
            const { contractId } = req.params;
            const { cancelReason } = req.body;

            const contract = await Contract.findOne({
                contractId: contractId,
                clientId,
                status: { $in: ['draft', 'sent'] }
            });

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Contract not found or cannot be cancelled"
                });
            }

            contract.status = 'cancelled';
            contract.cancelReason = cancelReason || 'Cancelled by client';
            contract.cancelledAt = new Date();
            await contract.save();

            res.json({
                success: true,
                message: "Contract cancelled successfully",
                contract
            });
        } catch (error) {
            console.error("Cancel contract error:", error);
            res.status(500).json({
                success: false,
                message: "Server error cancelling contract"
            });
        }
    },

    getContractStats: async (req, res) => {
        try {
            const clientId = req.userId;

            const stats = await Contract.aggregate([
                { $match: { clientId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalValue: { $sum: '$totalBudget' }
                    }
                }
            ]);

            const totalStats = await Contract.aggregate([
                { $match: { clientId } },
                {
                    $group: {
                        _id: null,
                        totalContracts: { $sum: 1 },
                        totalValue: { $sum: '$totalBudget' },
                        activeContracts: {
                            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                        }
                    }
                }
            ]);

            res.json({
                success: true,
                statusDistribution: stats,
                overview: totalStats[0] || {
                    totalContracts: 0,
                    totalValue: 0,
                    activeContracts: 0
                }
            });
        } catch (error) {
            console.error("Get contract stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching contract stats"
            });
        }
    }
};

module.exports = clientContractController;