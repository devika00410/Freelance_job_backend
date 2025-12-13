const mongoose = require('mongoose');

const phaseSchema = new mongoose.Schema({
    phase: {
        type: Number,
        required: true,
        min: 1
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'approved', 'paid'],
        default: 'pending'
    },
    completedDate: {
        type: Date,
        default: null
    }
});

const contractSchema = new mongoose.Schema({
    contractId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    proposalId: {
        type: String,
        ref: 'Proposal'
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    freelancerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    clientName: {
        type: String,
        trim: true,
        default: 'Client'
    },
    clientEmail: {
        type: String,
        trim: true,
        default: ''
    },
    clientCompany: {
        type: String,
        trim: true,
        default: ''
    },
    clientPicture: {
        type: String,
        trim: true,
        default: ''
    },
    freelancerName: {
        type: String,
        trim: true,
        default: 'Freelancer'
    },
    freelancerEmail: {
        type: String,
        trim: true,
        default: ''
    },
    freelancerPicture: {
        type: String,
        trim: true,
        default: ''
    },

    workspaceId: {
        type: String,
        ref: 'Workspace',
        default: null
    },
    serviceType: {
        type: String,
        default: 'general',
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    terms: {
        type: String,
        required: true,
        trim: true
    },
    totalBudget: {
        type: Number,
        required: true
    },
    timeline: {
        type: String,
        default: '30 days',
        trim: true
    },
    milestoneStructure: {
        type: String,
        required: false,
        default: 'Standard milestone structure',
        trim: true
    },
    phases: [phaseSchema],
    status: {
        type: String,
        enum: [
            'draft',           // Initial draft
            'sent',            // Sent to freelancer
            'pending_freelancer', // Waiting for freelancer to sign
            'pending_client',     // Freelancer signed, waiting for client
            'active',          // Both signed, workspace created
            'completed',       // Project completed
            'cancelled',       // Cancelled by client
            'declined'         // Declined by freelancer
        ],
        default: 'draft'
    },
    clientSigned: {
        type: Boolean,
        default: false
    },
    freelancerSigned: {
        type: Boolean,
        default: false
    },
    clientSignature: {
        type: String,
        default: null
    },
    freelancerSignature: {
        type: String,
        default: null
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        default: null
    },
    completionDate: {
        type: Date,
        default: null
    },
    clientSignedAt: {
        type: Date,
        default: null
    },
    freelancerSignedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

contractSchema.pre('save', async function(next) {
    this.updatedAt = Date.now();
    
    // Auto-create workspace when both parties sign
    if (this.clientSigned && this.freelancerSigned && !this.workspaceId) {
        try {
            const Workspace = require('../Models/Workspace');
            const workspaceId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const workspace = new Workspace({
                workspaceId,
                contractId: this.contractId,
                projectId: this.projectId,
                clientId: this.clientId,
                freelancerId: this.freelancerId,
                projectTitle: this.title,
                serviceType: this.serviceType || 'general',
                status: 'active',
                currentPhase: 1,
                overallProgress: 0,
                startDate: this.startDate || new Date(),
                totalBudget: this.totalBudget || 0,
                lastActivity: new Date(),
                unreadMessages: { client: 0, freelancer: 0 }
            });
            
            await workspace.save();
            this.workspaceId = workspace.workspaceId;
            console.log(`✅ Auto-created workspace: ${workspaceId}`);
        } catch (error) {
            console.error('Error auto-creating workspace:', error);
        }
    }
    
    next();
});

// Add this pre-save hook to your Contract model
contractSchema.pre('save', async function(next) {
    this.updatedAt = Date.now();
    
    // Auto-create workspace when both parties sign
    if (this.clientSigned && this.freelancerSigned && !this.workspaceId) {
        try {
            console.log(`🔄 Auto-creating workspace for contract: ${this.contractId}`);
            
            const WorkspaceService = require('../Services/WorkspaceService');
            const workspace = await WorkspaceService.createWorkspaceFromContract(this._id);
            
            this.workspaceId = workspace.workspaceId;
            console.log(`✅ Auto-created workspace: ${workspace.workspaceId}`);
            
        } catch (workspaceError) {
            console.error('❌ Auto-workspace creation failed:', workspaceError);
            // Don't fail the save operation
            // Workspace can be created manually later
        }
    }
    
    // Update status based on signatures
    this.status = this.calculateCorrectStatus();
    
    next();
});
contractSchema.methods.calculateCorrectStatus = function () {
    if (this.clientSigned && this.freelancerSigned) {
        return 'active';
    } else if (this.clientSigned && !this.freelancerSigned) {
        return 'pending_freelancer';  // Client signed first, waiting for freelancer
    } else if (!this.clientSigned && this.freelancerSigned) {
        return 'pending_client';      // Freelancer signed first, waiting for client
    } else {
        return this.status || 'draft';
    }
};

// Also update the existing method to fix it:
contractSchema.methods.updateStatusFromSignatures = function () {
    this.status = this.calculateCorrectStatus();
    return this.status;
};

// virtual for calculating total paid amount
contractSchema.virtual('totalPaid').get(function () {
    return this.phases.filter(phase => phase.status === 'paid')
        .reduce((total, phase) => total + phase.amount, 0);
});

// to get current phase
contractSchema.methods.getCurrentPhase = function () {
    return this.phases.find(phase =>
        ['pending', 'in-progress'].includes(phase.status)
    ) || this.phases[this.phases.length - 1];
};

// static method to find contracts by client
contractSchema.statics.findByClient = function (clientId) {
    return this.find({ clientId });
};

// static method to find contracts by freelancer
contractSchema.statics.findByFreelancer = function (freelancerId) {
    return this.find({ freelancerId });
};

// Method to check if contract is ready for workspace
contractSchema.methods.isReadyForWorkspace = function () {
    return this.status === 'active' || (this.clientSigned && this.freelancerSigned);
};


contractSchema.methods.areBothSigned = function () {
    return this.clientSigned && this.freelancerSigned;
};

contractSchema.methods.getSigningStatus = function () {
    return {
        clientSigned: this.clientSigned,
        freelancerSigned: this.freelancerSigned,
        clientSignedAt: this.clientSignedAt,
        freelancerSignedAt: this.freelancerSignedAt,
        bothSigned: this.clientSigned && this.freelancerSigned
    };
};

contractSchema.methods.updateStatusFromSignatures = function () {
    if (this.clientSigned && this.freelancerSigned) {
        this.status = 'active';
    } else if (this.clientSigned) {
        this.status = 'pending_freelancer';
    } else if (this.freelancerSigned) {
        this.status = 'pending_client';
    }
    return this.status;
};

const Contract = mongoose.model('Contract', contractSchema);

module.exports = Contract;