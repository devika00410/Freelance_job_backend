const mongoose = require('mongoose');

const videoCallSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    workspaceId: {
        type: String,
        required: true,
        ref: 'Workspace'
    },
    scheduledBy: {
        type: String,
        required: true,
        ref: 'User'
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    scheduledTime: {
        type: Date,
        required: true
    },
    duration: {
        type: Number,
        default: 60
    },
    status: {
        type: String,
        enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'failed'],
        default: 'scheduled'
    },
    roomUrl: {
        type: String,
        required: true
    },
    roomName: {
        type: String,
        required: true
    },
    isInstant: {
        type: Boolean,
        default: false
    },
    participants: [{
        userId: {
            type: String,
            required: true,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['client', 'freelancer'],
            required: true
        },
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        joinedAt: {
            type: Date
        },
        leftAt: {
            type: Date
        },
        duration: {
            type: Number
        }
    }],
    startedAt: {
        type: Date
    },
    endedAt: {
        type: Date
    },
    actualDuration: {
        type: Number
    },
    notes: {
        type: String,
        trim: true
    },
    recordingUrl: {
        type: String
    },
    cancelReason: {
        type: String
    },
    cancelledBy: {
        type: String,
        ref: 'User'
    },
    cancelledAt: {
        type: Date
    },
    meetingToken: {
        type: String
    },
    dailyRoomData: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

videoCallSchema.index({ workspaceId: 1, scheduledTime: 1 });
videoCallSchema.index({ scheduledBy: 1 });
videoCallSchema.index({ status: 1 });
videoCallSchema.index({ 'participants.userId': 1 });

videoCallSchema.methods.markAsStarted = function() {
    this.status = 'in_progress';
    this.startedAt = new Date();
    return this.save();
};

videoCallSchema.methods.markAsCompleted = function() {
    this.status = 'completed';
    this.endedAt = new Date();
    
    if (this.startedAt) {
        this.actualDuration = Math.round((this.endedAt - this.startedAt) / 1000 / 60);
    }
    
    return this.save();
};

videoCallSchema.methods.cancelCall = function(userId, reason) {
    this.status = 'cancelled';
    this.cancelledBy = userId;
    this.cancelledAt = new Date();
    this.cancelReason = reason;
    return this.save();
};

videoCallSchema.methods.addParticipant = function(participantData) {
    const existingParticipant = this.participants.find(
        p => p.userId.toString() === participantData.userId
    );
    
    if (!existingParticipant) {
        this.participants.push({
            ...participantData,
            joinedAt: new Date()
        });
    }
    
    return this.save();
};

videoCallSchema.methods.markParticipantLeft = function(userId) {
    const participant = this.participants.find(
        p => p.userId.toString() === userId
    );
    
    if (participant && !participant.leftAt) {
        participant.leftAt = new Date();
        
        if (participant.joinedAt) {
            participant.duration = Math.round(
                (participant.leftAt - participant.joinedAt) / 1000 / 60
            );
        }
    }
    
    return this.save();
};

videoCallSchema.statics.getUpcomingCalls = function(workspaceId) {
    return this.find({
        workspaceId,
        status: 'scheduled',
        scheduledTime: { $gte: new Date() }
    }).sort({ scheduledTime: 1 });
};

videoCallSchema.statics.getCallHistory = function(workspaceId, limit = 10) {
    return this.find({
        workspaceId,
        status: { $in: ['completed', 'cancelled'] }
    })
    .sort({ scheduledTime: -1 })
    .limit(limit);
};

videoCallSchema.statics.getUserCalls = function(userId, status = null) {
    const query = {
        $or: [
            { scheduledBy: userId },
            { 'participants.userId': userId }
        ]
    };
    
    if (status) {
        query.status = status;
    }
    
    return this.find(query).sort({ scheduledTime: -1 });
};

videoCallSchema.statics.getActiveCalls = function(workspaceId) {
    return this.find({
        workspaceId,
        status: 'in_progress'
    });
};

videoCallSchema.virtual('isUpcoming').get(function() {
    return this.status === 'scheduled' && this.scheduledTime > new Date();
});

videoCallSchema.virtual('isOngoing').get(function() {
    return this.status === 'in_progress';
});

videoCallSchema.virtual('isPast').get(function() {
    return ['completed', 'cancelled', 'failed'].includes(this.status);
});

videoCallSchema.set('toJSON', {
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.meetingToken;
        delete ret.dailyRoomData;
        return ret;
    }
});

const VideoCall = mongoose.model('VideoCall', videoCallSchema);

module.exports = VideoCall;