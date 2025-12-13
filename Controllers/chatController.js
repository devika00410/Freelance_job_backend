const Message = require('../Models/Message');
const Workspace = require('../Models/Workspace');
const User = require('../Models/User');

const chatController = {
    // Get chat messages for a workspace
    getMessages: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;
            const { page = 1, limit = 50, before } = req.query;

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

            let query = { workspaceId };

            // For pagination - get messages before a certain date
            if (before) {
                query.timestamp = { $lt: new Date(before) };
            }

            const messages = await Message.find(query)
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
                totalMessages,
                hasMore: messages.length === limit
            });

        } catch (error) {
            console.error("Get messages error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching messages"
            });
        }
    },

    // Send a message
    sendMessage: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const { workspaceId } = req.params;
            const { content, messageType = 'text', replyTo } = req.body;

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

            // Validate message content
            if (!content || content.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Message content cannot be empty"
                });
            }

            const messageData = {
                workspaceId,
                senderId: userId,
                content: content.trim(),
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

            // Get receiver ID (the other user in workspace)
            const receiverId = userId === workspace.clientId.toString()
                ? workspace.freelancerId
                : workspace.clientId;

            // Socket.io real-time broadcast
            const io = req.app.get('io');
            if (io) {
                io.to(workspaceId).emit('new_message', {
                    message: newMessage,
                    workspaceId,
                    senderId: userId,
                    receiverId: receiverId.toString()
                });

                // Notify about unread message
                const user = await User.findById(userId).select('name profilePicture').lean()
                io.to(workspaceId).emit('message_sent', {
                    workspaceId,
                    messageId: newMessage._id,
                    sender: {
                        id: userId,
                        name: user?.name || 'User',
                        profilePicture: user?.profilePicture,
                        role: userRole
                    }
                });
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

    // Mark messages as read
    markAsRead: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;
            const { messageIds } = req.body;

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

            let updateQuery = { workspaceId };

            // Mark specific messages or all unread messages
            if (messageIds && messageIds.length > 0) {
                updateQuery._id = { $in: messageIds };
            } else {
                updateQuery.readBy = { $ne: userId };
            }

            const result = await Message.updateMany(
                updateQuery,
                {
                    $addToSet: { readBy: userId }
                }
            );

            // Socket.io notification for read receipts
            const io = req.app.get('io');
            if (io) {
                io.to(workspaceId).emit('messages_read', {
                    workspaceId,
                    readerId: userId,
                    messageIds: messageIds || 'all'
                });
            }

            res.json({
                success: true,
                message: "Messages marked as read",
                updatedCount: result.modifiedCount
            });

        } catch (error) {
            console.error("Mark as read error:", error);
            res.status(500).json({
                success: false,
                message: "Server error marking messages as read"
            });
        }
    },

    // Delete a message (only sender can delete)
    deleteMessage: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId, messageId } = req.params;

            // Verify user has access to workspace and is the sender
            const message = await Message.findOne({
                _id: messageId,
                workspaceId,
                senderId: userId
            });

            if (!message) {
                return res.status(404).json({
                    success: false,
                    message: "Message not found or access denied"
                });
            }

            // Soft delete - mark as deleted instead of removing
            message.isDeleted = true;
            message.deletedAt = new Date();
            message.content = "This message was deleted";
            await message.save();

            // Socket.io notification
            const io = req.app.get('io');
            if (io) {
                io.to(workspaceId).emit('message_deleted', {
                    workspaceId,
                    messageId,
                    deletedBy: userId
                });
            }

            res.json({
                success: true,
                message: "Message deleted successfully"
            });

        } catch (error) {
            console.error("Delete message error:", error);
            res.status(500).json({
                success: false,
                message: "Server error deleting message"
            });
        }
    },

    // Get unread message count
    getUnreadCount: async (req, res) => {
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

            const unreadCount = await Message.countDocuments({
                workspaceId,
                readBy: { $ne: userId },
                senderId: { $ne: userId } // Don't count own messages
            });

            res.json({
                success: true,
                unreadCount,
                workspaceId
            });

        } catch (error) {
            console.error("Get unread count error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching unread count"
            });
        }
    },

    // Search messages within workspace
    searchMessages: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;
            const { query, page = 1, limit = 20 } = req.query;

            if (!query || query.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    message: "Search query must be at least 2 characters long"
                });
            }

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

            const searchResults = await Message.find({
                workspaceId,
                content: { $regex: query, $options: 'i' },
                isDeleted: { $ne: true }
            })
                .populate('senderId', 'name profilePicture role')
                .sort({ timestamp: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalResults = await Message.countDocuments({
                workspaceId,
                content: { $regex: query, $options: 'i' },
                isDeleted: { $ne: true }
            });

            res.json({
                success: true,
                results: searchResults,
                totalResults,
                totalPages: Math.ceil(totalResults / limit),
                currentPage: parseInt(page),
                query
            });

        } catch (error) {
            console.error("Search messages error:", error);
            res.status(500).json({
                success: false,
                message: "Server error searching messages"
            });
        }
    },

    // Get chat participants (both client and freelancer)
    getParticipants: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;

            const workspace = await Workspace.findOne({
                _id: workspaceId,
                $or: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            })
                .populate('clientId', 'name profilePicture role isOnline lastSeen')
                .populate('freelancerId', 'name profilePicture role isOnline lastSeen rating');

            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: "Workspace not found or access denied"
                });
            }

            const participants = [
                workspace.clientId,
                workspace.freelancerId
            ];

            res.json({
                success: true,
                participants
            });

        } catch (error) {
            console.error("Get participants error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching participants"
            });
        }
    }
};

module.exports = chatController;