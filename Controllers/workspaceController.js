const Workspace = require('../Models/Workspace');
const Message = require('../Models/Message');
const File = require('../Models/File');
const Milestone = require('../Models/Milestone');
const Report = require('../Models/Report');
const VideoCall = require('../Models/VideoCall');
const dailyService = require('../services/dailyService');
const Contract = require('../Models/Contract')

const workspaceController = {
    // Get workspace details (common for both)
    getWorkspaceDetails: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const { workspaceId } = req.params;

            // Verify user has access to this workspace
            const workspace = await Workspace.findOne({
                workspaceId: workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            })
                .populate('projectId', 'title description budget category')
                .populate('clientId', 'name companyName profilePicture email')
                .populate('freelancerId', 'name profilePicture rating skills email');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
                });
            }

            // Get common workspace data
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

            const workspaceData = {
                ...workspace.toObject(),
                milestones,
                recentMessages,
                filesCount,
                upcomingCalls,
                userRole // Include role for frontend to show appropriate buttons
            };

            res.json({
                success: true,
                workspace: workspaceData
            });
        } catch (error) {
            console.error("Get workspace details error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching workspace details"
            });
        }
    },

    // Get workspace messages (common for both)
    getWorkspaceMessages: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;
            const { page = 1, limit = 50 } = req.query;

            // Verify access
            const workspace = await Workspace.findOne({
                workspaceId: workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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
                messages: messages.reverse(), // Return in chronological order
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

    // Send message (common for both)
    sendMessage: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const { workspaceId } = req.params;
            const { content, messageType = 'text', replyTo } = req.body;

            // Verify access
            const workspace = await Workspace.findOne({
                workspaceId: workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
                });
            }

            const messageData = {
                workspaceId,
                senderId: userId,
                senderRole:userRole,
                content,
                messageType,
                timestamp: new Date(),
                readBy: [userId] // Sender has read the message
            };

            // Add reply reference if provided
            if (replyTo) {
                const parentMessage = await Message.findOne({
                    _id: replyTo,
                    workspaceId
                });
                
                if (parentMessage) {
                    messageData.replyTo = replyTo;
                    messageData.replyToContent = parentMessage.content.substring(0, 100); // Preview
                }
            }

            if (!messageData._id) {
                messageData._id = `msg_${Date.now()}`;
            }

            const newMessage = new Message(messageData);
            await newMessage.save();

            // Populate for response
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

    // Get workspace files (common for both)
    getWorkspaceFiles: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;

            // Verify access
            const workspace = await Workspace.findOne({
                workspaceId: workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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

    // Upload file (common for both)
    uploadFile: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const { workspaceId } = req.params;
            const { filename, originalName, fileSize, fileType, fileUrl, description } = req.body;

            // Verify access
            const workspace = await Workspace.findOne({
                workspaceId: workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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

    // Get workspace milestones (common for both - read only)
    getWorkspaceMilestones: async (req, res) => {
    try {
        const userId = req.userId;
        const { workspaceId } = req.params;

        console.log('Getting workspace milestones - User:', userId, 'Workspace:', workspaceId);

        // 1. Find workspace and verify access
        const workspace = await Workspace.findOne({
            workspaceId: workspaceId,
            $or: [
                { clientId: userId },
                { freelancerId: userId }
            ]
        });

        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: "Workspace not found"
            });
        }

        // 2. Find contract for milestones
        const contract = await Contract.findOne({
            projectId: workspace.projectId,
            $or: [
                { clientId: userId },
                { freelancerId: userId }
            ]
        });

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found"
            });
        }

        // 3. Return milestones
        const milestones = contract.phases || [];

        res.json({
            success: true,
            milestones: milestones,
            currentPhase: workspace.currentPhase,
            overallProgress: workspace.overallProgress
        });

    } catch (error) {
        console.error("Get workspace milestones error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching milestones"
        });
    }
},

    // Schedule video call with Daily.co integration
    scheduleVideoCall: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const { workspaceId } = req.params;
            const { scheduledTime, title, description, duration = 60 } = req.body;

            // Verify access
            const workspace = await Workspace.findOne({
                workspaceId: workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            })
                .populate('clientId', 'name email')
                .populate('freelancerId', 'name email');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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
                    exp: Math.round(new Date(scheduledTime).getTime() / 1000) + (duration * 60) + 3600, // Room expires 1 hour after call end
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

    // Create instant video call
    createInstantCall: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;

            // Verify access
            const workspace = await Workspace.findOne({
                workspaceId: workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            })
                .populate('clientId', 'name email')
                .populate('freelancerId', 'name email');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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
                    exp: Math.round(Date.now() / 1000) + (60 * 60 * 2), // 2 hours expiry
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

    // Report issue from workspace (common for both)
    reportIssue: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const { workspaceId } = req.params;
            const { category, title, description, attachments } = req.body;

            // Verify access and get workspace details
            const workspace = await Workspace.findOne({
                workspaceId: workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            })
                .populate('clientId', 'name')
                .populate('freelancerId', 'name');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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

    // Get workspace stats (common for both)
    getWorkspaceStats: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;

            // Verify access
            const workspace = await Workspace.findOne({
                workspaceId: workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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
                    overallProgress: workspace.overallProgress,
                    currentPhase: workspace.currentPhase
                }
            });
        } catch (error) {
            console.error("Get workspace stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching workspace stats"
            });
        }
    }
};

module.exports = workspaceController;