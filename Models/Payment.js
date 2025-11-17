const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    _id: {
        type: String, 
        required: true
    },
    jobId: {
        type: String,
        ref: 'Job',
        required: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    clientId: {
        type: String,
        ref: 'User',
        required: true
    },
    freelancerId: {
        type: String,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'INR'
    },
    type: {
        type: String,
        enum: ['milestone', 'hourly', 'project', 'bonus', 'refund'],
        required: true
    },
    milestoneId: {
        type: String, 
        ref: 'Project.milestones'
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['stripe', 'paypal', 'bank_transfer', 'escrow'],
        required: true
    },
    transactionId: {
        type: String 
    },
    invoiceUrl: {
        type: String 
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);