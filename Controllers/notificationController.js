const Notification = require('../Models/Notification');
const User = require('../Models/User');

const notificationController = {
    // Get user notifications
    getNotifications: async (req, res) => {
        try {
            const userId = req.userId || req.user.id;
            const { page = 1, limit = 20, unreadOnly = false, type } = req.query;

            let query = { 
                userId,
                userType: req.user?.userType || 'freelancer'
            };
            
            if (unreadOnly === 'true') {
                query.isRead = false;
            }
            
            if (type && type !== 'all') {
                query.type = type;
            }

            const notifications = await Notification.find(query)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit))
                .select('type title message data createdAt isRead readAt priority category metadata');

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
                message: "Server error fetching notifications",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get unread notifications
    getUnreadNotifications: async (req, res) => {
        try {
            const userId = req.userId || req.user.id;
            
            // Get today's notifications
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            
            const notifications = await Notification.find({
                userId,
                isRead: false,
                createdAt: { $gte: startOfDay }
            })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('type title message data createdAt priority');

            res.json({
                success: true,
                notifications
            });
        } catch (error) {
            console.error("Get unread notifications error:", error);
            res.status(500).json({ 
                success: false, 
                message: "Server error fetching unread notifications",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get notification count
    getNotificationCount: async (req, res) => {
        try {
            const userId = req.userId || req.user.id;
            
            // Today's unread notifications
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            
            const todayUnread = await Notification.countDocuments({
                userId,
                isRead: false,
                createdAt: { $gte: startOfDay }
            });
            
            // Total unread
            const totalUnread = await Notification.countDocuments({
                userId,
                isRead: false
            });
            
            res.json({
                success: true,
                todayUnread,
                totalUnread
            });
        } catch (error) {
            console.error("Get notification count error:", error);
            res.status(500).json({ 
                success: false, 
                message: "Server error fetching notification count",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Mark notification as read
    markNotificationAsRead: async (req, res) => {
        try {
            const userId = req.userId || req.user.id;
            const { id } = req.params;

            const notification = await Notification.findOne({
                _id: id,
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
                message: "Server error marking notification as read",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Mark all notifications as read
    markAllNotificationsAsRead: async (req, res) => {
        try {
            const userId = req.userId || req.user.id;

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
                message: "Server error marking notifications as read",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Delete a notification
    deleteNotification: async (req, res) => {
        try {
            const userId = req.userId || req.user.id;
            const { id } = req.params;

            const notification = await Notification.findOneAndDelete({
                _id: id,
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
                message: "Server error deleting notification",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Clear all notifications
    clearAll: async (req, res) => {
        try {
            const userId = req.userId || req.user.id;

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
                message: "Server error clearing notifications",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get notification statistics
    getNotificationStats: async (req, res) => {
        try {
            const userId = req.userId || req.user.id;

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
                message: "Server error fetching notification statistics",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // WebSocket handler
    handleWebSocket: (ws, req) => {
        // Authenticate user from token
        const token = req.query.token;
        // Verify token and get user ID
        
        ws.on('message', (message) => {
            // Handle incoming messages
            console.log('Received:', message);
        });
        
        const sendNotification = (notification) => {
            ws.send(JSON.stringify(notification));
        };
        
        return { sendNotification };
    }
};

// Notification Service - Used by other controllers to create notifications
const notificationService = {
    // Create a new notification
    createNotification: async (notificationData) => {
        try {
            if (!notificationData._id) {
                notificationData._id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }

            const notification = new Notification(notificationData);
            await notification.save();

            // Socket.io real-time notification
            if (global.io) {
                global.io.to(`user_${notificationData.userId}`).emit('new_notification', notification);
            }

            return notification;
        } catch (error) {
            console.error("Create notification service error:", error);
            throw error;
        }
    },

    // Notify both client and freelancer in a workspace
    notifyWorkspaceUsers: async (workspaceId, notificationData) => {
        try {
            const Workspace = require('../Models/Workspace');
            const workspace = await Workspace.findById(workspaceId);
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

    // Helper function to create notifications
    createSimpleNotification: async (userId, userType, type, title, message, data = {}) => {
        try {
            const notification = new Notification({
                userId,
                userType,
                type,
                title,
                message,
                data,
                isRead: false,
                createdAt: new Date()
            });
            
            await notification.save();
            
            // Emit real-time notification via WebSocket if available
            if (global.io) {
                global.io.to(`user_${userId}`).emit('notification', notification);
            }
            
            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    },

    // Common notification templates
    templates: {
        // Contract notifications
        CONTRACT_SENT_TO_FREELANCER: (contractId, contractTitle, clientName, workspaceId) => ({
            type: 'contract_sent',
            category: 'contract',
            title: 'New Contract Received',
            message: `${clientName} sent you a contract for "${contractTitle}"`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                contractId,
                workspaceId,
                actionUrl: workspaceId ? `/workspace/${workspaceId}` : `/freelancer/contracts/${contractId}`
            }
        }),

        CONTRACT_SENT_TO_CLIENT: (contractId, contractTitle, freelancerName, workspaceId) => ({
            type: 'contract_sent',
            category: 'contract',
            title: 'Contract Sent to Client',
            message: `You sent a contract to ${freelancerName} for "${contractTitle}"`,
            priority: 'medium',
            actionRequired: false,
            metadata: {
                contractId,
                workspaceId,
                actionUrl: workspaceId ? `/workspace/${workspaceId}` : `/client/contracts/${contractId}`
            }
        }),

        CONTRACT_SIGNED_BY_CLIENT: (contractId, contractTitle, clientName, workspaceId) => ({
            type: 'contract_signed',
            category: 'contract',
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
            category: 'contract',
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

        CONTRACT_ACCEPTED: (contractId, contractTitle, clientName, workspaceId) => ({
            type: 'contract_accepted',
            category: 'contract',
            title: 'Contract Accepted',
            message: `${clientName} accepted the contract "${contractTitle}"`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                contractId,
                workspaceId,
                actionUrl: workspaceId ? `/workspace/${workspaceId}` : `/freelancer/contracts/${contractId}`
            }
        }),

        CONTRACT_DECLINED: (contractId, contractTitle, clientName, reason) => ({
            type: 'contract_declined',
            category: 'contract',
            title: 'Contract Declined',
            message: `${clientName} declined the contract "${contractTitle}"${reason ? `: ${reason}` : ''}`,
            priority: 'medium',
            actionRequired: false,
            metadata: {
                contractId,
                actionUrl: '/freelancer/contracts'
            }
        }),

        // Workspace notifications
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

        // Milestone notifications
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

        MILESTONE_REJECTED: (workspaceId, milestoneTitle, clientName, feedback) => ({
            type: 'milestone_rejection',
            category: 'project_update',
            title: 'Milestone Requires Revision',
            message: `${clientName} requested changes for "${milestoneTitle}"${feedback ? `: ${feedback}` : ''}`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                workspaceId,
                actionUrl: `/workspace/${workspaceId}/milestones`
            }
        }),

        REVISION_REQUESTED: (workspaceId, milestoneTitle, clientName, feedback) => ({
            type: 'revision_request',
            category: 'project_update',
            title: 'Revision Requested',
            message: `${clientName} requested changes for "${milestoneTitle}"${feedback ? `: ${feedback}` : ''}`,
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

        PROPOSAL_REJECTED: (jobTitle, clientName) => ({
            type: 'proposal_rejected',
            category: 'proposal',
            title: 'Proposal Not Selected',
            message: `${clientName} selected another freelancer for "${jobTitle}"`,
            priority: 'low',
            actionRequired: false,
            metadata: {
                actionUrl: '/freelancer/proposals'
            }
        }),

        PROPOSAL_WITHDRAWN: (jobTitle, freelancerName) => ({
            type: 'proposal_withdrawn',
            category: 'proposal',
            title: 'Proposal Withdrawn',
            message: `${freelancerName} withdrew their proposal for "${jobTitle}"`,
            priority: 'low',
            actionRequired: false,
            metadata: {
                actionUrl: '/client/proposals'
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

        PAYMENT_PENDING: (amount, projectTitle, dueDate) => ({
            type: 'payment_pending',
            category: 'payment',
            title: 'Payment Pending',
            message: `₹${amount} payment for "${projectTitle}" is pending${dueDate ? `, due on ${dueDate}` : ''}`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                actionUrl: '/freelancer/earnings/pending'
            }
        }),

        PAYMENT_FAILED: (amount, projectTitle, reason) => ({
            type: 'payment_failed',
            category: 'payment',
            title: 'Payment Failed',
            message: `₹${amount} payment for "${projectTitle}" failed${reason ? `: ${reason}` : ''}`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                actionUrl: '/client/payments'
            }
        }),

        WITHDRAWAL_REQUESTED: (amount) => ({
            type: 'withdrawal_requested',
            category: 'payment',
            title: 'Withdrawal Requested',
            message: `Withdrawal request of ₹${amount} has been submitted`,
            priority: 'medium',
            actionRequired: false,
            metadata: {
                actionUrl: '/freelancer/earnings'
            }
        }),

        WITHDRAWAL_COMPLETED: (amount) => ({
            type: 'withdrawal_completed',
            category: 'payment',
            title: 'Withdrawal Completed',
            message: `₹${amount} has been transferred to your bank account`,
            priority: 'medium',
            actionRequired: false,
            metadata: {
                actionUrl: '/freelancer/earnings'
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

        NEW_FILE_UPLOADED: (workspaceId, fileName, uploaderName) => ({
            type: 'file_uploaded',
            category: 'message',
            title: 'New File Uploaded',
            message: `${uploaderName} uploaded "${fileName}"`,
            priority: 'low',
            actionRequired: false,
            metadata: {
                workspaceId,
                actionUrl: `/workspace/${workspaceId}/files`
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
        }),

        MILESTONE_DEADLINE: (milestoneTitle, hoursLeft) => ({
            type: 'deadline_reminder',
            category: 'system',
            title: 'Milestone Deadline Approaching',
            message: `"${milestoneTitle}" due in ${hoursLeft} hours`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                actionUrl: '/workspace/milestones'
            }
        }),

        PROFILE_COMPLETION: (percentage) => ({
            type: 'profile_reminder',
            category: 'system',
            title: 'Complete Your Profile',
            message: `Your profile is ${percentage}% complete. Complete it to get more jobs.`,
            priority: 'medium',
            actionRequired: true,
            metadata: {
                actionUrl: '/freelancer/profile'
            }
        }),

        VERIFICATION_REQUIRED: () => ({
            type: 'verification_required',
            category: 'system',
            title: 'Account Verification Required',
            message: 'Please verify your account to access all features',
            priority: 'high',
            actionRequired: true,
            metadata: {
                actionUrl: '/verification'
            }
        }),

        VERIFICATION_APPROVED: () => ({
            type: 'verification_approved',
            category: 'system',
            title: 'Account Verified!',
            message: 'Your account has been successfully verified',
            priority: 'medium',
            actionRequired: false,
            metadata: {
                actionUrl: '/dashboard'
            }
        }),

        // Security notifications
        NEW_LOGIN: (device, location, time) => ({
            type: 'security_alert',
            category: 'security',
            title: 'New Login Detected',
            message: `New login from ${device} in ${location} at ${time}`,
            priority: 'high',
            actionRequired: true,
            metadata: {
                actionUrl: '/security'
            }
        }),

        PASSWORD_CHANGED: () => ({
            type: 'security_alert',
            category: 'security',
            title: 'Password Changed',
            message: 'Your password has been changed successfully',
            priority: 'medium',
            actionRequired: false,
            metadata: {
                actionUrl: '/security'
            }
        }),

        // Rating notifications
        NEW_RATING: (projectTitle, rating, reviewerName) => ({
            type: 'new_rating',
            category: 'rating',
            title: 'New Rating Received',
            message: `${reviewerName} gave you ${rating} stars for "${projectTitle}"`,
            priority: 'low',
            actionRequired: false,
            metadata: {
                actionUrl: '/freelancer/reviews'
            }
        }),

        REVIEW_REQUESTED: (projectTitle, clientName) => ({
            type: 'review_requested',
            category: 'rating',
            title: 'Review Requested',
            message: `${clientName} requested your review for "${projectTitle}"`,
            priority: 'medium',
            actionRequired: true,
            metadata: {
                actionUrl: '/reviews/pending'
            }
        })
    }
};

module.exports = notificationController;
module.exports.notificationService = notificationService;