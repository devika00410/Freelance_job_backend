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
        type: String, 
        ref: 'User', 
        required: true 
    },
    fromUserRole: { 
        type: String, 
        enum: ['client', 'freelancer', 'platform'], 
        required: true 
    },
    toUser: { 
        type: String, 
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
        enum: ['pending', 'completed', 'failed', 'cancelled', 'processing'], 
        default: 'pending' 
    },
    relatedProject: { 
        type: String, 
        ref: 'Project' 
    },
    relatedWorkspace: { 
        type: String, 
        ref: 'Workspace' 
    },
    relatedMilestone: { 
        type: String, 
        ref: 'Milestone' 
    },
    paymentMethod: { 
        type: String,
        enum: ['stripe', 'bank_transfer', 'paypal', 'wallet', 'manual']
    },
    stripePaymentIntentId: { type: String },
    platformFee: { type: Number, default: 0 },
    netAmount: { type: Number }, 
    description: { type: String },
    metadata: { type: Object },
    
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

// Pre-save middleware to calculate net amount
transactionSchema.pre('save', function(next) {
    if (this.isModified('amount') || this.isModified('platformFee')) {
        this.netAmount = this.amount - this.platformFee;
    }
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);