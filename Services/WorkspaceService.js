const Workspace = require('../Models/Workspace');
const Contract = require('../Models/Contract');
const Notification = require('../Models/Notification');

const axios = require('axios');

class WorkspaceService {
    /**
     * Create a role-based workspace when contract becomes active
     */
    static async createWorkspaceFromContract(contractId) {
        try {
            console.log(`🔄 Creating role-based workspace for contract: ${contractId}`);

            // Find the contract by its _id
            const contract = await Contract.findById(contractId)
                .populate('clientId', 'name email profilePicture username companyName')
                .populate('freelancerId', 'name email profilePicture username skills rating')
                .populate('projectId', 'title description budget category skillsRequired duration');

            if (!contract) {
                throw new Error(`Contract not found: ${contractId}`);
            }

            // Verify contract is ready for workspace
            if (!contract.clientSigned || !contract.freelancerSigned) {
                throw new Error(`Contract ${contractId} is not fully signed. Client: ${contract.clientSigned}, Freelancer: ${contract.freelancerSigned}`);
            }

            // Check if workspace already exists for this contract _id
            const existingWorkspace = await Workspace.findOne({ 
                contractId: contract._id.toString() 
            });
            
            if (existingWorkspace) {
                console.log(`✅ Workspace already exists: ${existingWorkspace.workspaceId}`);
                // Update contract with workspaceId if missing
                if (!contract.workspaceId) {
                    contract.workspaceId = existingWorkspace.workspaceId;
                    await contract.save();
                }
                return existingWorkspace;
            }

            // Generate unique workspace ID
            const generateWorkspaceId = () => {
                const timestamp = Date.now();
                const random = Math.random().toString(36).substr(2, 9);
                return `ws_${timestamp}_${random}`;
            };

            const workspaceId = generateWorkspaceId();

            // Prepare milestones from contract phases
            const prepareMilestonesFromContract = (contract) => {
                if (!contract.phases || contract.phases.length === 0) {
                    return [{
                        milestoneId: `ml_${Date.now()}`,
                        title: 'Complete Project',
                        description: 'Complete the project as per agreement',
                        phaseNumber: 1,
                        dueDate: contract.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        amount: contract.totalBudget,
                        status: 'pending',
                        deliverables: ['Final project delivery'],
                        submissionDate: null,
                        approvalDate: null,
                        feedback: ''
                    }];
                }
                
                return contract.phases.map((phase, index) => ({
                    milestoneId: `ml_${Date.now()}_${index}`,
                    title: phase.title || `Phase ${phase.phase}`,
                    description: phase.description || `Phase ${phase.phase} completion`,
                    phaseNumber: phase.phase,
                    dueDate: phase.dueDate || new Date(Date.now() + (phase.phase * 10 * 24 * 60 * 60 * 1000)),
                    amount: phase.amount,
                    status: phase.status || 'pending',
                    deliverables: phase.deliverables || [`Deliverable for phase ${phase.phase}`],
                    submissionDate: null,
                    approvalDate: null,
                    feedback: ''
                }));
            };

            // Create role-based workspace data
            const workspaceData = {
                workspaceId,
                contractId: contract._id.toString(),
                projectId: contract.projectId ? contract.projectId._id : null,
                clientId: contract.clientId ? contract.clientId._id.toString() : null,
                freelancerId: contract.freelancerId ? contract.freelancerId._id.toString() : null,
                
                // Shared data (visible to both roles)
                sharedData: {
                    title: contract.title || (contract.projectId && contract.projectId.title) || 'Project Workspace',
                    description: contract.description || `Collaboration workspace for ${contract.title}`,
                    status: 'active',
                    currentPhase: 1,
                    overallProgress: 0,
                    startDate: contract.startDate || new Date(),
                    estimatedEndDate: contract.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    totalBudget: contract.totalBudget || 0,
                    serviceType: contract.serviceType || 'general',
                    lastActivity: new Date(),
                    unreadMessages: {
                        client: 0,
                        freelancer: 0
                    },
                    
                    // Shared messages
                    sharedMessages: [
                        {
                            messageId: `welcome_${Date.now()}`,
                            senderId: contract.clientId._id,
                            senderRole: 'client',
                            content: `Welcome to the workspace! I'm ${contract.clientName || contract.clientId.name || 'Client'}, looking forward to working with you.`,
                            timestamp: new Date(),
                            messageType: 'text',
                            readBy: [contract.clientId._id]
                        },
                        {
                            messageId: `welcome_${Date.now() + 1}`,
                            senderId: contract.freelancerId._id,
                            senderRole: 'freelancer',
                            content: `Thanks ${contract.clientName || contract.clientId.name || 'Client'}! I'm ${contract.freelancerName || contract.freelancerId.name || 'Freelancer'}, excited to start this project.`,
                            timestamp: new Date(Date.now() + 1000),
                            messageType: 'text',
                            readBy: [contract.freelancerId._id]
                        }
                    ],
                    
                    // Shared files
                    sharedFiles: [],
                    
                    // Shared milestones
                    sharedMilestones: prepareMilestonesFromContract(contract),
                    
                    // Shared video calls
                    sharedVideoCalls: []
                },
                
                // Client-only data
                clientData: {
                    privateNotes: [
                        {
                            noteId: `client_note_${Date.now()}`,
                            content: `Private notes for contract with ${contract.freelancerName || contract.freelancerId.name || 'Freelancer'}. Only visible to me.`,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    ],
                    privateFiles: [],
                    paymentHistory: [],
                    clientFeedback: [],
                    budgetTracking: {
                        totalBudget: contract.totalBudget || 0,
                        paidAmount: 0,
                        pendingAmount: contract.totalBudget || 0,
                        transactions: []
                    }
                },
                
                // Freelancer-only data
                freelancerData: {
                    privateNotes: [
                        {
                            noteId: `freelancer_note_${Date.now()}`,
                            content: `Private notes for contract with ${contract.clientName || contract.clientId.name || 'Client'}. Only visible to me.`,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    ],
                    privateFiles: [],
                    earningsTracking: {
                        totalEarned: 0,
                        pendingEarnings: contract.totalBudget || 0,
                        completedMilestones: 0,
                        transactions: []
                    },
                    workLogs: [],
                    submissionHistory: []
                },
                
                // Role-based permissions
                permissions: {
                    client: {
                        canApproveMilestones: true,
                        canRequestRevisions: true,
                        canUploadFiles: true,
                        canSendMessages: true,
                        canMakePayments: true,
                        canScheduleCalls: true,
                        canViewPrivateNotes: true,
                        canViewBudget: true,
                        canInviteOthers: false,
                        canCloseWorkspace: false
                    },
                    freelancer: {
                        canSubmitWork: true,
                        canUploadFiles: true,
                        canSendMessages: true,
                        canMarkComplete: false,
                        canTrackEarnings: true,
                        canScheduleCalls: true,
                        canViewPrivateNotes: true,
                        canViewEarnings: true,
                        canInviteOthers: false,
                        canCloseWorkspace: false
                    }
                }
            };

            // Create workspace
            const workspace = new Workspace(workspaceData);
            await workspace.save();

            // Update contract with workspaceId
            contract.workspaceId = workspaceId;
            await contract.save();

            console.log(`✅ Role-based workspace created successfully: ${workspaceId}`);

            // Send role-based notifications
            try {
                await this.sendRoleBasedWorkspaceNotifications(workspace, contract);
            } catch (notifErr) {
                console.error('Notification error (non-fatal):', notifErr);
            }

            return workspace;

        } catch (error) {
            console.error('❌ Error creating role-based workspace:', error);
            throw error;
        }
    }

    /**
     * Send role-based notifications when workspace is created
     */
    static async sendRoleBasedWorkspaceNotifications(workspace, contract) {
        try {
            // Generate notification ID
            const generateNotificationId = () => {
                const timestamp = Date.now();
                const random = Math.random().toString(36).substr(2, 9);
                return `notif_${timestamp}_${random}`;
            };

            // Client notification with client-specific URL
            const clientNotification = new Notification({
                notificationId: generateNotificationId(),
                userId: contract.clientId._id.toString(),
                userRole: 'client',
                type: 'workspace_created',
                title: 'Workspace Created',
                message: `Your workspace with ${contract.freelancerName || contract.freelancerId.name || 'Freelancer'} is ready!`,
                category: 'workspace',
                priority: 'medium',
                metadata: {
                    workspaceId: workspace.workspaceId,
                    contractId: contract._id.toString(),
                    freelancerName: contract.freelancerName || contract.freelancerId.name || 'Freelancer',
                    projectTitle: workspace.sharedData.title,
                    redirectUrl: `/client/workspace/${workspace.workspaceId}`,
                    role: 'client'
                },
                actionUrl: `/client/workspace/${workspace.workspaceId}`,
                isRead: false,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            });
            await clientNotification.save();

            // Freelancer notification with freelancer-specific URL
            const freelancerNotification = new Notification({
                notificationId: generateNotificationId(),
                userId: contract.freelancerId._id.toString(),
                userRole: 'freelancer',
                type: 'workspace_created',
                title: 'Workspace Created',
                message: `Your workspace with ${contract.clientName || contract.clientId.name || 'Client'} is ready!`,
                category: 'workspace',
                priority: 'medium',
                metadata: {
                    workspaceId: workspace.workspaceId,
                    contractId: contract._id.toString(),
                    clientName: contract.clientName || contract.clientId.name || 'Client',
                    projectTitle: workspace.sharedData.title,
                    redirectUrl: `/freelancer/workspace/${workspace.workspaceId}`,
                    role: 'freelancer'
                },
                actionUrl: `/freelancer/workspace/${workspace.workspaceId}`,
                isRead: false,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            });
            await freelancerNotification.save();

            console.log('📨 Role-based notifications sent');

            // Send real-time notifications via socket
            try {
                const io = require('../index').io;
                if (io) {
                    // Send to client
                    io.to(contract.clientId._id.toString()).emit('workspace_created', {
                        type: 'workspace_created',
                        workspaceId: workspace.workspaceId,
                        title: workspace.sharedData.title,
                        redirectUrl: `/client/workspace/${workspace.workspaceId}`,
                        role: 'client'
                    });
                    
                    // Send to freelancer
                    io.to(contract.freelancerId._id.toString()).emit('workspace_created', {
                        type: 'workspace_created',
                        workspaceId: workspace.workspaceId,
                        title: workspace.sharedData.title,
                        redirectUrl: `/freelancer/workspace/${workspace.workspaceId}`,
                        role: 'freelancer'
                    });
                    
                    console.log('✅ Real-time role-based notifications sent');
                }
            } catch (socketError) {
                console.log('Socket not available:', socketError.message);
            }

        } catch (error) {
            console.error('Error sending role-based notifications:', error);
            // Don't throw - workspace creation shouldn't fail due to notification error
        }
    }

    /**
     * Get workspace data for specific role (client or freelancer)
     */
    static async getWorkspaceForRole(workspaceId, userId, role) {
        try {
            console.log(`🔍 Getting ${role} workspace: ${workspaceId} for user: ${userId}`);

            const workspace = await Workspace.findOne({ workspaceId });

            if (!workspace) {
                throw new Error('Workspace not found');
            }

            // Verify access rights
            const isClient = workspace.clientId && workspace.clientId.toString() === userId.toString();
            const isFreelancer = workspace.freelancerId && workspace.freelancerId.toString() === userId.toString();
            
            if (role === 'client' && !isClient) {
                throw new Error('Client access denied');
            }
            
            if (role === 'freelancer' && !isFreelancer) {
                throw new Error('Freelancer access denied');
            }

            // Return role-specific view
            if (role === 'client') {
                return {
                    workspaceId: workspace.workspaceId,
                    contractId: workspace.contractId,
                    projectId: workspace.projectId,
                    role: 'client',
                    // Shared data
                    ...workspace.sharedData,
                    // Client-only data
                    privateData: workspace.clientData,
                    permissions: workspace.permissions.client,
                    participants: {
                        client: workspace.clientId,
                        freelancer: workspace.freelancerId
                    },
                    createdAt: workspace.createdAt,
                    updatedAt: workspace.updatedAt
                };
            } else {
                return {
                    workspaceId: workspace.workspaceId,
                    contractId: workspace.contractId,
                    projectId: workspace.projectId,
                    role: 'freelancer',
                    // Shared data
                    ...workspace.sharedData,
                    // Freelancer-only data
                    privateData: workspace.freelancerData,
                    permissions: workspace.permissions.freelancer,
                    participants: {
                        client: workspace.clientId,
                        freelancer: workspace.freelancerId
                    },
                    createdAt: workspace.createdAt,
                    updatedAt: workspace.updatedAt
                };
            }

        } catch (error) {
            console.error('Error getting role-based workspace:', error);
            throw error;
        }
    }

    /**
     * Add shared message to workspace
     */
    static async addSharedMessage(workspaceId, messageData) {
        try {
            const workspace = await Workspace.findOne({ workspaceId });
            
            if (!workspace) {
                throw new Error('Workspace not found');
            }

            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            workspace.sharedData.sharedMessages.push({
                messageId,
                ...messageData,
                timestamp: new Date()
            });
            
            workspace.sharedData.lastActivity = new Date();
            
            // Increment unread count for the other participant
            if (messageData.senderRole === 'client') {
                workspace.sharedData.unreadMessages.freelancer += 1;
            } else {
                workspace.sharedData.unreadMessages.client += 1;
            }
            
            await workspace.save();
            
            return {
                messageId,
                workspaceId,
                ...messageData
            };
            
        } catch (error) {
            console.error('Error adding shared message:', error);
            throw error;
        }
    }

    /**
     * Add private note for specific role
     */
    static async addPrivateNote(workspaceId, role, noteData) {
        try {
            const workspace = await Workspace.findOne({ workspaceId });
            
            if (!workspace) {
                throw new Error('Workspace not found');
            }

            const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const note = {
                noteId,
                content: noteData.content,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            if (role === 'client') {
                workspace.clientData.privateNotes.push(note);
            } else {
                workspace.freelancerData.privateNotes.push(note);
            }
            
            await workspace.save();
            
            return {
                noteId,
                workspaceId,
                role,
                ...noteData
            };
            
        } catch (error) {
            console.error('Error adding private note:', error);
            throw error;
        }
    }

    /**
     * Update milestone status
     */
    static async updateMilestoneStatus(workspaceId, milestoneId, status, feedback = '') {
        try {
            const workspace = await Workspace.findOne({ workspaceId });
            
            if (!workspace) {
                throw new Error('Workspace not found');
            }

            const milestone = workspace.sharedData.sharedMilestones.find(m => m.milestoneId === milestoneId);
            
            if (!milestone) {
                throw new Error('Milestone not found');
            }

            milestone.status = status;
            
            if (status === 'submitted') {
                milestone.submissionDate = new Date();
            } else if (status === 'approved' || status === 'completed') {
                milestone.approvedDate = new Date();
                milestone.feedback = feedback;
                
                // Update overall progress
                const totalMilestones = workspace.sharedData.sharedMilestones.length;
                const completedMilestones = workspace.sharedData.sharedMilestones.filter(m => 
                    ['approved', 'completed', 'paid'].includes(m.status)
                ).length;
                
                workspace.sharedData.overallProgress = Math.round((completedMilestones / totalMilestones) * 100);
                workspace.sharedData.currentPhase = milestone.phaseNumber + 1;
            }

            await workspace.save();
            
            return milestone;
            
        } catch (error) {
            console.error('Error updating milestone status:', error);
            throw error;
        }
    }

    /**
     * Get workspace for a user (client or freelancer) - legacy method
     */
    static async getUserWorkspace(workspaceId, userId) {
        try {
            const workspace = await Workspace.findOne({
                workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            });

            if (!workspace) {
                throw new Error('Workspace not found or access denied');
            }

            // Determine user role in this workspace
            const userRole = workspace.clientId.toString() === userId.toString() ? 'client' : 'freelancer';

            // Use role-based method
            return this.getWorkspaceForRole(workspaceId, userId, userRole);

        } catch (error) {
            console.error('Error getting user workspace:', error);
            throw error;
        }
    }

    /**
     * Get all workspaces for a user
     */
    static async getUserWorkspaces(userId, role, status = null) {
        try {
            const query = role === 'client'
                ? { clientId: userId }
                : { freelancerId: userId };

            if (status && status !== 'all') {
                query['sharedData.status'] = status;
            }

            const workspaces = await Workspace.find(query)
                .sort({ updatedAt: -1 });

            // Transform to role-specific views
            return workspaces.map(workspace => {
                if (role === 'client') {
                    return {
                        workspaceId: workspace.workspaceId,
                        title: workspace.sharedData.title,
                        status: workspace.sharedData.status,
                        overallProgress: workspace.sharedData.overallProgress,
                        currentPhase: workspace.sharedData.currentPhase,
                        totalBudget: workspace.sharedData.totalBudget,
                        lastActivity: workspace.sharedData.lastActivity,
                        unreadMessages: workspace.sharedData.unreadMessages.client,
                        role: 'client',
                        hasPrivateData: workspace.clientData.privateNotes.length > 0,
                        createdAt: workspace.createdAt
                    };
                } else {
                    return {
                        workspaceId: workspace.workspaceId,
                        title: workspace.sharedData.title,
                        status: workspace.sharedData.status,
                        overallProgress: workspace.sharedData.overallProgress,
                        currentPhase: workspace.sharedData.currentPhase,
                        totalBudget: workspace.sharedData.totalBudget,
                        lastActivity: workspace.sharedData.lastActivity,
                        unreadMessages: workspace.sharedData.unreadMessages.freelancer,
                        role: 'freelancer',
                        hasPrivateData: workspace.freelancerData.privateNotes.length > 0,
                        createdAt: workspace.createdAt
                    };
                }
            });

        } catch (error) {
            console.error('Error getting user workspaces:', error);
            throw error;
        }
    }

    /**
     * Check if user has access to workspace
     */
    static async checkWorkspaceAccess(workspaceId, userId) {
        try {
            const workspace = await Workspace.findOne({
                workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            });

            return {
                hasAccess: !!workspace,
                userRole: workspace
                    ? (workspace.clientId.toString() === userId.toString() ? 'client' : 'freelancer')
                    : null,
                permissions: workspace ? workspace.permissions : null
            };

        } catch (error) {
            console.error('Error checking workspace access:', error);
            return { hasAccess: false, userRole: null, permissions: null };
        }
    }

    /**
     * Auto-create workspace for active contracts without workspace
     */
    static async autoCreateWorkspaceForActiveContracts() {
        try {
            console.log('🔄 Checking for active contracts without workspace...');
            
            // Find all active contracts without workspace
            const activeContracts = await Contract.find({
                status: 'active',
                clientSigned: true,
                freelancerSigned: true,
                workspaceId: { $exists: false }
            }).limit(10);

            console.log(`📋 Found ${activeContracts.length} active contracts without workspace`);

            for (const contract of activeContracts) {
                try {
                    console.log(`🔄 Creating workspace for contract: ${contract._id}`);
                    const workspace = await this.createWorkspaceFromContract(contract._id);
                    console.log(`✅ Role-based workspace created: ${workspace.workspaceId}`);
                } catch (error) {
                    console.error(`❌ Failed to create workspace for contract ${contract._id}:`, error.message);
                }
            }

            return { success: true, processed: activeContracts.length };
        } catch (error) {
            console.error('Error in autoCreateWorkspaceForActiveContracts:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check and fix workspace for a specific contract
     */
    static async ensureWorkspaceExists(contractId) {
        try {
            const contract = await Contract.findById(contractId);
            
            if (!contract) {
                throw new Error(`Contract not found: ${contractId}`);
            }

            // Check if contract should have workspace
            if (contract.status === 'active' && contract.clientSigned && contract.freelancerSigned) {
                // Check if workspace already exists
                const existingWorkspace = await Workspace.findOne({ 
                    contractId: contract._id.toString() 
                });
                
                if (existingWorkspace) {
                    console.log(`✅ Workspace already exists: ${existingWorkspace.workspaceId}`);
                    // Update contract with workspaceId if missing
                    if (!contract.workspaceId) {
                        contract.workspaceId = existingWorkspace.workspaceId;
                        await contract.save();
                    }
                    return existingWorkspace;
                } else {
                    // Create role-based workspace
                    console.log(`🔄 Creating missing role-based workspace for contract: ${contract._id}`);
                    const workspace = await this.createWorkspaceFromContract(contract._id);
                    return workspace;
                }
            } else {
                console.log(`⚠️ Contract ${contractId} is not ready for workspace. Status: ${contract.status}, Client Signed: ${contract.clientSigned}, Freelancer Signed: ${contract.freelancerSigned}`);
                return null;
            }
        } catch (error) {
            console.error(`Error ensuring workspace exists for ${contractId}:`, error);
            throw error;
        }
    }

    /**
     * Mark messages as read for a user
     */
    static async markMessagesAsRead(workspaceId, userId, role) {
        try {
            const workspace = await Workspace.findOne({ workspaceId });
            
            if (!workspace) {
                throw new Error('Workspace not found');
            }

            // Mark messages as read
            workspace.sharedData.sharedMessages.forEach(message => {
                if (!message.readBy.includes(userId)) {
                    message.readBy.push(userId);
                }
            });

            // Reset unread count for this user
            if (role === 'client') {
                workspace.sharedData.unreadMessages.client = 0;
            } else {
                workspace.sharedData.unreadMessages.freelancer = 0;
            }

            await workspace.save();
            
            return { success: true };
            
        } catch (error) {
            console.error('Error marking messages as read:', error);
            throw error;
        }
    }
}

module.exports = WorkspaceService;