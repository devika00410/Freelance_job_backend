const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    workspaceId: {
        type: String,  // Matches your workspaceId format
        required: true,
        trim: true
    },
    senderId: {
        type: String,  // Matches your user ID format
        required: true,
        trim: true
    },
    senderRole: {
        type: String,
        enum: ['client', 'freelancer'],
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    messageType: {
        type: String,
        enum: ['text', 'file', 'image', 'system'],
        default: 'text'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    readBy: [{
        type: String  // Array of user IDs who read the message
    }],
    replyTo: {
        type: String,  // Message ID being replied to
        default: null
    },
    replyToContent: {
        type: String,  // Preview of replied message
        default: null
    }
}, {
    timestamps: true
});

// Custom ID for messages
messageSchema.add({
    _id: {
        type: String,
        default: () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;