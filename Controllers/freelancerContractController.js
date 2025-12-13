const Contract = require('../Models/Contract');
const WorkspaceService = require('../Services/WorkspaceService');
const Notification = require('../Models/Notification');
const Proposal = require('../Models/Proposal');
const { notificationService } = require('../Controllers/notificationController');

const freelancerContractController = {
    // Get all contracts for freelancer
    getFreelancerContracts: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { freelancerId };
            if (status && status !== 'all') {
                query.status = status;
            }

            const contracts = await Contract.find(query)
                .populate('clientId', 'name email companyName profilePicture')
                .populate('projectId', 'title category')
                .sort({ updatedAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalContracts = await Contract.countDocuments(query);

            // Check for existing workspaces
            const contractsWithWorkspace = await Promise.all(
                contracts.map(async (contract) => {
                    const contractObj = contract.toObject();
                    // Check if workspace exists for this contract
                    if (contract.workspaceId) {
                        contractObj.hasWorkspace = true;
                        contractObj.workspaceId = contract.workspaceId;
                    } else {
                        contractObj.hasWorkspace = false;
                    }
                    return contractObj;
                })
            );

            res.json({
                success: true,
                contracts: contractsWithWorkspace,
                totalPages: Math.ceil(totalContracts / limit),
                currentPage: parseInt(page),
                totalContracts
            });

        } catch (error) {
            console.error("Get freelancer contracts error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching contracts"
            });
        }
    },

    // Get contract details
    getContractDetails: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { contractId } = req.params;

            const contract = await Contract.findOne({
                contractId,
                freelancerId
            })
                .populate('clientId', 'name email companyName profilePicture phone')
                .populate('projectId', 'title description budget category skillsRequired')
                .populate('proposalId', 'coverLetter proposalDetails estimatedTime');

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Contract not found"
                });
            }

            // Add workspace info if exists
            const contractData = contract.toObject();
            if (contract.workspaceId) {
                contractData.hasWorkspace = true;
                contractData.workspaceId = contract.workspaceId;
                contractData.workspaceAccessUrl = `/workspace/${contract.workspaceId}`;
            }

            res.json({
                success: true,
                contract: contractData
            });
        } catch (error) {
            console.error("Get contract details error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching contract details"
            });
        }
    },
// Add this function to automatically create workspace
// createWorkspaceIfNeeded: async (contract) => {
//     if (!contract.workspaceId) {
//         console.log('🔄 Creating workspace for contract:', contract._id);
        
//         try {
//             const WorkspaceService = require('../Services/WorkspaceService');
//             const workspace = await WorkspaceService.createWorkspaceFromContract(contract._id);
//             contract.workspaceId = workspace.workspaceId;
//             await contract.save();
//             console.log('✅ Workspace created:', workspace.workspaceId);
//             return workspace;
//         } catch (error) {
//             console.error('❌ Failed to create workspace:', error);
//             throw error;
//         }
//     }
//     return null;
// },

// Update the signContract function

signContract: async (req, res) => {
    try {
        const freelancerId = req.userId;
        const { contractId } = req.params;
        const { signature } = req.body;

        console.log('=== FREELANCER SIGNING CONTRACT ===', {
            contractId,
            freelancerId,
            hasSignature: !!signature
        });

        // ✅ Load models inside function to avoid circular dependencies
        const Contract = require('../Models/Contract');
        const User = require('../Models/User');
        const Notification = require('../Models/Notification');

        // ✅ FIX: Find contract using both contractId and _id
        const contract = await Contract.findOne({
            $or: [
                { contractId: contractId },
                { _id: contractId }
            ],
            freelancerId: freelancerId
        })
            .populate('clientId', 'name email companyName')
            .populate('projectId', 'title description budget');

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or unauthorized"
            });
        }

        console.log('📄 Contract found:', {
            title: contract.title,
            currentStatus: contract.status,
            clientSigned: contract.clientSigned,
            freelancerSigned: contract.freelancerSigned,
            workspaceId: contract.workspaceId
        });

        // ✅ Check if already signed
        if (contract.freelancerSigned) {
            return res.status(400).json({
                success: false,
                message: "Contract already signed by freelancer"
            });
        }

        // ✅ Validate contract status for signing
        const validStatuses = ['sent', 'pending', 'pending_freelancer', 'draft'];
        if (!validStatuses.includes(contract.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot sign contract with status: "${contract.status}"`
            });
        }

        // ✅ Update freelancer signature
        contract.freelancerSigned = true;
        contract.freelancerSignature = signature || "Digital Signature";
        contract.freelancerSignedAt = new Date();

        // ✅ Update status based on signatures
        if (contract.clientSigned) {
            // Both signed - contract becomes active
            contract.status = 'active';
            console.log('✅ Both parties have signed - contract is now ACTIVE');
        } else {
            // Only freelancer signed - waiting for client
            contract.status = 'pending_client';
            console.log('⏳ Freelancer signed, waiting for client signature');
        }

        // ✅ Auto-populate names if missing
        if (!contract.freelancerName || contract.freelancerName === 'Freelancer') {
            const freelancerUser = await User.findById(freelancerId);
            if (freelancerUser) {
                contract.freelancerName = freelancerUser.name || freelancerUser.username || 'Freelancer';
                contract.freelancerEmail = freelancerUser.email || '';
                contract.freelancerPicture = freelancerUser.profilePicture || '';
                console.log('✅ Updated freelancer name to:', contract.freelancerName);
            }
        }

        await contract.save();
        console.log('💾 Contract saved successfully');

        // ✅ CREATE WORKSPACE IF BOTH PARTIES SIGNED
        if (contract.clientSigned && contract.freelancerSigned) {
            console.log('🔄 Both parties signed - creating workspace...');
            
            try {
                const WorkspaceService = require('../Services/WorkspaceService');
                const workspace = await WorkspaceService.createWorkspaceFromContract(contract._id);
                
                // Update contract with workspace ID
                contract.workspaceId = workspace.workspaceId;
                await contract.save();
                
                console.log('✅ Workspace created:', workspace.workspaceId);
                
                // Send notification to client about workspace
                const workspaceNotification = new Notification({
                    notificationId: `notif_${Date.now()}_workspace`,
                    userId: contract.clientId._id,
                    userRole: 'client',
                    type: 'workspace_created',
                    title: 'Workspace Created',
                    message: `Workspace created for "${contract.title}". Start collaborating now!`,
                    category: 'workspace',
                    priority: 'high',
                    metadata: {
                        workspaceId: workspace.workspaceId,
                        contractId: contract.contractId,
                        freelancerName: contract.freelancerName,
                        redirectUrl: `/client/workspace/${workspace.workspaceId}`
                    },
                    actionUrl: `/client/workspace/${workspace.workspaceId}`,
                    isRead: false
                });
                await workspaceNotification.save();
                
            } catch (workspaceError) {
                console.error('❌ Workspace creation failed:', workspaceError);
                // Don't fail the signing process if workspace creation fails
                // Contract is still signed and valid
            }
        }

        // ✅ Send notification to client if freelancer signed first
        if (contract.freelancerSigned && !contract.clientSigned) {
            const notification = new Notification({
                notificationId: `notif_${Date.now()}_sign`,
                userId: contract.clientId._id,
                userRole: 'client',
                type: 'contract_signed',
                title: 'Contract Signed by Freelancer',
                message: `${contract.freelancerName} has signed the contract "${contract.title}". Your signature is now required to activate the workspace.`,
                category: 'contract',
                priority: 'high',
                metadata: {
                    contractId: contract.contractId,
                    contractTitle: contract.title,
                    freelancerName: contract.freelancerName,
                    freelancerSignedAt: contract.freelancerSignedAt,
                    requiresSignature: true,
                    redirectUrl: `/contracts/${contract.contractId}`
                },
                actionUrl: `/contracts/${contract.contractId}`,
                isRead: false,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
            await notification.save();
            console.log('📨 Notification sent to client');
        }

        // ✅ Real-time notification via socket.io
        const io = req.app.get('io');
        if (io && contract.clientId) {
            io.to(contract.clientId._id.toString()).emit('contract_signed', {
                contractId: contract.contractId,
                title: contract.title,
                freelancerName: contract.freelancerName,
                signedAt: contract.freelancerSignedAt,
                requiresAction: !contract.clientSigned,
                workspaceCreated: !!(contract.clientSigned && contract.freelancerSigned)
            });
        }

        console.log('✅ CONTRACT SIGNED SUCCESSFULLY');

        // ✅ Prepare response
        const responseData = {
            success: true,
            message: contract.clientSigned 
                ? "Contract signed successfully! Workspace has been created."
                : "Contract signed successfully! Waiting for client signature.",
            contract: {
                contractId: contract.contractId,
                title: contract.title,
                status: contract.status,
                clientSigned: contract.clientSigned,
                clientSignedAt: contract.clientSignedAt,
                freelancerSigned: contract.freelancerSigned,
                freelancerSignedAt: contract.freelancerSignedAt,
                workspaceId: contract.workspaceId,
                workspaceUrl: contract.workspaceId 
                    ? `/freelancer/workspace/${contract.workspaceId}`
                    : null
            }
        };

        // ✅ Add workspace info if created
        if (contract.workspaceId) {
            responseData.workspace = {
                workspaceId: contract.workspaceId,
                redirectUrl: `/freelancer/workspace/${contract.workspaceId}`,
                message: "Click here to access your workspace"
            };
        }

        res.json(responseData);

    } catch (error) {
        console.error("❌ FREELANCER SIGN CONTRACT ERROR:", error);
        console.error("Error stack:", error.stack);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: "Contract validation failed",
                errors: validationErrors
            });
        }
        
        // Handle database errors
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Duplicate contract entry"
            });
        }
        
        res.status(500).json({
            success: false,
            message: "Server error signing contract",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
},
    // Request changes to contract
    requestContractChanges: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { contractId } = req.params;
            const { requestedChanges, notes } = req.body;

            const contract = await Contract.findOne({
                contractId,
                freelancerId,
                status: 'sent'
            })
                .populate('clientId', 'name email');

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Contract not found or cannot request changes"
                });
            }

            // Update contract status and add change request
            contract.status = 'pending';
            contract.changeRequests = contract.changeRequests || [];
            contract.changeRequests.push({
                requestedBy: freelancerId,
                requestedAt: new Date(),
                changes: requestedChanges,
                notes,
                status: 'pending'
            });

            await contract.save();

            // Send notification to client
            if (contract.clientId) {
                const notification = new Notification({
                    userId: contract.clientId._id,
                    type: 'contract_changes_requested',
                    title: 'Contract Changes Requested',
                    message: `${contract.freelancerName || 'Freelancer'} has requested changes to contract "${contract.title}"`,
                    data: {
                        contractId: contract.contractId,
                        freelancerName: contract.freelancerName,
                        requestedChanges,
                        notes
                    }
                });
                await notification.save();
            }

            res.json({
                success: true,
                message: "Change request submitted successfully",
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

    // Decline contract
    declineContract: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { contractId } = req.params;
            const { reason } = req.body;

            const contract = await Contract.findOne({
                contractId,
                freelancerId,
                status: { $in: ['sent', 'pending'] }
            })
                .populate('clientId', 'name email');

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Contract not found or cannot be declined"
                });
            }

            // Update contract status
            contract.status = 'declined';
            contract.declinedAt = new Date();
            contract.declineReason = reason;

            await contract.save();

            // Send notification to client
            if (contract.clientId) {
                const notification = new Notification({
                    userId: contract.clientId._id,
                    type: 'contract_declined',
                    title: 'Contract Declined',
                    message: `${contract.freelancerName || 'Freelancer'} has declined the contract "${contract.title}"`,
                    data: {
                        contractId: contract.contractId,
                        freelancerName: contract.freelancerName,
                        reason,
                        declinedAt: contract.declinedAt
                    }
                });
                await notification.save();
            }

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

    // Get contract stats
    getContractStats: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const stats = await Contract.aggregate([
                { $match: { freelancerId: freelancerId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Calculate totals
            const totalContracts = await Contract.countDocuments({ freelancerId });
            const activeContracts = await Contract.countDocuments({
                freelancerId,
                status: 'active'
            });
            const pendingContracts = await Contract.countDocuments({
                freelancerId,
                status: { $in: ['sent', 'pending'] }
            });

            // Count contracts with workspaces
            const contractsWithWorkspace = await Contract.countDocuments({
                freelancerId,
                workspaceId: { $ne: null }
            });

            res.json({
                success: true,
                stats: {
                    byStatus: stats,
                    total: totalContracts,
                    active: activeContracts,
                    pending: pendingContracts,
                    withWorkspace: contractsWithWorkspace,
                    withoutWorkspace: totalContracts - contractsWithWorkspace
                }
            });

        } catch (error) {
            console.error("Get contract stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching contract stats"
            });
        }
    },

    // Get pending actions for freelancer
    getPendingActions: async (req, res) => {
        try {
            const freelancerId = req.userId;

            // Find contracts that need freelancer action
            const pendingContracts = await Contract.find({
                freelancerId,
                status: { $in: ['sent', 'pending'] },
                freelancerSigned: false
            })
                .populate('clientId', 'name profilePicture')
                .populate('projectId', 'title')
                .sort({ createdAt: -1 })
                .limit(5);

            res.json({
                success: true,
                pendingActions: pendingContracts.map(contract => ({
                    contractId: contract.contractId,
                    title: contract.title,
                    clientName: contract.clientName,
                    status: contract.status,
                    sentAt: contract.createdAt,
                    action: contract.status === 'sent' ? 'sign' : 'review'
                }))
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