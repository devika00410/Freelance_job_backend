const mongoose = require("mongoose");

const proposalMilestoneSchema = new mongoose.Schema({
    title: { type: String, required: true },
    days: { type: Number, required: true },
    amount: { type: Number, required: true },
    description: String,
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'paid'],
        default: 'pending'
    }
});

const proposalSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    projectId: {
        type: String,
        ref: 'Job',
        required: true
    },
    freelancerId: {
        type: String,
        ref: 'User',
        required: true
    },
    clientId: {
        type: String,
        ref: 'User',
        required: true
    },

    clientName: {
        type: String,
        default: 'Client'
    },
    clientCompany: {
        type: String,
        default: ''
    },
    clientEmail: {
        type: String,
        default: ''
    },
    freelancerName: {
        type: String,
        default: 'Freelancer'
    },
    freelancerEmail: {
        type: String,
        default: ''
    },
    freelancerPicture: {
        type: String,
        default: ''
    },
    
    serviceCategory: {
        type: String,
        default: 'General' 
    },
    coverLetter: {
        type: String,
        default: '' 
    },
    
    proposalDetails: {
        totalAmount: {
            type: Number,
            required: true
        },
        estimatedHours: {
            type: Number,
            default: 40
        },
        deliveryTime: {
            type: String,
            default: '30 days'
        },
        estimatedDays: {
            type: Number,
            default: 30
        },
        hourlyRate: {
            type: Number,
            default: 0
        },
        revisions: {
            type: Number,
            default: 3
        },
        supportPeriod: {
            type: String,
            default: '30 days'
        }
    },
    milestones: [proposalMilestoneSchema],
    status: {
        type: String,
        enum: ['submitted', 'under_review', 'accepted', 'rejected', 'withdrawn', 'expired'],
        default: 'submitted'
    },
    isHired: {
        type: Boolean,
        default: false
    },
    hiredAt: Date,
    rejectionReason: String,
    clientFeedback: String,
    freelancerRating: {
        type: Number,
        min: 1,
        max: 5
    },
    messages: [{
        senderId: String,
        message: String,
        sendAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});


proposalSchema.pre('save', async function(next) {
    // Calculate hourly rate
    if (this.proposalDetails.estimatedHours > 0 && this.proposalDetails.totalAmount > 0) {
        this.proposalDetails.hourlyRate = 
            this.proposalDetails.totalAmount / this.proposalDetails.estimatedHours;
    } else {
        this.proposalDetails.hourlyRate = 0;
    }
    
    // Auto-fill coverLetter
    if (!this.coverLetter && this.proposalDetails.coverLetter) {
        this.coverLetter = this.proposalDetails.coverLetter;
    }
    
    // Auto-fill serviceCategory
    if (!this.serviceCategory) {
        this.serviceCategory = 'General';
    }
    
    // ✅ AUTO-FILL USER NAMES if they're empty
    if (!this.clientName || this.clientName === 'Client' || 
        !this.freelancerName || this.freelancerName === 'Freelancer') {
        
    try {
        const User = mongoose.model('User'); // Use mongoose.model to avoid require
        
        // Fill client info if clientId exists
        if (this.clientId && (!this.clientName || this.clientName === '' || this.clientName === 'Unknown' || this.clientName === 'Client')) {
            const clientUser = await User.findById(this.clientId);
            if (clientUser && clientUser.name) {
                this.clientName = clientUser.name;
                this.clientEmail = clientUser.email || '';
                this.clientCompany = clientUser.companyName || '';
                console.log(`✅ Pre-save: Set clientName to ${clientUser.name}`);
            }
        }
        
        // Fill freelancer info if freelancerId exists  
        if (this.freelancerId && (!this.freelancerName || this.freelancerName === '' || this.freelancerName === 'Unknown' || this.freelancerName === 'Freelancer')) {
            const freelancerUser = await User.findById(this.freelancerId);
            if (freelancerUser && freelancerUser.name) {
                this.freelancerName = freelancerUser.name;
                this.freelancerEmail = freelancerUser.email || '';
                this.freelancerPicture = freelancerUser.profilePicture || '';
                console.log(`✅ Pre-save: Set freelancerName to ${freelancerUser.name}`);
            }
        }
    } catch (error) {
        console.error('❌ Error in proposal pre-save:', error);
        
    }
    
    }
    
    next();
});

// Indexes for better query performance
proposalSchema.index({ projectId: 1, status: 1 });
proposalSchema.index({ freelancerId: 1, status: 1 });
proposalSchema.index({ clientId: 1, status: 1 });
proposalSchema.index({ createdAt: -1 });

// Check if proposal is active
proposalSchema.methods.isActive = function() {
    return this.status === 'submitted' || this.status === 'under_review';
};

// Accept proposal
proposalSchema.methods.acceptProposal = function() {
    this.status = 'accepted';
    this.isHired = true;
    this.hiredAt = new Date();
    return this.save();
};

// Reject proposal
proposalSchema.methods.rejectProposal = function(reason) {
    this.status = 'rejected';
    this.rejectionReason = reason;
    return this.save();
};

// Static method to get proposals by client
proposalSchema.statics.findByClient = function(clientId) {
    return this.find({ clientId })
        .populate('projectId', 'title budget duration')
        .populate('freelancerId', 'name profilePicture rating')
        .sort({ createdAt: -1 });
};

// Static method to get proposals by freelancer
proposalSchema.statics.findByFreelancer = function(freelancerId) {
    return this.find({ freelancerId })
        .populate('projectId', 'title budget duration clientId')
        .populate('clientId', 'name companyName rating')
        .sort({ createdAt: -1 });
};

// Get proposals for specific job
proposalSchema.statics.findByProject = function(projectId) {
    return this.find({ projectId })
        .populate('freelancerId', 'name profilePicture skills rating completedProjects')
        .sort({ createdAt: -1 });
};

// Count proposal status for a client
proposalSchema.statics.countByClientAndStats = function(clientId, status) {
    return this.countDocuments({ clientId, status });
};

const Proposal = mongoose.model('Proposal', proposalSchema);

module.exports = Proposal;