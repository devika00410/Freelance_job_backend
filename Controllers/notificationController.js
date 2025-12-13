const Notification = require('../Models/Notification');
const User = require('../Models/User');

const notificationController = {
    // Get user notifications
    getNotifications: async (req, res) => {
        try {
            const userId = req.userId;
            const { page = 1, limit = 20, unreadOnly = false } = req.query;

            let query = { userId };
            if (unreadOnly === 'true') {
                query.isRead = false;
            }

            const notifications = await Notification.find(query)
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalNotifications = await Notification.countDocuments(query);
            const unreadCount = await Notification.countDocuments({
                userId,
                isRead: false
            });

            res.json({
                success: true,
                notifications,
                totalPages: Math.ceil(totalNotifications / limit),
                currentPage: parseInt(page),
                totalNotifications,
                unreadCount
            });

        } catch (error) {
            console.error("Get notifications error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching notifications"
            });
        }
    },

    // Mark notification as read
    markAsRead: async (req, res) => {
        try {
            const userId = req.userId;
            const { notificationId } = req.params;

            const notification = await Notification.findOne({
                _id: notificationId,
                userId
            });

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found"
                });
            }

            notification.isRead = true;
            notification.readAt = new Date();
            await notification.save();

            res.json({
                success: true,
                message: "Notification marked as read",
                notification
            });

        } catch (error) {
            console.error("Mark as read error:", error);
            res.status(500).json({
                success: false,
                message: "Server error marking notification as read"
            });
        }
    },

    // Mark all notifications as read
    markAllAsRead: async (req, res) => {
        try {
            const userId = req.userId;

            const result = await Notification.updateMany(
                {
                    userId,
                    isRead: false
                },
                {
                    isRead: true,
                    readAt: new Date()
                }
            );

            res.json({
                success: true,
                message: "All notifications marked as read",
                updatedCount: result.modifiedCount
            });

        } catch (error) {
            console.error("Mark all as read error:", error);
            res.status(500).json({
                success: false,
                message: "Server error marking notifications as read"
            });
        }
    },

    // Delete a notification
    deleteNotification: async (req, res) => {
        try {
            const userId = req.userId;
            const { notificationId } = req.params;

            const notification = await Notification.findOneAndDelete({
                _id: notificationId,
                userId
            });

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found"
                });
            }

            res.json({
                success: true,
                message: "Notification deleted successfully"
            });

        } catch (error) {
            console.error("Delete notification error:", error);
            res.status(500).json({
                success: false,
                message: "Server error deleting notification"
            });
        }
    },

    // Clear all notifications
    clearAll: async (req, res) => {
        try {
            const userId = req.userId;

            const result = await Notification.deleteMany({ userId });

            res.json({
                success: true,
                message: "All notifications cleared",
                deletedCount: result.deletedCount
            });

        } catch (error) {
            console.error("Clear all notifications error:", error);
            res.status(500).json({
                success: false,
                message: "Server error clearing notifications"
            });
        }
    },

    // Get notification statistics
    getNotificationStats: async (req, res) => {
        try {
            const userId = req.userId;

            const stats = await Notification.aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: '$category',
                        total: { $sum: 1 },
                        unread: {
                            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
                        }
                    }
                }
            ]);

            const typeStats = await Notification.aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const totalStats = await Notification.aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        unread: {
                            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
                        },
                        highPriority: {
                            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
                        }
                    }
                }
            ]);

            res.json({
                success: true,
                stats: {
                    categoryDistribution: stats,
                    typeDistribution: typeStats,
                    overview: totalStats[0] || {
                        total: 0,
                        unread: 0,
                        highPriority: 0
                    }
                }
            });

        } catch (error) {
            console.error("Get notification stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching notification statistics"
            });
        }
    }
};

// Notification Service - Used by other controllers to create notifications
const notificationService = {
    // Create a new notification
    createNotification: async (notificationData) => {
        try {
            if (!notificationData._id) {
                notificationData._id = `notif_${Date.now()}`;
            }

            const notification = new Notification(notificationData);
            await notification.save();

            // Socket.io real-time notification
            // This would be called from the main server file
            // io.to(notificationData.userId).emit('new_notification', notification);

            return notification;
        } catch (error) {
            console.error("Create notification service error:", error);
            throw error;
        }
    },

    // Notify both client and freelancer in a workspace
    notifyWorkspaceUsers: async (workspaceId, notificationData) => {
        try {
            const workspace = await require('../Models/Workspace').findById(workspaceId);
            if (!workspace) return;

            const notifications = [];

            // Notify client
            if (workspace.clientId) {
                const clientNotification = {
                    ...notificationData,
                    userId: workspace.clientId,
                    metadata: {
                        ...notificationData.metadata,
                        workspaceId
                    }
                };
                notifications.push(await notificationService.createNotification(clientNotification));
            }

            // Notify freelancer
            if (workspace.freelancerId) {
                const freelancerNotification = {
                    ...notificationData,
                    userId: workspace.freelancerId,
                    metadata: {
                        ...notificationData.metadata,
                        workspaceId
                    }
                };
                notifications.push(await notificationService.createNotification(freelancerNotification));
            }

            return notifications;
        } catch (error) {
            console.error("Notify workspace users error:", error);
            throw error;
        }
    },

    // Common notification templates
    templates: {

        CONTRACT_SIGNED_BY_CLIENT: (contractId, contractTitle, clientName, workspaceId) => ({
            type: 'contract_signed',
            category: 'project_update',
            title: 'Contract Signed by Client',
            message: `${clientName} has signed the contract "${contractTitle}"`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                contractId,
                workspaceId,
                actionUrl: workspaceId ? `/workspace/${workspaceId}` : `/freelancer/contracts/${contractId}`
            }
        }),

        CONTRACT_SIGNED_BY_FREELANCER: (contractId, contractTitle, freelancerName, workspaceId) => ({
            type: 'contract_signed',
            category: 'project_update',
            title: 'Contract Signed by Freelancer',
            message: `${freelancerName} has signed the contract "${contractTitle}"`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                contractId,
                workspaceId,
                actionUrl: workspaceId ? `/workspace/${workspaceId}` : `/client/contracts/${contractId}`
            }
        }),

        WORKSPACE_CREATED_FOR_CLIENT: (workspaceId, projectTitle, freelancerName) => ({
            type: 'workspace_created',
            category: 'project_update',
            title: 'Workspace Created',
            message: `Workspace for "${projectTitle}" is ready with freelancer ${freelancerName}`,
            priority: 'medium',
            actionRequired: true,
            metadata: {
                workspaceId,
                actionUrl: `/workspace/${workspaceId}`
            }
        }),

        WORKSPACE_CREATED_FOR_FREELANCER: (workspaceId, projectTitle, clientName) => ({
            type: 'workspace_created',
            category: 'project_update',
            title: 'Workspace Ready',
            message: `Workspace for "${projectTitle}" is ready with client ${clientName}`,
            priority: 'medium',
            actionRequired: true,
            metadata: {
                workspaceId,
                actionUrl: `/workspace/${workspaceId}`
            }
        }),
        MILESTONE_SUBMITTED: (workspaceId, milestoneTitle, freelancerName) => ({
            type: 'milestone_submission',
            category: 'project_update',
            title: 'Milestone Submitted for Review',
            message: `${freelancerName} has submitted work for "${milestoneTitle}"`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                workspaceId,
                actionUrl: `/workspace/${workspaceId}/milestones`
            }
        }),

        MILESTONE_APPROVED: (workspaceId, milestoneTitle, clientName) => ({
            type: 'milestone_approval',
            category: 'project_update',
            title: 'Milestone Approved!',
            message: `${clientName} approved your work on "${milestoneTitle}"`,
            priority: 'medium',
            actionRequired: false,
            metadata: {
                workspaceId,
                actionUrl: `/workspace/${workspaceId}/milestones`
            }
        }),

        REVISION_REQUESTED: (workspaceId, milestoneTitle, clientName) => ({
            type: 'revision_request',
            category: 'project_update',
            title: 'Revision Requested',
            message: `${clientName} requested changes for "${milestoneTitle}"`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                workspaceId,
                actionUrl: `/workspace/${workspaceId}/milestones`
            }
        }),

        // Proposal notifications
        NEW_PROPOSAL: (jobTitle, freelancerName) => ({
            type: 'proposal_received',
            category: 'proposal',
            title: 'New Proposal Received',
            message: `${freelancerName} submitted a proposal for "${jobTitle}"`,
            priority: 'medium',
            actionRequired: true,
            metadata: {
                actionUrl: '/client/proposals'
            }
        }),

        PROPOSAL_ACCEPTED: (jobTitle, clientName) => ({
            type: 'proposal_accepted',
            category: 'proposal',
            title: 'Proposal Accepted!',
            message: `${clientName} accepted your proposal for "${jobTitle}"`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                actionUrl: '/freelancer/contracts'
            }
        }),

        // Payment notifications
        PAYMENT_RECEIVED: (amount, projectTitle) => ({
            type: 'payment_received',
            category: 'payment',
            title: 'Payment Received',
            message: `₹${amount} received for "${projectTitle}"`,
            priority: 'medium',
            actionRequired: false,
            metadata: {
                actionUrl: '/freelancer/earnings'
            }
        }),

        PAYMENT_RELEASED: (amount, projectTitle) => ({
            type: 'payment_released',
            category: 'payment',
            title: 'Payment Released',
            message: `₹${amount} released for "${projectTitle}"`,
            priority: 'medium',
            actionRequired: false,
            metadata: {
                actionUrl: '/client/payments'
            }
        }),

        // Message notifications
        NEW_MESSAGE: (workspaceId, senderName, messagePreview) => ({
            type: 'new_message',
            category: 'message',
            title: `New message from ${senderName}`,
            message: messagePreview.substring(0, 100) + (messagePreview.length > 100 ? '...' : ''),
            priority: 'low',
            actionRequired: false,
            metadata: {
                workspaceId,
                actionUrl: `/workspace/${workspaceId}/chat`
            }
        }),

        // System notifications
        CONTRACT_EXPIRING: (contractTitle, daysLeft) => ({
            type: 'contract_reminder',
            category: 'system',
            title: 'Contract Expiring Soon',
            message: `"${contractTitle}" expires in ${daysLeft} days`,
            priority: 'medium',
            actionRequired: true,
            metadata: {
                actionUrl: '/contracts'
            }
        }),

        PROJECT_DEADLINE: (projectTitle, daysLeft) => ({
            type: 'deadline_reminder',
            category: 'system',
            title: 'Project Deadline Approaching',
            message: `"${projectTitle}" deadline in ${daysLeft} days`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                actionUrl: '/workspace'
            }
        })
    }
};

module.exports = {
    notificationController,
    notificationService
};