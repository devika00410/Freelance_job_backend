const Contract = require('../Models/Contract');
const Proposal = require('../Models/Proposal');
const WorkspaceService = require('../Services/WorkspaceService');
const Notification = require('../Models/Notification');
// const User = require('../Models/User');
const { notificationService } = require('../Controllers/notificationController');

const clientContractController = {
    createContract: async (req, res) => {
        try {
            const clientId = req.userId;
            const { proposalId, contractDetails = {} } = req.body;

            console.log('=== CREATE CONTRACT START ===');
            console.log('Client ID:', clientId);
            console.log('Proposal ID:', proposalId);
            console.log('Contract Details:', contractDetails);

            // IMPORTANT: Load models
            const User = require('../Models/User');
            const Proposal = require('../Models/Proposal');
            const Contract = require('../Models/Contract');

            // Find the accepted proposal
            const proposal = await Proposal.findById(proposalId)
                .populate({
                    path: 'freelancerId',
                    select: 'name email profilePicture',
                    model: User
                })
                .populate({
                    path: 'projectId',
                    select: 'title description budget category',
                    model: require('../Models/Job')
                })
                .populate({
                    path: 'clientId',
                    select: 'name email companyName',
                    model: User
                });

            console.log('Proposal found:', !!proposal);
            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    message: "Proposal not found"
                });
            }

            console.log('Proposal details:', {
                proposalId: proposal._id,
                status: proposal.status,
                clientId: proposal.clientId?._id,
                freelancerId: proposal.freelancerId?._id
            });

            // Verify client owns the proposal
            if (proposal.clientId._id.toString() !== clientId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized to create contract from this proposal"
                });
            }

            // Check if proposal is accepted
            if (proposal.status !== 'accepted') {
                return res.status(400).json({
                    success: false,
                    message: "Proposal must be accepted before creating contract"
                });
            }

            // Check if contract already exists
            const existingContract = await Contract.findOne({
                $or: [
                    { proposalId: proposal._id },
                    { proposalId: proposalId }
                ]
            });

            if (existingContract) {
                return res.status(400).json({
                    success: false,
                    message: "Contract already exists for this proposal",
                    contractId: existingContract.contractId
                });
            }

            // ⭐️ REPLACE THE ABOVE SECTION WITH THIS ⭐️

            // Get user data with BETTER ERROR HANDLING
            let clientUser, freelancerUser;

            try {
                clientUser = await User.findById(clientId).select('name email username profilePicture companyName');
                if (!clientUser) {
                    console.error('❌ Client user not found in database:', clientId);
                    // Don't fail, use defaults
                    clientUser = { name: 'Client', email: '', username: 'client' };
                }
            } catch (clientError) {
                console.error('❌ Error fetching client user:', clientError);
                clientUser = { name: 'Client', email: '', username: 'client' };
            }

            try {
                freelancerUser = await User.findById(proposal.freelancerId._id).select('name email username profilePicture');
                if (!freelancerUser) {
                    console.error('❌ Freelancer user not found in database:', proposal.freelancerId._id);
                    // Don't fail, use defaults
                    freelancerUser = { name: 'Freelancer', email: '', username: 'freelancer' };
                }
            } catch (freelancerError) {
                console.error('❌ Error fetching freelancer user:', freelancerError);
                freelancerUser = { name: 'Freelancer', email: '', username: 'freelancer' };
            }

            // ⭐️ Use username if name is not available
            const clientName = clientUser.name || clientUser.username || 'Client';
            const freelancerName = freelancerUser.name || freelancerUser.username || 'Freelancer';

            console.log('✅ User names fetched from database:', {
                clientName,
                clientEmail: clientUser.email,
                clientId: clientId,
                freelancerName,
                freelancerEmail: freelancerUser.email,
                freelancerId: proposal.freelancerId._id
            });

            // ⭐️ REMOVE THIS CHECK (don't fail if users not found)
            // if (!clientUser || !freelancerUser) {
            //     return res.status(404).json({
            //         success: false,
            //         message: "User data not found"
            //     });
            // }

            // Get project title
            let projectTitle = '';
            if (proposal.projectId && proposal.projectId.title) {
                projectTitle = proposal.projectId.title;
            } else if (proposal.proposalDetails) {
                projectTitle = proposal.proposalDetails.substring(0, 50) + '...';
            } else {
                projectTitle = 'Project Contract';
            }

            // Get budget
            let projectBudget = 0;
            if (proposal.projectId && proposal.projectId.budget) {
                projectBudget = proposal.projectId.budget;
            } else if (proposal.bidAmount) {
                projectBudget = proposal.bidAmount;
            } else if (contractDetails?.totalBudget) {
                projectBudget = contractDetails.totalBudget;
            } else if (proposal.proposalDetails?.totalAmount) {
                projectBudget = proposal.proposalDetails.totalAmount;
            }

            // Generate contract ID
            const contractId = `CONTRACT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // CRITICAL: Prepare contract data with ALL required fields
            const contractData = {
                contractId,
                proposalId: proposal._id,
                projectId: proposal.projectId?._id || null,
                clientId: clientId,
                freelancerId: proposal.freelancerId._id,

                clientSigned: true, // Client signs when creating contract
                clientSignature: "Digital Signature", // Or get from request
                clientSignedAt: new Date(),
                freelancerSigned: false,
                status: 'sent',

                // User names and info (CRITICAL FIX)
                clientName: clientName, // Use the variable we created,
                clientEmail: clientUser.email || '',
                clientCompany: clientUser.companyName || '',
                clientPicture: clientUser.profilePicture || '',

                freelancerName: freelancerName,
                freelancerEmail: freelancerUser.email || '',
                freelancerPicture: freelancerUser.profilePicture || '',

                // Contract details (with defaults for required fields)
                title: contractDetails?.title || projectTitle || 'Project Contract',
                description: contractDetails?.description || `Contract for ${projectTitle}`,
                terms: contractDetails?.terms || 'Standard contract terms apply. All work will be delivered as per agreement.',

                // ⭐️ CRITICAL: REQUIRED FIELDS WITH DEFAULTS
                milestoneStructure: contractDetails?.milestoneStructure || 'Standard milestone structure - Payments linked to phase completion.',
                timeline: contractDetails?.timeline || '30 days',
                serviceType: contractDetails?.serviceType || proposal.serviceType || 'general',

                // Financial details
                totalBudget: contractDetails?.totalBudget || projectBudget || 1000,
                currency: contractDetails?.currency || 'USD',
                paymentSchedule: contractDetails?.paymentSchedule || '50% upfront, 50% on completion',

                // Timeline dates
                startDate: contractDetails?.startDate || new Date(),
                endDate: contractDetails?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),

                // Scope of work
                scopeOfWork: contractDetails?.scopeOfWork || 'Complete project as per proposal',

                // Phases/Milestones (with defaults if empty)
                phases: contractDetails?.phases || [
                    {
                        phase: 1,
                        title: 'Initial Planning & Design',
                        description: 'Project planning and design phase',
                        amount: Math.floor((contractDetails?.totalBudget || projectBudget || 1000) * 0.3),
                        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                        status: 'pending',
                        deliverables: ['Project plan', 'Design mockups']
                    },
                    {
                        phase: 2,
                        title: 'Development Phase',
                        description: 'Main development work',
                        amount: Math.floor((contractDetails?.totalBudget || projectBudget || 1000) * 0.5),
                        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
                        status: 'pending',
                        deliverables: ['Core functionality', 'Testing']
                    },
                    {
                        phase: 3,
                        title: 'Final Delivery',
                        description: 'Final testing and delivery',
                        amount: Math.floor((contractDetails?.totalBudget || projectBudget || 1000) * 0.2),
                        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        status: 'pending',
                        deliverables: ['Final product', 'Documentation']
                    }
                ],

                // Status and signatures
                status: 'draft',
                clientSigned: false,
                freelancerSigned: false,
                workspaceId: null,

                // Additional fields
                revisionPolicy: contractDetails?.revisionPolicy || '2 revisions included',
                terminationPolicy: contractDetails?.terminationPolicy || '7-day notice period',
                confidentiality: contractDetails?.confidentiality !== undefined ? contractDetails.confidentiality : true,

                // Metadata
                createdAt: new Date(),
                updatedAt: new Date()
            };

            console.log('Creating contract with data:', {
                contractId: contractData.contractId,
                title: contractData.title,
                clientName: contractData.clientName,
                freelancerName: contractData.freelancerName,
                budget: contractData.totalBudget,
                status: contractData.status,
                hasMilestoneStructure: !!contractData.milestoneStructure,
                hasTimeline: !!contractData.timeline,
                hasServiceType: !!contractData.serviceType
            });

            // Create contract
            const contract = new Contract(contractData);
            await contract.save();

            // Update proposal
            proposal.contractSent = true;
            proposal.contractId = contract.contractId;
            await proposal.save();

            // Create notification
            const Notification = require('../Models/Notification');
            const notification = new Notification({
                notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId: proposal.freelancerId._id.toString(),
                userRole: 'freelancer',
                type: 'contract_created',
                title: 'Contract Draft Created',
                message: `${contract.clientName} has created a contract draft for "${contract.title}".`,
                category: 'contract',
                priority: 'medium',
                metadata: {
                    contractId: contract.contractId,
                    contractTitle: contract.title,
                    clientName: contract.clientName,
                    budget: contract.totalBudget,
                    redirectUrl: `/contracts/${contract.contractId}`
                },
                actionUrl: `/contracts/${contract.contractId}`,
                isRead: false,
                isArchived: false,
                actionRequired: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            await notification.save();

            console.log('=== CREATE CONTRACT SUCCESS ===');

            res.status(201).json({
                success: true,
                message: "Contract created successfully as draft",
                contract: {
                    contractId: contract.contractId,
                    title: contract.title,
                    status: contract.status,
                    totalBudget: contract.totalBudget,
                    clientName: contract.clientName,
                    freelancerName: contract.freelancerName,
                    milestoneStructure: contract.milestoneStructure,
                    timeline: contract.timeline,
                    serviceType: contract.serviceType,
                    createdAt: contract.createdAt,
                    nextStep: 'review_and_send'
                }
            });

        } catch (error) {
            console.error("❌ CREATE CONTRACT ERROR:", error);
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);

            // Check for validation errors
            if (error.name === 'ValidationError') {
                const missingFields = [];
                if (error.errors) {
                    Object.keys(error.errors).forEach(field => {
                        missingFields.push(`${field}: ${error.errors[field].message}`);
                    });
                }

                return res.status(400).json({
                    success: false,
                    message: "Contract validation failed",
                    missingFields: missingFields,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: "Server error creating contract",
                error: error.message
            });
        }
    }, getClientContracts: async (req, res) => {
        try {
            const clientId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { clientId };
            if (status && status !== 'all') {
                query.status = status;
            }

            const contracts = await Contract.find(query)
                .populate('freelancerId', 'name email profilePicture rating')
                .populate('projectId', 'title category')
                .sort({ updatedAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalContracts = await Contract.countDocuments(query);

            // Add workspace info
            const contractsWithWorkspace = await Promise.all(
                contracts.map(async (contract) => {
                    const contractObj = contract.toObject();
                    contractObj.hasWorkspace = !!contract.workspaceId;
                    contractObj.workspaceId = contract.workspaceId;
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
            console.error("Get client contracts error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching contracts"
            });
        }
    },

    // Get contract details
    getContractDetails: async (req, res) => {
        try {
            const clientId = req.userId;
            const { contractId } = req.params;

            const contract = await Contract.findOne({
                contractId,
                clientId
            })
                .populate('freelancerId', 'name email profilePicture rating skills bio')
                .populate('projectId', 'title description budget category skillsRequired')
                .populate('proposalId', 'coverLetter proposalDetails estimatedTime');

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Contract not found"
                });
            }

            // Add workspace info
            const contractData = contract.toObject();
            if (contract.workspaceId) {
                contractData.hasWorkspace = true;
                contractData.workspaceId = contract.workspaceId;
                contractData.workspaceAccessUrl = `/workspace/${contract.workspaceId}`;

                // Get workspace details if needed
                try {
                    const workspace = await Workspace.findOne({ workspaceId: contract.workspaceId });
                    if (workspace) {
                        contractData.workspaceStatus = workspace.status;
                        contractData.workspaceProgress = workspace.overallProgress;
                    }
                } catch (wsError) {
                    console.error('Error fetching workspace details:', wsError);
                }
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

    // Update contract
    updateContract: async (req, res) => {
        try {
            const clientId = req.userId;
            const { contractId } = req.params;
            const updates = req.body;

            // Find contract
            const contract = await Contract.findOne({
                contractId,
                clientId,
                status: { $in: ['draft', 'sent'] }
            });

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Contract not found or cannot be updated"
                });
            }

            // Update allowed fields
            const allowedUpdates = ['title', 'terms', 'totalBudget', 'timeline', 'milestoneStructure', 'phases', 'startDate'];
            allowedUpdates.forEach(field => {
                if (updates[field] !== undefined) {
                    contract[field] = updates[field];
                }
            });

            await contract.save();

            res.json({
                success: true,
                message: "Contract updated successfully",
                contract
            });

        } catch (error) {
            console.error("Update contract error:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating contract"
            });
        }
    },
    // Add this function to the controller
    createWorkspaceForContract: async (req, res) => {
        try {
            const clientId = req.userId;
            const { contractId } = req.params;
            const { forceCreate = false } = req.body;

            console.log('=== CREATE WORKSPACE FOR CONTRACT ===');
            console.log('Client ID:', clientId);
            console.log('Contract ID:', contractId);
            console.log('Force create:', forceCreate);

            // Find contract
            const contract = await Contract.findOne({
                contractId,
                clientId
            }).populate('freelancerId', 'name email');

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Contract not found or unauthorized"
                });
            }

            console.log('Contract found:', {
                title: contract.title,
                status: contract.status,
                clientSigned: contract.clientSigned,
                freelancerSigned: contract.freelancerSigned,
                existingWorkspaceId: contract.workspaceId
            });

            // Validate contract can have workspace
            const validStatuses = ['active', 'signed'];
            if (!validStatuses.includes(contract.status)) {
                return res.status(400).json({
                    success: false,
                    message: `Contract must be active or signed. Current status: "${contract.status}"`
                });
            }

            // Check if both parties signed
            if (!contract.clientSigned || !contract.freelancerSigned) {
                return res.status(400).json({
                    success: false,
                    message: "Both parties must sign the contract before creating a workspace"
                });
            }

            // Check if workspace already exists
            if (contract.workspaceId && !forceCreate) {
                // Verify workspace actually exists in database
                try {
                    const Workspace = require('../Models/Workspace');
                    const existingWorkspace = await Workspace.findOne({
                        workspaceId: contract.workspaceId
                    });

                    if (existingWorkspace) {
                        return res.json({
                            success: true,
                            message: "Workspace already exists",
                            workspaceId: contract.workspaceId,
                            workspace: existingWorkspace,
                            action: 'existing'
                        });
                    } else {
                        console.log('⚠️ Workspace ID exists in contract but not in database, recreating...');
                    }
                } catch (workspaceError) {
                    console.error('Error checking existing workspace:', workspaceError);
                }
            }

            // Create workspace
            console.log('🔄 Creating new workspace...');
            const WorkspaceService = require('../Services/WorkspaceService');

            try {
                const workspace = await WorkspaceService.createWorkspaceFromContract(contract._id);

                // Update contract with workspaceId
                contract.workspaceId = workspace.workspaceId;
                await contract.save();

                console.log('✅ Workspace created successfully:', workspace.workspaceId);

                res.json({
                    success: true,
                    message: "Workspace created successfully",
                    workspaceId: workspace.workspaceId,
                    workspace: workspace,
                    contract: {
                        contractId: contract.contractId,
                        title: contract.title,
                        status: contract.status
                    },
                    action: 'created'
                });

            } catch (workspaceError) {
                console.error('❌ Workspace creation failed:', workspaceError);

                // Try alternative method if primary fails
                try {
                    const Workspace = require('../Models/Workspace');
                    const User = require('../Models/User');

                    // Generate workspace ID
                    const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                    const workspace = new Workspace({
                        workspaceId: workspaceId,
                        contractId: contract._id,
                        projectId: contract.projectId || null,
                        clientId: contract.clientId,
                        freelancerId: contract.freelancerId,
                        title: `Workspace for ${contract.title}`,
                        description: `Collaboration workspace for contract: ${contract.title}`,
                        status: 'active',
                        currentPhase: 1,
                        overallProgress: 0,
                        budget: contract.totalBudget || 0,
                        timeline: contract.timeline || 'Not specified',
                        participants: [contract.clientId, contract.freelancerId],
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });

                    await workspace.save();

                    // Update contract
                    contract.workspaceId = workspaceId;
                    await contract.save();

                    res.json({
                        success: true,
                        message: "Workspace created using fallback method",
                        workspaceId: workspaceId,
                        workspace: workspace,
                        action: 'created_fallback'
                    });

                } catch (fallbackError) {
                    console.error('❌ Fallback workspace creation also failed:', fallbackError);
                    throw new Error(`Workspace creation failed: ${workspaceError.message}`);
                }
            }

        } catch (error) {
            console.error("❌ Create workspace error:", error);
            res.status(500).json({
                success: false,
                message: error.message || "Server error creating workspace",
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    },

    // Add this function to auto-create workspace when needed
    autoCreateWorkspaceIfNeeded: async (contract) => {
        try {
            if (!contract.workspaceId && contract.status === 'active' && contract.clientSigned && contract.freelancerSigned) {
                console.log('🔍 Auto-creating workspace for contract:', contract.contractId);

                const WorkspaceService = require('../Services/WorkspaceService');
                const workspace = await WorkspaceService.createWorkspaceFromContract(contract._id);
                contract.workspaceId = workspace.workspaceId;
                await contract.save();

                console.log('✅ Auto-created workspace:', workspace.workspaceId);
                return workspace;
            }
            return null;
        } catch (error) {
            console.error('❌ Auto-workspace creation failed:', error);
            return null;
        }
    },

   // Add this updated signContract function to clientContractController
signContract: async (req, res) => {
    try {
        const clientId = req.userId;
        const { contractId } = req.params;
        const { signature } = req.body;

        console.log('=== CLIENT SIGNING CONTRACT ===', {
            contractId,
            clientId,
            hasSignature: !!signature
        });

        // ✅ Load models inside function to avoid circular dependencies
        const Contract = require('../Models/Contract');
        const User = require('../Models/User');
        const Notification = require('../Models/Notification');

        // ✅ FIX: Find contract with proper status check
        const contract = await Contract.findOne({
            $or: [
                { contractId: contractId },
                { _id: contractId }
            ],
            clientId: clientId
        })
            .populate('freelancerId', 'name email')
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
        if (contract.clientSigned) {
            return res.status(400).json({
                success: false,
                message: "Contract already signed by client"
            });
        }

        // ✅ Validate contract status
        const validStatuses = ['draft', 'sent', 'pending', 'pending_client', 'pending_freelancer'];
        if (!validStatuses.includes(contract.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot sign contract with status: "${contract.status}"`
            });
        }

        // ✅ Update client signature
        contract.clientSigned = true;
        contract.clientSignature = signature || "Digital Signature";
        contract.clientSignedAt = new Date();

        // ✅ Update status based on signatures
        if (contract.freelancerSigned) {
            // Both signed - contract becomes active
            contract.status = 'active';
            console.log('✅ Both parties have signed - contract is now ACTIVE');
        } else {
            // Only client signed - waiting for freelancer
            contract.status = 'pending_freelancer';
            console.log('⏳ Client signed, waiting for freelancer signature');
        }

        // ✅ Auto-populate names if missing
        if (!contract.clientName || contract.clientName === 'Client') {
            const clientUser = await User.findById(clientId);
            if (clientUser) {
                contract.clientName = clientUser.name || clientUser.username || 'Client';
                contract.clientEmail = clientUser.email || '';
                contract.clientPicture = clientUser.profilePicture || '';
                console.log('✅ Updated client name to:', contract.clientName);
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
                
                // Send notification to both parties about workspace
                const workspaceNotification = new Notification({
                    notificationId: `notif_${Date.now()}_workspace`,
                    userId: contract.freelancerId._id,
                    userRole: 'freelancer',
                    type: 'workspace_created',
                    title: 'Workspace Created',
                    message: `Workspace created for "${contract.title}". Start collaborating now!`,
                    category: 'workspace',
                    priority: 'high',
                    metadata: {
                        workspaceId: workspace.workspaceId,
                        contractId: contract.contractId,
                        clientName: contract.clientName,
                        redirectUrl: `/freelancer/workspace/${workspace.workspaceId}`
                    },
                    actionUrl: `/freelancer/workspace/${workspace.workspaceId}`,
                    isRead: false
                });
                await workspaceNotification.save();
                
            } catch (workspaceError) {
                console.error('❌ Workspace creation failed:', workspaceError);
                // Don't fail the signing process if workspace creation fails
                // Contract is still signed and valid
            }
        }

        // ✅ Send notification to freelancer if client signed first
        if (contract.clientSigned && !contract.freelancerSigned) {
            const notification = new Notification({
                notificationId: `notif_${Date.now()}_sign`,
                userId: contract.freelancerId._id,
                userRole: 'freelancer',
                type: 'contract_signed',
                title: 'Contract Signed by Client',
                message: `${contract.clientName} has signed the contract "${contract.title}". Your signature is now required.`,
                category: 'contract',
                priority: 'high',
                metadata: {
                    contractId: contract.contractId,
                    contractTitle: contract.title,
                    clientName: contract.clientName,
                    clientSignedAt: contract.clientSignedAt,
                    requiresSignature: true,
                    redirectUrl: `/contracts/${contract.contractId}`
                },
                actionUrl: `/contracts/${contract.contractId}`,
                isRead: false,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
            await notification.save();
            console.log('📨 Notification sent to freelancer');
        }

        // ✅ Real-time notification via socket.io
        const io = req.app.get('io');
        if (io && contract.freelancerId) {
            io.to(contract.freelancerId._id.toString()).emit('contract_signed', {
                contractId: contract.contractId,
                title: contract.title,
                clientName: contract.clientName,
                signedAt: contract.clientSignedAt,
                requiresAction: !contract.freelancerSigned,
                workspaceCreated: !!(contract.clientSigned && contract.freelancerSigned)
            });
        }

        console.log('✅ CONTRACT SIGNED SUCCESSFULLY');

        // ✅ Prepare response
        const responseData = {
            success: true,
            message: contract.freelancerSigned 
                ? "Contract signed successfully! Workspace has been created."
                : "Contract signed successfully! Waiting for freelancer signature.",
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
                    ? (req.userRole === 'client' 
                        ? `/client/workspace/${contract.workspaceId}`
                        : `/freelancer/workspace/${contract.workspaceId}`)
                    : null
            }
        };

        // ✅ Add workspace info if created
        if (contract.workspaceId) {
            responseData.workspace = {
                workspaceId: contract.workspaceId,
                redirectUrl: req.userRole === 'client' 
                    ? `/client/workspace/${contract.workspaceId}`
                    : `/freelancer/workspace/${contract.workspaceId}`,
                message: "Click here to access your workspace"
            };
        }

        res.json(responseData);

    } catch (error) {
        console.error("❌ SIGN CONTRACT ERROR:", error);
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
    // In clientContractController.js - Update sendContract function:
    sendContract: async (req, res) => {
        try {
            console.log('Checking User model...');
            const User = require('../Models/User');
            console.log('User model loaded:', !!User);

            try {
                const testUser = await User.findById(req.userId);
                console.log('Test user found:', !!testUser);
            } catch (userError) {
                console.error('Error loading user:', userError.message);
            }
            const clientId = req.userId;
            const { contractId } = req.params;

            console.log('=== SEND CONTRACT START ===');
            console.log('Client ID:', clientId);
            console.log('Contract ID:', contractId);

            const contract = await Contract.findOne({
                contractId: contractId,
                clientId: clientId,
                status: 'draft'
            })
                .populate('freelancerId', 'name email')
                .populate('clientId', 'name email');

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Contract not found, already sent, or not a draft"
                });
            }

            // ⭐️ CRITICAL FIX: Get client name from localStorage or current user
            const clientUser = await User.findById(clientId);
            contract.clientName = clientUser?.name || clientUser?.username || 'Client';
            console.log('✅ Client name set to:', contract.clientName);

            if (!contract.freelancerName || contract.freelancerName === 'Freelancer') {
                const freelancerUser = await User.findById(contract.freelancerId);
                contract.freelancerName = freelancerUser?.name || freelancerUser?.username || 'Freelancer';
                console.log('✅ Freelancer name set to:', contract.freelancerName);
            }

            // ⭐️ CRITICAL FIX: Update contract status to 'sent' and ensure proper fields
            contract.status = 'sent';
            contract.sentAt = new Date();

            // Ensure client has signed when sending (client signs when sending)
            if (!contract.clientSigned) {
                contract.clientSigned = true;
                contract.clientSignature = "Digital Signature (Sent by Client)";
                contract.clientSignedAt = new Date();
                console.log('✅ Client auto-signed when sending contract');
            }

            await contract.save();

            // CRITICAL: Send notification to freelancer
            const Notification = require('../Models/Notification');
            const notification = new Notification({
                notificationId: `notif_${Date.now()}_send`,
                userId: contract.freelancerId._id.toString(),
                userRole: 'freelancer',
                type: 'contract_sent',
                title: 'Contract Sent for Review',
                message: `${contract.clientName} has sent you a contract for "${contract.title}"`,
                category: 'contract',
                priority: 'high',
                metadata: {
                    contractId: contract.contractId,
                    contractTitle: contract.title,
                    clientName: contract.clientName,
                    clientId: contract.clientId.toString(),
                    budget: contract.totalBudget,
                    sentAt: contract.sentAt,
                    redirectUrl: `/contracts/${contract.contractId}`,
                    requiresSignature: true,
                    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days to respond
                },
                actionUrl: `/contracts/${contract.contractId}`,
                isRead: false,
                isArchived: false,
                actionRequired: true,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            await notification.save();



            // Send real-time notification
            const io = req.app.get('io');
            if (io && contract.freelancerId) {
                io.to(contract.freelancerId._id.toString()).emit('contract_received', {
                    contractId: contract.contractId,
                    title: contract.title,
                    clientName: contract.clientName,
                    budget: contract.totalBudget,
                    requiresAction: true,
                    timestamp: new Date()
                });
            }

            console.log('=== SEND CONTRACT SUCCESS ===');

            res.json({
                success: true,
                message: "Contract sent to freelancer successfully",
                contract: {
                    contractId: contract.contractId,
                    title: contract.title,
                    status: contract.status,
                    sentAt: contract.sentAt,
                    freelancerId: contract.freelancerId._id,
                    freelancerName: contract.freelancerName,
                    clientName: contract.clientName,
                    clientSigned: contract.clientSigned,
                    freelancerSigned: contract.freelancerSigned,
                    nextStep: 'wait_for_freelancer_signature'
                },
                notificationSent: true
            });

        } catch (error) {
            console.error("❌ SEND CONTRACT ERROR:", error);
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
            const { reason } = req.body;

            const contract = await Contract.findOne({
                contractId,
                clientId,
                status: { $in: ['sent', 'pending', 'draft'] }
            })
                .populate('freelancerId', 'name email');

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: "Contract not found or cannot be cancelled"
                });
            }

            // Update contract status
            contract.status = 'cancelled';
            contract.cancelledAt = new Date();
            contract.cancelReason = reason;

            await contract.save();

            // Send notification to freelancer
            if (contract.freelancerId) {
                const notification = new Notification({
                    notificationId: `notif_${Date.now()}_cancel`,
                    userId: contract.freelancerId._id.toString(),
                    userRole: 'freelancer',
                    type: 'contract_cancelled',
                    title: 'Contract Cancelled',
                    message: `Contract "${contract.title}" has been cancelled by ${contract.clientName}`,
                    category: 'contract',
                    priority: 'medium',
                    metadata: {
                        contractId: contract.contractId,
                        clientName: contract.clientName,
                        reason,
                        cancelledAt: contract.cancelledAt,
                        triggeredBy: clientId.toString(),
                        triggeredByRole: 'client'
                    },
                    actionUrl: `/contracts`,
                    isRead: false,
                    isArchived: false,
                    actionRequired: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                await notification.save();
            }

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

    // Get contract stats
    getContractStats: async (req, res) => {
        try {
            const clientId = req.userId;

            const stats = await Contract.aggregate([
                { $match: { clientId: clientId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Calculate totals
            const totalContracts = await Contract.countDocuments({ clientId });
            const activeContracts = await Contract.countDocuments({
                clientId,
                status: 'active'
            });
            const pendingContracts = await Contract.countDocuments({
                clientId,
                status: { $in: ['sent', 'pending'] }
            });

            // Count contracts with workspaces
            const contractsWithWorkspace = await Contract.countDocuments({
                clientId,
                workspaceId: { $ne: null }
            });

            // Calculate total budget
            const budgetStats = await Contract.aggregate([
                { $match: { clientId: clientId, status: 'active' } },
                {
                    $group: {
                        _id: null,
                        totalBudget: { $sum: '$totalBudget' },
                        avgBudget: { $avg: '$totalBudget' }
                    }
                }
            ]);

            res.json({
                success: true,
                stats: {
                    byStatus: stats,
                    total: totalContracts,
                    active: activeContracts,
                    pending: pendingContracts,
                    withWorkspace: contractsWithWorkspace,
                    withoutWorkspace: totalContracts - contractsWithWorkspace,
                    budget: budgetStats[0] || { totalBudget: 0, avgBudget: 0 }
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