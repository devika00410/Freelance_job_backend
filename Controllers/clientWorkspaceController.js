const Workspace = require('../Models/Workspace');
const Milestone = require('../Models/Milestone');
const Contract = require('../Models/Contract');
const Message = require('../Models/Message');
const File = require('../Models/File');

const clientWorkspaceController = {
    getClientWorkspaces: async (req, res) => {
        try {
            const clientId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { clientId };
            if (status && status !== 'all') {
                query.status = status;
            }

            const workspaces = await Workspace.find(query)
                .populate('projectId', 'title description budget')
                .populate('freelancerId', 'name profilePicture rating skills')
                .populate('clientId', 'name companyName email')
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

    getWorkspaceDetails: async (req, res) => {
        try {
            const clientId = req.userId;
            const { workspaceId } = req.params;

            const workspace = await Workspace.findOne({
                workspaceId: workspaceId,
                clientId
            })
                .populate('projectId', 'title description budget category')
                .populate('freelancerId', 'name profilePicture rating skills email')
                .populate('clientId', 'name companyName email');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            const milestones = await Milestone.find({ workspaceId }).sort({ phaseNumber: 1 });
            const recentMessages = await Message.find({ workspaceId })
                .populate('senderId', 'name profilePicture role')
                .sort({ timestamp: -1 })
                .limit(10);
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

    approveMilestone: async (req, res) => {
        try {
            const clientId = req.userId;
            const { workspaceId, milestoneId } = req.params;
            const { feedback } = req.body;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                clientId
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

            if (milestone.status !== 'awaiting_approval') {
                return res.status(400).json({
                    success: false,
                    message: "Milestone is not awaiting approval"
                });
            }

            milestone.status = 'completed';
            milestone.progress.clientApproved = true;
            milestone.progress.clientFeedback = feedback || '';
            milestone.progress.approvedDate = new Date();

            await milestone.save();

            // Update workspace progress
            const totalMilestones = await Milestone.countDocuments({ workspaceId });
            const completedMilestones = await Milestone.countDocuments({
                workspaceId,
                status: 'completed'
            });
            workspace.overallProgress = Math.round((completedMilestones / totalMilestones) * 100);
            workspace.currentPhase = milestone.phaseNumber + 1;
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
    },

    requestMilestoneRevision: async (req, res) => {
        try {
            const clientId = req.userId;
            const { workspaceId, milestoneId } = req.params;
            const { revisionNotes } = req.body;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                clientId
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

            if (milestone.status !== 'awaiting_approval') {
                return res.status(400).json({
                    success: false,
                    message: "Cannot request revision for this milestone"
                });
            }

            milestone.status = 'in_progress';
            milestone.progress.revisionRequested = true;
            milestone.progress.revisionNotes = revisionNotes;
            milestone.progress.revisionRequestedAt = new Date();

            await milestone.save();

            res.json({
                success: true,
                message: "Revision requested successfully",
                milestone
            });
        } catch (error) {
            console.error("Request milestone revision error:", error);
            res.status(500).json({
                success: false,
                message: "Server error requesting revision"
            });
        }
    },

    getWorkspaceMilestones: async (req, res) => {
        try {
            const clientId = req.userId;
            const { workspaceId } = req.params;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                clientId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found"
                });
            }

            const milestones = await Milestone.find({ workspaceId }).sort({ phaseNumber: 1 });
            const contract = await Contract.findOne({
                projectId: workspace.projectId,
                clientId
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

    getWorkspaceFiles: async (req, res) => {
        try {
            const clientId = req.userId;
            const { workspaceId } = req.params;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                clientId
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

    getWorkspaceStats: async (req, res) => {
        try {
            const clientId = req.userId;
            const { workspaceId } = req.params;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                clientId
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

module.exports = clientWorkspaceController;