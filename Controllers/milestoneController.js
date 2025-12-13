const Milestone = require('../Models/Milestone');
const Workspace = require('../Models/Workspace');
const Contract = require('../Models/Contract');

const milestoneController = {
    // Get all milestones for a workspace
    getMilestones: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;

            // Verify user has access to workspace
            const workspace = await Workspace.findOne({
                _id: workspaceId,
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

            const milestones = await Milestone.find({ workspaceId })
                .sort({ phaseNumber: 1 });

            res.json({
                success: true,
                milestones,
                currentPhase: workspace.currentPhase,
                overallProgress: workspace.overallProgress
            });

        } catch (error) {
            console.error("Get milestones error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching milestones"
            });
        }
    },

    // Get single milestone details
    getMilestoneDetails: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId, milestoneId } = req.params;

            // Verify user has access to workspace
            const workspace = await Workspace.findOne({
                _id: workspaceId,
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

            res.json({
                success: true,
                milestone
            });

        } catch (error) {
            console.error("Get milestone details error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching milestone details"
            });
        }
    },

    // Create milestone (admin/client function - for setting up project)
    createMilestone: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;
            const { phaseNumber, phaseTitle, description, dueDate, phaseAmount, deliverables } = req.body;

            // Verify user has access and is client
            const workspace = await Workspace.findOne({
                _id: workspaceId,
                clientId: userId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
                });
            }

            const milestoneData = {
                workspaceId,
                phaseNumber,
                phaseTitle,
                description,
                dueDate: new Date(dueDate),
                phaseAmount,
                deliverables: deliverables || [],
                status: 'pending',
                progress: {
                    currentStatus: 'not_started',
                    freelancerSubmitted: null,
                    clientApproved: false,
                    submittedWork: [],
                    clientFeedback: ''
                }
            };

            if (!milestoneData._id) {
                milestoneData._id = `milestone_${Date.now()}`;
            }

            const newMilestone = new Milestone(milestoneData);
            await newMilestone.save();

            res.status(201).json({
                success: true,
                message: "Milestone created successfully",
                milestone: newMilestone
            });

        } catch (error) {
            console.error("Create milestone error:", error);
            res.status(500).json({
                success: false,
                message: "Server error creating milestone"
            });
        }
    },

    // Update milestone (client function)
    updateMilestone: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId, milestoneId } = req.params;
            const updateData = req.body;

            // Verify user has access and is client
            const workspace = await Workspace.findOne({
                _id: workspaceId,
                clientId: userId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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

            // Prevent updating certain fields
            delete updateData._id;
            delete updateData.workspaceId;
            delete updateData.progress;
            delete updateData.status;

            // Only allow updates if milestone is not in progress or completed
            if (milestone.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: "Cannot update milestone that is already in progress"
                });
            }

            if (updateData.dueDate) {
                updateData.dueDate = new Date(updateData.dueDate);
            }

            const updatedMilestone = await Milestone.findByIdAndUpdate(
                milestoneId,
                updateData,
                { new: true, runValidators: true }
            );

            res.json({
                success: true,
                message: "Milestone updated successfully",
                milestone: updatedMilestone
            });

        } catch (error) {
            console.error("Update milestone error:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating milestone"
            });
        }
    },

    // Start working on milestone (freelancer)
    startMilestone: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId, milestoneId } = req.params;

            // Verify user has access and is freelancer
            const workspace = await Workspace.findOne({
                _id: workspaceId,
                freelancerId: userId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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

            if (milestone.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: "Milestone cannot be started in current status"
                });
            }

            milestone.status = 'in_progress';
            milestone.progress.currentStatus = 'in_progress';
            milestone.startedAt = new Date();
            await milestone.save();

            // Socket.io notification to client
            const io = req.app.get('io');
            if (io) {
                io.to(workspaceId).emit('milestone_started', {
                    workspaceId,
                    milestoneId,
                    milestoneTitle: milestone.phaseTitle,
                    startedBy: userId
                });
            }

            res.json({
                success: true,
                message: "Milestone work started",
                milestone
            });

        } catch (error) {
            console.error("Start milestone error:", error);
            res.status(500).json({
                success: false,
                message: "Server error starting milestone"
            });
        }
    },

    // Submit milestone work (freelancer)
    submitWork: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId, milestoneId } = req.params;
            const { submittedWork, notes } = req.body;

            // Verify user has access and is freelancer
            const workspace = await Workspace.findOne({
                _id: workspaceId,
                freelancerId: userId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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

            milestone.status = 'awaiting_approval';
            milestone.progress.currentStatus = 'awaiting_client_approval';
            milestone.progress.submittedWork = submittedWork || [];
            milestone.progress.freelancerSubmitted = new Date();
            milestone.progress.notes = notes || '';
            milestone.progress.clientApproved = false;
            await milestone.save();

            // Socket.io notification to client
            const io = req.app.get('io');
            if (io) {
                io.to(workspaceId).emit('milestone_submitted', {
                    workspaceId,
                    milestoneId,
                    milestoneTitle: milestone.phaseTitle,
                    submittedBy: userId
                });
            }

            res.json({
                success: true,
                message: "Work submitted for client approval",
                milestone
            });

        } catch (error) {
            console.error("Submit work error:", error);
            res.status(500).json({
                success: false,
                message: "Server error submitting work"
            });
        }
    },

    // Approve milestone (client)
    approveMilestone: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId, milestoneId } = req.params;
            const { feedback } = req.body;

            // Verify user has access and is client
            const workspace = await Workspace.findOne({
                _id: workspaceId,
                clientId: userId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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
            milestone.progress.currentStatus = 'completed';
            milestone.progress.clientApproved = true;
            milestone.progress.clientFeedback = feedback || '';
            milestone.progress.approvedDate = new Date();
            milestone.completedAt = new Date();
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

            // Socket.io notification to freelancer
            const io = req.app.get('io');
            if (io) {
                io.to(workspaceId).emit('milestone_approved', {
                    workspaceId,
                    milestoneId,
                    milestoneTitle: milestone.phaseTitle,
                    approvedBy: userId,
                    feedback: feedback
                });
            }

            res.json({
                success: true,
                message: "Milestone approved successfully",
                milestone,
                workspaceProgress: workspace.overallProgress
            });

        } catch (error) {
            console.error("Approve milestone error:", error);
            res.status(500).json({
                success: false,
                message: "Server error approving milestone"
            });
        }
    },

    // Request revision (client)
    requestRevision: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId, milestoneId } = req.params;
            const { revisionNotes } = req.body;

            // Verify user has access and is client
            const workspace = await Workspace.findOne({
                _id: workspaceId,
                clientId: userId
            });

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
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

            milestone.status = 'revision_requested';
            milestone.progress.currentStatus = 'revision_requested';
            milestone.progress.revisionRequested = true;
            milestone.progress.revisionNotes = revisionNotes;
            milestone.progress.revisionRequestedAt = new Date();
            await milestone.save();

            // Socket.io notification to freelancer
            const io = req.app.get('io');
            if (io) {
                io.to(workspaceId).emit('revision_requested', {
                    workspaceId,
                    milestoneId,
                    milestoneTitle: milestone.phaseTitle,
                    requestedBy: userId,
                    revisionNotes: revisionNotes
                });
            }

            res.json({
                success: true,
                message: "Revision requested successfully",
                milestone
            });

        } catch (error) {
            console.error("Request revision error:", error);
            res.status(500).json({
                success: false,
                message: "Server error requesting revision"
            });
        }
    },

    // Get milestone statistics
    getMilestoneStats: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;

            // Verify user has access to workspace
            const workspace = await Workspace.findOne({
                _id: workspaceId,
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

            const stats = {
                total: milestones.length,
                completed: milestones.filter(m => m.status === 'completed').length,
                inProgress: milestones.filter(m => m.status === 'in_progress').length,
                awaitingApproval: milestones.filter(m => m.status === 'awaiting_approval').length,
                revisionRequested: milestones.filter(m => m.status === 'revision_requested').length,
                pending: milestones.filter(m => m.status === 'pending').length
            };

            // Calculate completion rate
            stats.completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

            // Calculate average completion time for completed milestones
            const completedMilestones = milestones.filter(m => m.status === 'completed');
            if (completedMilestones.length > 0) {
                const totalTime = completedMilestones.reduce((sum, milestone) => {
                    if (milestone.startedAt && milestone.completedAt) {
                        return sum + (milestone.completedAt - milestone.startedAt);
                    }
                    return sum;
                }, 0);
                stats.averageCompletionTime = totalTime / completedMilestones.length;
            }

            res.json({
                success: true,
                stats,
                overallProgress: workspace.overallProgress,
                currentPhase: workspace.currentPhase
            });

        } catch (error) {
            console.error("Get milestone stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching milestone statistics"
            });
        }
    }
};

module.exports = milestoneController;