const dailyService = require('../Services/dailyService');
const Workspace = require('../Models/Workspace');
const VideoCall = require('../Models/VideoCall');

const videoCallController = {
    // Schedule a video call
    scheduleCall: async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.userRole;
            const { workspaceId } = req.params;
            const { scheduledTime, title, description, duration = 60 } = req.body;

            // Verify user has access to workspace
            const workspace = await Workspace.findOne({
                _id: workspaceId,
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
            console.error("Schedule call error:", error);
            res.status(500).json({
                success: false,
                message: "Server error scheduling video call"
            });
        }
    },

    // Get call details and meeting token
    getCallDetails: async (req, res) => {
        try {
            const userId = req.userId;
            const { callId } = req.params;

            const call = await VideoCall.findOne({
                _id: callId,
                'participants.userId': userId
            })
                .populate('workspaceId', 'projectTitle')
                .populate('scheduledBy', 'name profilePicture');

            if (!call) {
                return res.status(404).json({
                    success: false,
                    message: "Call not found or access denied"
                });
            }

            // Generate meeting token for secure access
            const meetingToken = await dailyService.createMeetingToken(
                call.roomName,
                userId,
                req.userName || 'User',
                userId === call.scheduledBy.toString()
            );

            res.json({
                success: true,
                call: {
                    ...call.toObject(),
                    meetingToken
                }
            });

        } catch (error) {
            console.error("Get call details error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching call details"
            });
        }
    },

    // Get all calls for a workspace
    getWorkspaceCalls: async (req, res) => {
        try {
            const userId = req.userId;
            const { workspaceId } = req.params;
            const { status, page = 1, limit = 10 } = req.query;

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
            if (status && status !== 'all') {
                query.status = status;
            }

            const calls = await VideoCall.find(query)
                .populate('scheduledBy', 'name profilePicture')
                .sort({ scheduledTime: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalCalls = await VideoCall.countDocuments(query);

            res.json({
                success: true,
                calls,
                totalPages: Math.ceil(totalCalls / limit),
                currentPage: parseInt(page),
                totalCalls
            });

        } catch (error) {
            console.error("Get workspace calls error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching calls"
            });
        }
    },

    // Update call schedule
    updateCall: async (req, res) => {
        try {
            const userId = req.userId;
            const { callId } = req.params;
            const { scheduledTime, title, description, duration } = req.body;

            const call = await VideoCall.findOne({
                _id: callId,
                scheduledBy: userId,
                status: 'scheduled'
            });

            if (!call) {
                return res.status(404).json({
                    success: false,
                    message: "Call not found or cannot be updated"
                });
            }

            const updateData = {};
            if (scheduledTime) updateData.scheduledTime = new Date(scheduledTime);
            if (title) updateData.title = title;
            if (description) updateData.description = description;
            if (duration) updateData.duration = duration;

            const updatedCall = await VideoCall.findByIdAndUpdate(
                callId,
                updateData,
                { new: true, runValidators: true }
            );

            // Notify other participant about schedule change
            const io = req.app.get('io');
            if (io) {
                const otherParticipant = call.participants.find(p => p.userId.toString() !== userId);
                if (otherParticipant) {
                    io.to(otherParticipant.userId.toString()).emit('call_updated', {
                        call: updatedCall,
                        updatedBy: userId
                    });
                }
            }

            res.json({
                success: true,
                message: "Call updated successfully",
                call: updatedCall
            });

        } catch (error) {
            console.error("Update call error:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating call"
            });
        }
    },

    // Cancel a call
    cancelCall: async (req, res) => {
        try {
            const userId = req.userId;
            const { callId } = req.params;
            const { cancelReason } = req.body;

            const call = await VideoCall.findOne({
                _id: callId,
                $or: [
                    { scheduledBy: userId },
                    { 'participants.userId': userId }
                ]
            });

            if (!call) {
                return res.status(404).json({
                    success: false,
                    message: "Call not found or access denied"
                });
            }

            if (call.status !== 'scheduled') {
                return res.status(400).json({
                    success: false,
                    message: "Only scheduled calls can be cancelled"
                });
            }

            call.status = 'cancelled';
            call.cancelReason = cancelReason || 'Cancelled by participant';
            call.cancelledAt = new Date();
            call.cancelledBy = userId;
            await call.save();

            // Notify other participant
            const io = req.app.get('io');
            if (io) {
                const otherParticipant = call.participants.find(p => p.userId.toString() !== userId);
                if (otherParticipant) {
                    io.to(otherParticipant.userId.toString()).emit('call_cancelled', {
                        call,
                        cancelledBy: userId
                    });
                }
            }

            // Delete Daily.co room
            try {
                await dailyService.deleteRoom(call.roomName);
            } catch (dailyError) {
                console.error("Failed to delete Daily.co room:", dailyError);
                // Continue even if room deletion fails
            }

            res.json({
                success: true,
                message: "Call cancelled successfully",
                call
            });

        } catch (error) {
            console.error("Cancel call error:", error);
            res.status(500).json({
                success: false,
                message: "Server error cancelling call"
            });
        }
    },

    // Start a call (mark as in progress)
    startCall: async (req, res) => {
        try {
            const userId = req.userId;
            const { callId } = req.params;

            const call = await VideoCall.findOne({
                _id: callId,
                'participants.userId': userId
            });

            if (!call) {
                return res.status(404).json({
                    success: false,
                    message: "Call not found or access denied"
                });
            }

            if (call.status !== 'scheduled') {
                return res.status(400).json({
                    success: false,
                    message: "Call cannot be started in current status"
                });
            }

            call.status = 'in_progress';
            call.startedAt = new Date();
            await call.save();

            // Notify other participant that call has started
            const io = req.app.get('io');
            if (io) {
                const otherParticipant = call.participants.find(p => p.userId.toString() !== userId);
                if (otherParticipant) {
                    io.to(otherParticipant.userId.toString()).emit('call_started', {
                        call,
                        startedBy: userId
                    });
                }
            }

            res.json({
                success: true,
                message: "Call started",
                call
            });

        } catch (error) {
            console.error("Start call error:", error);
            res.status(500).json({
                success: false,
                message: "Server error starting call"
            });
        }
    },

    // End a call (mark as completed)
    endCall: async (req, res) => {
        try {
            const userId = req.userId;
            const { callId } = req.params;
            const { notes } = req.body;

            const call = await VideoCall.findOne({
                _id: callId,
                'participants.userId': userId
            });

            if (!call) {
                return res.status(404).json({
                    success: false,
                    message: "Call not found or access denied"
                });
            }

            if (call.status !== 'in_progress') {
                return res.status(400).json({
                    success: false,
                    message: "Call is not in progress"
                });
            }

            call.status = 'completed';
            call.endedAt = new Date();
            call.notes = notes || '';
            call.duration = Math.round((call.endedAt - call.startedAt) / 1000 / 60); // Duration in minutes
            await call.save();

            res.json({
                success: true,
                message: "Call ended successfully",
                call
            });

        } catch (error) {
            console.error("End call error:", error);
            res.status(500).json({
                success: false,
                message: "Server error ending call"
            });
        }
    },

    // Get call statistics for workspace
    getCallStats: async (req, res) => {
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

            const stats = await VideoCall.aggregate([
                { $match: { workspaceId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalDuration: { $sum: '$duration' }
                    }
                }
            ]);

            const totalStats = await VideoCall.aggregate([
                { $match: { workspaceId } },
                {
                    $group: {
                        _id: null,
                        totalCalls: { $sum: 1 },
                        completedCalls: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        },
                        totalDuration: { $sum: '$duration' },
                        avgDuration: { $avg: '$duration' }
                    }
                }
            ]);

            // Recent calls
            const recentCalls = await VideoCall.find({ workspaceId })
                .populate('scheduledBy', 'name profilePicture')
                .sort({ scheduledTime: -1 })
                .limit(5)
                .select('title status scheduledTime duration');

            res.json({
                success: true,
                stats: {
                    statusDistribution: stats,
                    overview: totalStats[0] || {
                        totalCalls: 0,
                        completedCalls: 0,
                        totalDuration: 0,
                        avgDuration: 0
                    }
                },
                recentCalls
            });

        } catch (error) {
            console.error("Get call stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching call statistics"
            });
        }
    },

    // Join call directly (for immediate calls without scheduling)

    createInstantCall: async (req, res) => {
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
    }
};

module.exports = videoCallController;