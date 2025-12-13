const Workspace = require('../Models/Workspace');
const Contract = require('../Models/Contract');
const Milestone = require('../Models/Milestone');
const Message = require('../Models/Message');
const File = require('../Models/File');

const freelancerWorkspaceController = {
    // Get all workspaces for freelancer
    getFreelancerWorkspaces: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { freelancerId };
            if (status && status !== 'all') {
                query.status = status;
            }

            const workspaces = await Workspace.find(query)
                .populate('projectId', 'title description category budget')
                .populate('clientId', 'name companyName profilePicture rating')
                .populate('freelancerId', 'name profilePicture rating skills email')
                .sort({ updatedAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);
                
            const totalWorkspaces = await Workspace.countDocuments(query);

            res.json({
                success: true,
                workspaces,
                totalPages: Math.ceil(totalWorkspaces / limit),
                currentPage: parseInt(page),
                totalWorkspaces
            });

        } catch (error) {
            console.error("Get workspaces error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching workspaces"
            });
        }
    },

    // Get single workspace details
    getWorkspaceDetails: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { workspaceId } = req.params;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                freelancerId
            })
                .populate('projectId', 'title description budget category skillsRequired duration')
                .populate('clientId', 'name companyName profilePicture rating email phone')
                .populate('freelancerId', 'name profilePicture rating skills email phone');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            // Get milestones for this workspace
            const milestones = await Milestone.find({ workspaceId })
                .sort({ phaseNumber: 1 });

            // Get recent messages
            const recentMessages = await Message.find({ workspaceId })
                .populate('senderId', 'name profilePicture role')
                .sort({ timestamp: -1 })
                .limit(10);

            // Get files count
            const filesCount = await File.countDocuments({ workspaceId });

            const workspaceData = {
                ...workspace.toObject(),
                milestones,
                recentMessages,
                filesCount
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

    // Submit work for milestone
    submitMilestoneWork: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { workspaceId, milestoneId } = req.params;
            const { submittedWork, notes } = req.body;

            // Verify workspace access
            const workspace = await Workspace.findOne({
                _id: workspaceId,
                freelancerId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            const milestone = await Milestone.findOne({
                _id: milestoneId,
                workspaceId
            });

            if (!milestone) {
                return res.status(404).json({
                    success: false,
                    message: "Milestone not found"
                });
            }

            if (milestone.status !== 'in_progress') {
                return res.status(400).json({
                    success: false,
                    message: "Milestone is not in progress"
                });
            }

            // Update milestone with submitted work
            milestone.status = 'awaiting_approval';
            milestone.progress.submittedWork = submittedWork;
            milestone.progress.freelancerSubmitted = new Date();
            milestone.progress.notes = notes;
            milestone.progress.clientApproved = false;

            await milestone.save();

            // Update workspace progress if needed
            if (milestone.phaseNumber > workspace.currentPhase) {
                workspace.currentPhase = milestone.phaseNumber;
                await workspace.save();
            }

            res.json({
                success: true,
                message: "Work submitted successfully for client approval",
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

    // Get workspace milestones
    getWorkspaceMilestones: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { workspaceId } = req.params;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                freelancerId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            const milestones = await Milestone.find({ workspaceId })
                .sort({ phaseNumber: 1 });

            const contract = await Contract.findOne({
                projectId: workspace.projectId,
                freelancerId
            });

            res.json({
                success: true,
                milestones,
                currentPhase: workspace.currentPhase,
                contractPhases: contract?.phases || []
            });
        } catch (error) {
            console.error("Get workspace milestones error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching milestones"
            });
        }
    },

    // Upload file to workspace
    uploadWorkspaceFile: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { workspaceId } = req.params;
            const fileData = req.body;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                freelancerId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            fileData.workspaceId = workspaceId;
            fileData.uploadedBy = freelancerId;
            fileData.uploaderRole = 'freelancer';

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

    // Get workspace files
    getWorkspaceFiles: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { workspaceId } = req.params;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                freelancerId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
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

    // Get workspace chat messages
    getWorkspaceMessages: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { workspaceId } = req.params;
            const { page = 1, limit = 50 } = req.query;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                freelancerId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            const messages = await Message.find({ workspaceId })
                .populate('senderId', 'name profilePicture role')
                .sort({ timestamp: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalMessages = await Message.countDocuments({ workspaceId });

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

    // Get workspace statistics
    getWorkspaceStats: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { workspaceId } = req.params;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                freelancerId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            const milestones = await Milestone.find({ workspaceId });
            const filesCount = await File.countDocuments({ workspaceId });
            const messagesCount = await Message.countDocuments({ workspaceId });
            const unreadMessagesCount = await Message.countDocuments({
                workspaceId,
                readBy: { $ne: freelancerId }
            });

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

module.exports = freelancerWorkspaceController;