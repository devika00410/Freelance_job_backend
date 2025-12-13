const debugController = {

    checkContractStatus: async (req, res) => {
        try {
            const { contractId } = req.params;
            const userId = req.userId; // From auth middleware
            
            console.log(`🔍 Debug check for contract: ${contractId}, user: ${userId}`);
            
            const Contract = require('../Models/Contract');
            const contract = await Contract.findById(contractId)
                .populate('clientId', 'name email username')
                .populate('freelancerId', 'name email username');
            
            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: 'Contract not found'
                });
            }
            
            // Check if user has access to this contract
            const isClient = contract.clientId?._id?.toString() === userId.toString();
            const isFreelancer = contract.freelancerId?._id?.toString() === userId.toString();
            
            if (!isClient && !isFreelancer) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this contract'
                });
            }
            
            // Check workspace
            const Workspace = require('../Models/Workspace');
            const workspace = await Workspace.findOne({ 
                contractId: contract._id.toString() 
            });
            
            // Log for server debugging
            console.log('📊 Contract Debug Info:', {
                contractId: contract._id,
                status: contract.status,
                clientSigned: contract.clientSigned,
                freelancerSigned: contract.freelancerSigned,
                clientName: contract.clientName,
                freelancerName: contract.freelancerName,
                workspaceId: contract.workspaceId,
                shouldHaveWorkspace: contract.status === 'active' && contract.clientSigned && contract.freelancerSigned
            });
            
            res.json({
                success: true,
                contract: {
                    id: contract._id,
                    contractId: contract.contractId,
                    title: contract.title,
                    status: contract.status,
                    clientSigned: contract.clientSigned,
                    freelancerSigned: contract.freelancerSigned,
                    clientName: contract.clientName,
                    freelancerName: contract.freelancerName,
                    workspaceId: contract.workspaceId,
                    // User info from populated fields
                    client: contract.clientId ? {
                        id: contract.clientId._id,
                        name: contract.clientId.name || contract.clientId.username,
                        email: contract.clientId.email
                    } : null,
                    freelancer: contract.freelancerId ? {
                        id: contract.freelancerId._id,
                        name: contract.freelancerId.name || contract.freelancerId.username,
                        email: contract.freelancerId.email
                    } : null,
                    // Dates
                    createdAt: contract.createdAt,
                    updatedAt: contract.updatedAt,
                    sentAt: contract.sentAt,
                    clientSignedAt: contract.clientSignedAt,
                    freelancerSignedAt: contract.freelancerSignedAt
                },
                workspace: workspace ? {
                    workspaceId: workspace.workspaceId,
                    status: workspace.status,
                    createdAt: workspace.createdAt,
                    updatedAt: workspace.updatedAt
                } : null,
                analysis: {
                    shouldHaveWorkspace: contract.status === 'active' && contract.clientSigned && contract.freelancerSigned,
                    missingSignatures: {
                        client: !contract.clientSigned,
                        freelancer: !contract.freelancerSigned
                    },
                    isActive: contract.status === 'active',
                    contractReadyForWorkspace: contract.status === 'active' && contract.clientSigned && contract.freelancerSigned,
                    workspaceExists: !!workspace,
                    userAccess: {
                        isClient,
                        isFreelancer,
                        currentUserId: userId
                    }
                },
                recommendations: contract.status === 'active' && contract.clientSigned && contract.freelancerSigned && !workspace 
                    ? ['Run fix-workspace endpoint to create missing workspace'] 
                    : contract.status !== 'active' 
                    ? ['Contract is not active. Both parties need to sign.'] 
                    : contract.clientSigned && !contract.freelancerSigned 
                    ? ['Waiting for freelancer to sign the contract'] 
                    : !contract.clientSigned && contract.freelancerSigned 
                    ? ['Waiting for client to sign the contract'] 
                    : ['No action needed']
            });
            
        } catch (error) {
            console.error('❌ Debug check error:', error);
            res.status(500).json({
                success: false,
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    },
    
    /**
     * Manually create/fix workspace for a contract
     * Useful when auto-creation fails
     */
    fixContractWorkspace: async (req, res) => {
        try {
            const { contractId } = req.params;
            const userId = req.userId;
            
            console.log(`🛠️ Manual workspace fix requested for contract: ${contractId}`);
            
            const Contract = require('../Models/Contract');
            const contract = await Contract.findById(contractId);
            
            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: 'Contract not found'
                });
            }
            
            // Check if user has access
            const isClient = contract.clientId.toString() === userId.toString();
            const isFreelancer = contract.freelancerId.toString() === userId.toString();
            
            if (!isClient && !isFreelancer) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to modify this contract'
                });
            }
            
            // Check if contract is ready for workspace
            if (contract.status !== 'active' || !contract.clientSigned || !contract.freelancerSigned) {
                return res.status(400).json({
                    success: false,
                    message: `Contract is not ready for workspace. Status: ${contract.status}, Client signed: ${contract.clientSigned}, Freelancer signed: ${contract.freelancerSigned}`
                });
            }
            
            // Check if workspace already exists
            const Workspace = require('../Models/Workspace');
            const existingWorkspace = await Workspace.findOne({ 
                contractId: contract._id.toString() 
            });
            
            if (existingWorkspace) {
                // Update contract with workspaceId if missing
                if (!contract.workspaceId) {
                    contract.workspaceId = existingWorkspace.workspaceId;
                    await contract.save();
                    console.log(`✅ Updated contract with existing workspace: ${existingWorkspace.workspaceId}`);
                }
                
                return res.json({
                    success: true,
                    message: 'Workspace already exists',
                    workspace: existingWorkspace,
                    action: 'updated_reference'
                });
            }
            
            // Create new workspace
            const WorkspaceService = require('../Services/WorkspaceService');
            const workspace = await WorkspaceService.createWorkspaceFromContract(contract._id);
            
            // Update contract with workspaceId
            contract.workspaceId = workspace.workspaceId;
            await contract.save();
            
            console.log(`✅ Workspace created and linked: ${workspace.workspaceId}`);
            
            res.json({
                success: true,
                message: 'Workspace created successfully',
                workspace: workspace,
                contract: {
                    contractId: contract.contractId,
                    title: contract.title,
                    workspaceId: contract.workspaceId
                },
                action: 'created_new'
            });
            
        } catch (error) {
            console.error('❌ Fix workspace error:', error);
            res.status(500).json({
                success: false,
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    },
    
    /**
     * Check user session data (for debugging localStorage issues)
     */
    checkUserSession: async (req, res) => {
        try {
            const userId = req.userId;
            
            const User = require('../Models/User');
            const user = await User.findById(userId).select('name email username role');
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found in database'
                });
            }
            
            res.json({
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    role: user.role
                },
                localStorageShouldHave: {
                    userId: user._id,
                    userName: user.name || user.username,
                    userRole: user.role,
                    userEmail: user.email
                },
                note: 'Compare these values with localStorage values in browser console'
            });
            
        } catch (error) {
            console.error('Check user session error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },
    
    /**
     * Check all contracts for a user and their workspace status
     */
    checkUserContracts: async (req, res) => {
        try {
            const userId = req.userId;
            
            const Contract = require('../Models/Contract');
            const contracts = await Contract.find({
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            })
            .populate('clientId', 'name username')
            .populate('freelancerId', 'name username')
            .sort({ createdAt: -1 });
            
            const Workspace = require('../Models/Workspace');
            
            const contractsWithAnalysis = await Promise.all(
                contracts.map(async (contract) => {
                    const workspace = await Workspace.findOne({ 
                        contractId: contract._id.toString() 
                    });
                    
                    return {
                        id: contract._id,
                        contractId: contract.contractId,
                        title: contract.title,
                        status: contract.status,
                        clientSigned: contract.clientSigned,
                        freelancerSigned: contract.freelancerSigned,
                        clientName: contract.clientName,
                        freelancerName: contract.freelancerName,
                        workspaceId: contract.workspaceId,
                        workspaceExists: !!workspace,
                        shouldHaveWorkspace: contract.status === 'active' && contract.clientSigned && contract.freelancerSigned,
                        issue: contract.status === 'active' && contract.clientSigned && contract.freelancerSigned && !workspace 
                            ? 'MISSING WORKSPACE' 
                            : null,
                        createdAt: contract.createdAt
                    };
                })
            );
            
            const stats = {
                total: contracts.length,
                active: contracts.filter(c => c.status === 'active').length,
                withWorkspace: contracts.filter(c => c.workspaceId).length,
                missingWorkspace: contractsWithAnalysis.filter(c => c.issue === 'MISSING WORKSPACE').length
            };
            
            res.json({
                success: true,
                stats,
                contracts: contractsWithAnalysis,
                recommendations: stats.missingWorkspace > 0 
                    ? [`${stats.missingWorkspace} contracts need workspace creation. Use fix-workspace endpoint.`] 
                    : ['All contracts look good']
            });
            
        } catch (error) {
            console.error('Check user contracts error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = debugController;