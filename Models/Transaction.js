const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        unique: true,
        default: () => `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    type: {
        type: String,
        enum: [
            'milestone_payment',
            'withdrawal',
            'refund',
            'commission',
            'bonus',
            'dispute_refund'
        ],
        required: true
    },
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fromUserRole: {
        type: String,
        enum: ['client', 'freelancer', 'platform'],
        required: true
    },
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    toUserRole: {
        type: String,
        enum: ['client', 'freelancer', 'platform'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled', 'processing', 'under_review', 'verified'],
        default: 'pending'
    },
    relatedProject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    },
    relatedWorkspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace'
    },
    relatedMilestone: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Milestone'
    },
    paymentMethod: {
        type: String,
        enum: ['stripe', 'bank_transfer', 'paypal', 'wallet', 'manual', 'card'], 
        default: 'stripe'

    },
    stripePaymentIntentId: { type: String },
    platformFee: { type: Number, default: 0 },
    netAmount: { type: Number },
    description: { type: String },
    metadata: { type: Object },

    // Admin Transaction Management Fields
    adminVerified: {
        type: Boolean,
        default: false
    },
    adminNotes: {
        type: String
    },
    verifiedAt: {
        type: Date
    },
    isFlagged: {
        type: Boolean,
        default: false
    },
    flagReason: {
        type: String
    },
    flaggedAt: {
        type: Date
    },
    freelancerReceived: {
        type: Boolean,
        default: false
    },
    receiptConfirmedAt: {
        type: Date
    },

    // Timestamps
    processedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },

}, {
    timestamps: true
});

// Indexes for performance
transactionSchema.index({ fromUser: 1, createdAt: -1 });
transactionSchema.index({ toUser: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ relatedWorkspace: 1 });
transactionSchema.index({ isFlagged: 1 });
transactionSchema.index({ adminVerified: 1 });


transactionSchema.pre('save', function (next) {
    if (this.isModified('amount') || this.isModified('platformFee')) {
        this.netAmount = this.amount - this.platformFee;
    }
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);