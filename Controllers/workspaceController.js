const Workspace = require('../Models/Workspace');
const Message = require('../Models/Message');
const File = require('../Models/File');
const Milestone = require('../Models/Milestone');
const Report = require('../Models/Report');
const VideoCall = require('../Models/VideoCall');
const dailyService = require('../services/dailyService');
const Contract = require('../Models/Contract');
const axios = require('axios');

const workspaceController = {
    // Get workspace details - FIXED VERSION
    getWorkspaceDetails: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;

            console.log(`🔍 Fetching workspace: ${workspaceId} for user: ${userId}`);

         
           const workspace = await Workspace.findById(workspaceId)

                .populate('clientId', 'name email profilePicture companyName phone')
                .populate('freelancerId', 'name email profilePicture skills rating bio')
                .populate('projectId', 'title description budget category skillsRequired');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            // ⭐️ CRITICAL FIX: Check if user has access (client or freelancer)
            const isClient = workspace.clientId && workspace.clientId._id.toString() === userId.toString();
            const isFreelancer = workspace.freelancerId && workspace.freelancerId._id.toString() === userId.toString();
            
            if (!isClient && !isFreelancer) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this workspace"
                });
            }

            // Determine user's role in this workspace
            const workspaceRole = isClient ? 'client' : 'freelancer';

            // Get additional workspace data
            const milestones = await Milestone.find({ workspaceId }).sort({ phaseNumber: 1 });
            const recentMessages = await Message.find({ workspaceId })
                .populate('senderId', 'name profilePicture role')
                .sort({ timestamp: -1 })
                .limit(10);
            const filesCount = await File.countDocuments({ workspaceId });

            // Get upcoming video calls
            const upcomingCalls = await VideoCall.find({
                workspaceId,
                status: 'scheduled',
                scheduledTime: { $gte: new Date() }
            })
                .sort({ scheduledTime: 1 })
                .limit(3);

            // Get contract phases for milestone tracking
            const contract = await Contract.findOne({ 
                $or: [
                    { workspaceId: workspaceId },
                    { _id: workspace.contractId }
                ]
            });

            // Calculate progress
            const totalPhases = contract?.phases?.length || 0;
            const completedPhases = contract?.phases?.filter(phase => phase.status === 'completed').length || 0;
            const overallProgress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

            const workspaceData = {
                workspaceId: workspace.workspaceId,
                contractId: workspace.contractId,
                projectId: workspace.projectId,
                clientId: workspace.clientId,
                freelancerId: workspace.freelancerId,
                projectTitle: workspace.projectTitle,
                serviceType: workspace.serviceType,
                status: workspace.status,
                currentPhase: workspace.currentPhase || 1,
                overallProgress: workspace.overallProgress || overallProgress,
                startDate: workspace.startDate,
                estimatedEndDate: workspace.estimatedEndDate,
                totalBudget: workspace.totalBudget,
                contractDetails: workspace.contractDetails || {},
                permissions: workspace.permissions || {
                    client: {
                        canApproveMilestones: true,
                        canRequestRevisions: true,
                        canUploadFiles: true,
                        canSendMessages: true,
                        canMakePayments: true
                    },
                    freelancer: {
                        canSubmitWork: true,
                        canUploadFiles: true,
                        canSendMessages: true,
                        canMarkComplete: false,
                        canTrackEarnings: true
                    }
                },
                lastActivity: workspace.lastActivity || new Date(),
                unreadMessages: workspace.unreadMessages || { client: 0, freelancer: 0 },
                createdAt: workspace.createdAt,
                updatedAt: workspace.updatedAt,
                
                // Populated data
                client: workspace.clientId,
                freelancer: workspace.freelancerId,
                project: workspace.projectId,
                
                // Additional data
                milestones: milestones,
                recentMessages: recentMessages,
                filesCount: filesCount,
                upcomingCalls: upcomingCalls,
                contractPhases: contract?.phases || [],
                
                // User info
                userRoleInWorkspace: workspaceRole,
                userPermissions: workspace.permissions?.[workspaceRole] || {
                    canUploadFiles: true,
                    canSendMessages: true,
                    canScheduleCalls: true,
                    canApproveMilestones: workspaceRole === 'client',
                    canSubmitWork: workspaceRole === 'freelancer',
                    canMakePayments: workspaceRole === 'client',
                    canTrackEarnings: workspaceRole === 'freelancer'
                }
            };

            res.json({
                success: true,
                workspace: workspaceData
            });
        } catch (error) {
            console.error("Get workspace details error:", error);
            res.status(500).json({
                success: false,
                message: error.message || "Server error fetching workspace details"
            });
        }
    },

    // Get workspace messages - FIXED VERSION
    getWorkspaceMessages: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;
            const { page = 1, limit = 50 } = req.query;

           const workspace = await Workspace.findById(workspaceId);


            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            // Check access
            const isClient = workspace.clientId && workspace.clientId._id.toString() === userId.toString();
            const isFreelancer = workspace.freelancerId && workspace.freelancerId._id.toString() === userId.toString();

            if (!isClient && !isFreelancer) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this workspace"
                });
            }

            const messages = await Message.find({ workspaceId })
                .populate('senderId', 'name profilePicture role')
                .sort({ timestamp: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalMessages = await Message.countDocuments({ workspaceId });

            // Mark messages as read for this user
            await Message.updateMany(
                {
                    workspaceId,
                    readBy: { $ne: userId }
                },
                {
                    $push: { readBy: userId }
                }
            );

            res.json({
                success: true,
                messages: messages.reverse(),
                totalPages: Math.ceil(totalMessages / limit),
                currentPage: parseInt(page),
                totalMessages
            });
        } catch (error) {
            console.error("Get workspace messages error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching messages"
            });
        }
    },

    // Send message - FIXED VERSION
    sendMessage: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const { workspaceId } = req.params;
            const { content, messageType = 'text', replyTo } = req.body;

            // Find workspace first
            const workspace = await Workspace.findOne({ workspaceId: workspaceId });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            // Check access
            const isClient = workspace.clientId && workspace.clientId._id.toString() === userId.toString();
            const isFreelancer = workspace.freelancerId && workspace.freelancerId._id.toString() === userId.toString();

            if (!isClient && !isFreelancer) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this workspace"
                });
            }

            const messageData = {
                workspaceId,
                senderId: userId,
                senderRole: userRole,
                content,
                messageType,
                timestamp: new Date(),
                readBy: [userId]
            };

            if (replyTo) {
                const parentMessage = await Message.findOne({
                    _id: replyTo,
                    workspaceId
                });

                if (parentMessage) {
                    messageData.replyTo = replyTo;
                    messageData.replyToContent = parentMessage.content.substring(0, 100);
                }
            }

            if (!messageData._id) {
                messageData._id = `msg_${Date.now()}`;
            }

            const newMessage = new Message(messageData);
            await newMessage.save();

            await newMessage.populate('senderId', 'name profilePicture role');
            if (replyTo) {
                await newMessage.populate('replyTo', 'content senderId');
            }

            // Socket.io real-time broadcast
            const io = req.app.get('io');
            if (io) {
                io.to(workspaceId).emit('new_message', newMessage);
            }

            res.status(201).json({
                success: true,
                message: "Message sent successfully",
                data: newMessage
            });
        } catch (error) {
            console.error("Send message error:", error);
            res.status(500).json({
                success: false,
                message: "Server error sending message"
            });
        }
    },

    // Get workspace files - FIXED VERSION
    getWorkspaceFiles: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;

         const workspace = await Workspace.findById(workspaceId);


            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            // Check access
            const isClient = workspace.clientId && workspace.clientId._id.toString() === userId.toString();
            const isFreelancer = workspace.freelancerId && workspace.freelancerId._id.toString() === userId.toString();

            if (!isClient && !isFreelancer) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this workspace"
                });
            }

            const files = await File.find({ workspaceId })
                .populate('uploadedBy', 'name profilePicture')
                .sort({ uploadDate: -1 });

            res.json({
                success: true,
                files
            });
        } catch (error) {
            console.error("Get workspace files error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching files"
            });
        }
    },

    // Upload file - FIXED VERSION
    uploadFile: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const { workspaceId } = req.params;
            const { filename, originalName, fileSize, fileType, fileUrl, description } = req.body;

          const workspace = await Workspace.findById(workspaceId);


            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            // Check access
            const isClient = workspace.clientId && workspace.clientId._id.toString() === userId.toString();
            const isFreelancer = workspace.freelancerId && workspace.freelancerId._id.toString() === userId.toString();

            if (!isClient && !isFreelancer) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this workspace"
                });
            }

            const fileData = {
                workspaceId,
                uploadedBy: userId,
                uploaderRole: userRole,
                filename,
                originalName,
                fileSize,
                fileType,
                fileUrl,
                description: description || '',
                uploadDate: new Date()
            };

            if (!fileData._id) {
                fileData._id = `file_${Date.now()}`;
            }

            const newFile = new File(fileData);
            await newFile.save();

            res.status(201).json({
                success: true,
                message: "File uploaded successfully",
                file: newFile
            });
        } catch (error) {
            console.error("Upload file error:", error);
            res.status(500).json({
                success: false,
                message: "Server error uploading file"
            });
        }
    },

 // In workspaceController.js, update the getWorkspaceMilestones function:
getWorkspaceMilestones: async (req, res) => {
  try {
    const userId = req.userId;
    const { workspaceId } = req.params;
    
    console.log('🔍 Fetching milestones for workspace:', workspaceId);
    
    // First, find the workspace to check access
    const workspace = await Workspace.findOne({ 
      workspaceId: workspaceId 
    });
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found"
      });
    }
    
    // Check access
    const isClient = workspace.clientId && workspace.clientId.toString() === userId.toString();
    const isFreelancer = workspace.freelancerId && workspace.freelancerId.toString() === userId.toString();
    
    if (!isClient && !isFreelancer) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this workspace"
      });
    }
    
    // Get milestones from the sharedData or from Milestone model
    let milestones = [];
    
    // Try to get from sharedData first
    if (workspace.sharedData && workspace.sharedData.sharedMilestones) {
      milestones = workspace.sharedData.sharedMilestones;
    } 
    // If not in sharedData, try Milestone model
    else {
      milestones = await Milestone.find({ workspaceId: workspaceId })
        .sort({ phaseNumber: 1 });
    }
    
    // Return the milestones
    res.json({
      success: true,
      milestones: milestones,
      currentPhase: workspace.sharedData?.currentPhase || 1,
      overallProgress: workspace.sharedData?.overallProgress || 0
    });
    
  } catch (error) {
    console.error("Get workspace milestones error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching milestones",
      error: error.message
    });
  }
},
    // Schedule video call - FIXED VERSION
    scheduleVideoCall: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const { workspaceId } = req.params;
            const { scheduledTime, title, description, duration = 60 } = req.body;

        const workspace = await Workspace.findById(workspaceId)

                .populate('clientId', 'name email')
                .populate('freelancerId', 'name email');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            // Check access
            const isClient = workspace.clientId && workspace.clientId._id.toString() === userId.toString();
            const isFreelancer = workspace.freelancerId && workspace.freelancerId._id.toString() === userId.toString();

            if (!isClient && !isFreelancer) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this workspace"
                });
            }

            // Create Daily.co room
            const dailyRoom = await dailyService.createRoom({
                privacy: 'private',
                properties: {
                    enable_chat: true,
                    enable_screenshare: true,
                    start_audio_off: false,
                    start_video_off: false,
                    exp: Math.round(new Date(scheduledTime).getTime() / 1000) + (duration * 60) + 3600,
                    max_participants: 4
                }
            });

            // Create video call record
            const callData = {
                workspaceId,
                scheduledBy: userId,
                scheduledTime: new Date(scheduledTime),
                title: title || 'Project Discussion',
                description: description || '',
                duration,
                status: 'scheduled',
                roomUrl: dailyRoom.url,
                roomName: dailyRoom.name,
                participants: [
                    {
                        userId: workspace.clientId._id,
                        role: 'client',
                        name: workspace.clientId.name,
                        email: workspace.clientId.email
                    },
                    {
                        userId: workspace.freelancerId._id,
                        role: 'freelancer',
                        name: workspace.freelancerId.name,
                        email: workspace.freelancerId.email
                    }
                ]
            };

            if (!callData._id) {
                callData._id = `call_${Date.now()}`;
            }

            const newCall = new VideoCall(callData);
            await newCall.save();

            // Socket.io notification to other participant
            const io = req.app.get('io');
            if (io) {
                const receiverId = userId === workspace.clientId._id.toString()
                    ? workspace.freelancerId._id
                    : workspace.clientId._id;

                io.to(receiverId.toString()).emit('call_scheduled', {
                    call: newCall,
                    scheduledBy: {
                        id: userId,
                        name: userRole === 'client' ? workspace.clientId.name : workspace.freelancerId.name,
                        role: userRole
                    }
                });
            }

            res.status(201).json({
                success: true,
                message: "Video call scheduled successfully",
                call: newCall
            });

        } catch (error) {
            console.error("Schedule video call error:", error);
            res.status(500).json({
                success: false,
                message: "Server error scheduling video call"
            });
        }
    },

    // Create instant video call - FIXED VERSION
    createInstantCall: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;

            const workspace = await Workspace.findById(workspaceId)

                .populate('clientId', 'name email')
                .populate('freelancerId', 'name email');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            // Check access
            const isClient = workspace.clientId && workspace.clientId._id.toString() === userId.toString();
            const isFreelancer = workspace.freelancerId && workspace.freelancerId._id.toString() === userId.toString();

            if (!isClient && !isFreelancer) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this workspace"
                });
            }

            // Create Daily.co room for instant call
            const dailyRoom = await dailyService.createRoom({
                privacy: 'private',
                properties: {
                    enable_chat: true,
                    enable_screenshare: true,
                    start_audio_off: false,
                    start_video_off: false,
                    exp: Math.round(Date.now() / 1000) + (60 * 60 * 2),
                    max_participants: 4
                }
            });

            const callData = {
                workspaceId,
                scheduledBy: userId,
                scheduledTime: new Date(),
                title: 'Instant Call',
                description: 'Instant video call session',
                duration: 0,
                status: 'in_progress',
                roomUrl: dailyRoom.url,
                roomName: dailyRoom.name,
                isInstant: true,
                participants: [
                    {
                        userId: workspace.clientId._id,
                        role: 'client',
                        name: workspace.clientId.name,
                        email: workspace.clientId.email
                    },
                    {
                        userId: workspace.freelancerId._id,
                        role: 'freelancer',
                        name: workspace.freelancerId.name,
                        email: workspace.freelancerId.email
                    }
                ]
            };

            if (!callData._id) {
                callData._id = `call_${Date.now()}`;
            }

            const newCall = new VideoCall(callData);
            await newCall.save();

            // Generate meeting token
            const meetingToken = await dailyService.createMeetingToken(
                dailyRoom.name,
                userId,
                req.userName || 'User',
                true
            );

            // Notify other participant about instant call
            const io = req.app.get('io');
            if (io) {
                const receiverId = userId === workspace.clientId._id.toString()
                    ? workspace.freelancerId._id
                    : workspace.clientId._id;

                io.to(receiverId.toString()).emit('instant_call_created', {
                    call: newCall,
                    initiatedBy: userId
                });
            }

            res.status(201).json({
                success: true,
                message: "Instant call created successfully",
                call: newCall,
                meetingToken
            });

        } catch (error) {
            console.error("Create instant call error:", error);
            res.status(500).json({
                success: false,
                message: "Server error creating instant call"
            });
        }
    },

    // Report issue from workspace - FIXED VERSION
    reportIssue: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const { workspaceId } = req.params;
            const { category, title, description, attachments } = req.body;

            
            const workspace = await Workspace.findById(workspaceId)

                .populate('clientId', 'name')
                .populate('freelancerId', 'name');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            // Check access
            const isClient = workspace.clientId && workspace.clientId._id.toString() === userId.toString();
            const isFreelancer = workspace.freelancerId && workspace.freelancerId._id.toString() === userId.toString();

            if (!isClient && !isFreelancer) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this workspace"
                });
            }

            // Determine reported user (opposite party)
            const reportedUserId = userRole === 'client'
                ? workspace.freelancerId._id
                : workspace.clientId._id;

            const reportedUserRole = userRole === 'client' ? 'freelancer' : 'client';

            const reportData = {
                reporterId: userId,
                reporterRole: userRole,
                reportedUserId,
                reportedUserRole,
                projectId: workspace.projectId,
                workspaceId,
                category,
                title,
                description,
                priority: ['payment_dispute', 'harassment', 'fraud'].includes(category) ? 'high' : 'medium',
                attachments: attachments || [],
                status: 'open'
            };

            if (!reportData._id) {
                reportData._id = `report_${Date.now()}`;
            }

            const newReport = new Report(reportData);
            await newReport.save();

            // Populate for response
            await newReport.populate('reportedUserId', 'name profilePicture');
            await newReport.populate('projectId', 'title');

            res.status(201).json({
                success: true,
                message: "Issue reported successfully. Admin will review it shortly.",
                report: newReport
            });
        } catch (error) {
            console.error("Report issue error:", error);
            res.status(500).json({
                success: false,
                message: "Server error reporting issue"
            });
        }
    },

    // Get workspace stats - FIXED VERSION
    getWorkspaceStats: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;

            // Find workspace first
            const workspace = await Workspace.findOne({ workspaceId: workspaceId })
                .populate('clientId', 'name')
                .populate('freelancerId', 'name');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            // Check access
            const isClient = workspace.clientId && workspace.clientId._id.toString() === userId.toString();
            const isFreelancer = workspace.freelancerId && workspace.freelancerId._id.toString() === userId.toString();

            if (!isClient && !isFreelancer) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this workspace"
                });
            }

            const milestones = await Milestone.find({ workspaceId });
            const filesCount = await File.countDocuments({ workspaceId });
            const messagesCount = await Message.countDocuments({ workspaceId });
            const unreadMessagesCount = await Message.countDocuments({
                workspaceId,
                readBy: { $ne: userId }
            });

            // Get video call stats
            const callStats = await VideoCall.aggregate([
                { $match: { workspaceId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const milestoneStats = {
                total: milestones.length,
                completed: milestones.filter(m => m.status === 'completed').length,
                inProgress: milestones.filter(m => m.status === 'in_progress').length,
                awaitingApproval: milestones.filter(m => m.status === 'awaiting_approval').length
            };

            res.json({
                success: true,
                stats: {
                    milestoneStats,
                    filesCount,
                    messagesCount,
                    unreadMessagesCount,
                    callStats,
                    overallProgress: workspace.overallProgress || 0,
                    currentPhase: workspace.currentPhase || 1
                }
            });
        } catch (error) {
            console.error("Get workspace stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching workspace stats"
            });
        }
    },
// In workspaceController.js - REPLACE the current getRoleBasedWorkspace function with this:

getRoleBasedWorkspace: async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole; // Should be set in route middleware as 'client' or 'freelancer'
    const { workspaceId } = req.params;

    console.log(`🔍 getRoleBasedWorkspace - Role: ${userRole}, User: ${userId}, Workspace: ${workspaceId}`);

    // Validate user role
    if (!userRole || !['client', 'freelancer'].includes(userRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role. Must be 'client' or 'freelancer'"
      });
    }

    // Find workspace with populated data
    const workspace = await Workspace.findOne({ 
      $or: [
        { workspaceId: workspaceId },
        { _id: workspaceId }
      ]
    })
    .populate('clientId', 'name email profilePicture companyName phone')
    .populate('freelancerId', 'name email profilePicture skills rating bio')
    .populate('projectId', 'title description budget category skillsRequired');

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found"
      });
    }

    // Verify user has access to this workspace
    let hasAccess = false;
    let workspaceRole = null;

    if (userRole === 'client') {
      hasAccess = workspace.clientId && workspace.clientId._id.toString() === userId.toString();
      workspaceRole = 'client';
    } else if (userRole === 'freelancer') {
      hasAccess = workspace.freelancerId && workspace.freelancerId._id.toString() === userId.toString();
      workspaceRole = 'freelancer';
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: `You don't have access to this workspace as a ${userRole}`
      });
    }

    // Get milestones
    const milestones = await Milestone.find({ workspaceId: workspace._id })
      .sort({ phaseNumber: 1 });

    // Get recent messages
    const recentMessages = await Message.find({ workspaceId: workspace._id })
      .populate('senderId', 'name profilePicture role')
      .sort({ timestamp: -1 })
      .limit(10);

    // Get files count
    const filesCount = await File.countDocuments({ workspaceId: workspace._id });

    // Get upcoming calls
    const upcomingCalls = await VideoCall.find({
      workspaceId: workspace._id,
      status: 'scheduled',
      scheduledTime: { $gte: new Date() }
    })
    .sort({ scheduledTime: 1 })
    .limit(3);

    // Get contract for phases
    const contract = await Contract.findOne({ 
      $or: [
        { workspaceId: workspace._id },
        { _id: workspace.contractId }
      ]
    });

    // Calculate progress
    const totalPhases = contract?.phases?.length || milestones.length || 0;
    const completedPhases = milestones.filter(m => m.status === 'completed').length;
    const overallProgress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

    // Build response data
    const workspaceData = {
      _id: workspace._id,
      workspaceId: workspace.workspaceId || workspace._id,
      title: workspace.title || workspace.projectTitle || 'Untitled Project',
      projectTitle: workspace.projectTitle,
      serviceType: workspace.serviceType,
      status: workspace.status,
      currentPhase: workspace.currentPhase || 1,
      overallProgress: workspace.overallProgress || overallProgress,
      startDate: workspace.startDate,
      estimatedEndDate: workspace.estimatedEndDate,
      totalBudget: workspace.totalBudget,
      
      // Client and freelancer info
      client: workspace.clientId,
      freelancer: workspace.freelancerId,
      project: workspace.projectId,
      
      // Additional data
      milestones: milestones,
      recentMessages: recentMessages,
      filesCount: filesCount,
      upcomingCalls: upcomingCalls,
      contractPhases: contract?.phases || [],
      
      // User info
      userRoleInWorkspace: workspaceRole,
      userPermissions: workspaceRole === 'client' ? {
        canApproveMilestones: true,
        canRequestRevisions: true,
        canUploadFiles: true,
        canSendMessages: true,
        canMakePayments: true,
        canScheduleCalls: true
      } : {
        canSubmitWork: true,
        canUploadFiles: true,
        canSendMessages: true,
        canMarkComplete: false,
        canTrackEarnings: true,
        canScheduleCalls: true
      },
      
      // Timestamps
      lastActivity: workspace.lastActivity || new Date(),
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt
    };

    res.json({
      success: true,
      message: `${userRole} workspace loaded successfully`,
      workspace: workspaceData
    });

  } catch (error) {
    console.error("❌ getRoleBasedWorkspace error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching workspace",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
},
  
  // Get shared workspace messages
  getSharedMessages: async (req, res) => {
    try {
      const userId = req.userId;
      const userRole = req.userRole;
      const { workspaceId } = req.params;
      
      const workspace = await Workspace.findOne({ workspaceId });
      
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: "Workspace not found"
        });
      }
      
      // Check access
      const hasAccess = userRole === 'client' 
        ? workspace.clientId.toString() === userId.toString()
        : workspace.freelancerId.toString() === userId.toString();
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
      
      // Mark messages as read for this user
      workspace.markMessagesAsRead(userRole, userId);
      await workspace.save();
      
      res.json({
        success: true,
        messages: workspace.sharedData.sharedMessages,
        unreadCount: userRole === 'client' 
          ? workspace.sharedData.unreadMessages.client
          : workspace.sharedData.unreadMessages.freelancer
      });
    } catch (error) {
      console.error("Get shared messages error:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching messages"
      });
    }
  },
  
  // Send message to shared workspace
  sendSharedMessage: async (req, res) => {
    try {
      const userId = req.userId;
      const userRole = req.userRole;
      const { workspaceId } = req.params;
      const { content, messageType = 'text' } = req.body;
      
      const WorkspaceService = require('../Services/WorkspaceService');
      
      const messageData = {
        senderId: userId,
        senderRole: userRole,
        content,
        messageType,
        readBy: [userId]
      };
      
      const result = await WorkspaceService.addSharedMessage(workspaceId, messageData);
      
      // Socket.io broadcast
      const io = req.app.get('io');
      if (io) {
        io.to(workspaceId).emit('new_shared_message', result);
      }
      
      res.status(201).json({
        success: true,
        message: "Message sent successfully",
        data: result
      });
    } catch (error) {
      console.error("Send shared message error:", error);
      res.status(500).json({
        success: false,
        message: "Server error sending message"
      });
    }
  },
  
  // Get private notes (role-specific)
  getPrivateNotes: async (req, res) => {
    try {
      const userId = req.userId;
      const userRole = req.userRole;
      const { workspaceId } = req.params;
      
      const workspace = await Workspace.findOne({ workspaceId });
      
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: "Workspace not found"
        });
      }
      
      // Check access
      const hasAccess = userRole === 'client' 
        ? workspace.clientId.toString() === userId.toString()
        : workspace.freelancerId.toString() === userId.toString();
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
      
      const notes = userRole === 'client' 
        ? workspace.clientData.privateNotes
        : workspace.freelancerData.privateNotes;
      
      res.json({
        success: true,
        notes
      });
    } catch (error) {
      console.error("Get private notes error:", error);
      res.status(500).json({
        success: false,
        message: "Server error fetching private notes"
      });
    }
  },
  
  // Add private note (role-specific)
  addPrivateNote: async (req, res) => {
    try {
      const userId = req.userId;
      const userRole = req.userRole;
      const { workspaceId } = req.params;
      const { content } = req.body;
      
      const WorkspaceService = require('../Services/WorkspaceService');
      
      const result = await WorkspaceService.addPrivateNote(workspaceId, userRole, { content });
      
      res.status(201).json({
        success: true,
        message: "Private note added successfully",
        data: result
      });
    } catch (error) {
      console.error("Add private note error:", error);
      res.status(500).json({
        success: false,
        message: "Server error adding private note"
      });
    }
  },
  
  // Submit milestone work (freelancer only)
  submitMilestoneWork: async (req, res) => {
    try {
      const userId = req.userId;
      const { workspaceId, milestoneId } = req.params;
      const { files, description } = req.body;
      
      // Verify user is freelancer
      const workspace = await Workspace.findOne({ workspaceId });
      
      if (!workspace || workspace.freelancerId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Only freelancer can submit work"
        });
      }
      
      const milestone = workspace.sharedData.sharedMilestones.find(m => m.milestoneId === milestoneId);
      
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: "Milestone not found"
        });
      }
      
      // Update milestone status
      milestone.status = 'awaiting_approval';
      milestone.submittedDate = new Date();
      
      // Add to freelancer's submission history
      workspace.freelancerData.submissionHistory.push({
        submissionId: `sub_${Date.now()}`,
        milestoneId,
        files: files || [],
        description: description || '',
        submittedDate: new Date(),
        status: 'awaiting_approval'
      });
      
      await workspace.save();
      
      res.json({
        success: true,
        message: "Work submitted successfully",
        milestone
      });
    } catch (error) {
      console.error("Submit milestone work error:", error);
      res.status(500).json({
        success: false,
        message: "Server error submitting work"
      });
    }
  },
  
  // Approve milestone (client only)
  approveMilestone: async (req, res) => {
    try {
      const userId = req.userId;
      const { workspaceId, milestoneId } = req.params;
      const { feedback, paymentAmount } = req.body;
      
      // Verify user is client
      const workspace = await Workspace.findOne({ workspaceId });
      
      if (!workspace || workspace.clientId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Only client can approve milestones"
        });
      }
      
      const WorkspaceService = require('../Services/WorkspaceService');
      const milestone = await WorkspaceService.updateMilestoneStatus(workspaceId, milestoneId, 'approved', feedback);
      
      // Update client's budget tracking
      if (paymentAmount) {
        workspace.clientData.paymentHistory.push({
          paymentId: `pay_${Date.now()}`,
          amount: paymentAmount,
          description: `Payment for milestone: ${milestone.title}`,
          status: 'completed',
          date: new Date(),
          milestoneId
        });
        
        workspace.clientData.budgetTracking.paidAmount += paymentAmount;
        workspace.clientData.budgetTracking.pendingAmount -= paymentAmount;
        
        // Update freelancer's earnings tracking
        workspace.freelancerData.earningsTracking.totalEarned += paymentAmount;
        workspace.freelancerData.earningsTracking.pendingEarnings -= paymentAmount;
        workspace.freelancerData.earningsTracking.completedMilestones += 1;
        workspace.freelancerData.earningsTracking.transactions.push({
          date: new Date(),
          amount: paymentAmount,
          description: `Earnings from milestone: ${milestone.title}`,
          status: 'paid'
        });
      }
      
      await workspace.save();
      
      res.json({
        success: true,
        message: "Milestone approved successfully",
        milestone
      });
    } catch (error) {
      console.error("Approve milestone error:", error);
      res.status(500).json({
        success: false,
        message: "Server error approving milestone"
      });
    }
  }

};

module.exports = workspaceController;