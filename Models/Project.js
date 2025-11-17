const mongoose = require('mongoose')

const milestoneSchema = new mongoose.Schema({
    title:{
        type:String,
        required:true,
        trim:true
    },
    description:{
        type:String,
        required:true
    },
    amount:{
        type:Number,
        required:true,
        min:0
    },
    status:{
        type:String,
        enum:['pending','in-progress','completed','approved','paid'],
        default:['pending']
    },
    dueDate:{
        type:Date,
        required:true
    },
    completedAt:{
        type:Date
    }
},{_id:true});

const deliverableSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        trim:true
    },
    type:{
        type:String,
        enum:['code_repository','pdf','document','design_file','other'],
        required:true
    },
    url:{
        type:String,
        required:true
    },
    submittedAt:{
        type:Date,
        default:Date.now
    }
}, {_id:true});

const reviewSchema = new mongoose.Schema({
    rating:{
        type:Number,
        required:true,
        min:1,
        max:5
    },
    comment:{
        type:String,
        required:true,
        trim:true
    },
    submittedAt:{
        type:Date,
        default:Date.now
    }
},{_id:true});

const projectSchema = new mongoose.Schema({
    //   Reference to Job
    jobId: {
        type: String,  // Matches Job._id type
        ref: 'Job',
        required: true,
        unique: true
    },
    
    //  People (from Job)
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
    //  Project Details 
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    budget: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'USD'
    },
    serviceCategory: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    skillsRequired: [{
        type: String,
        trim: true
    }],
    experienceLevel: {
        type: String,
        enum: ['entry', 'intermediate', 'expert'],
        required: true
    },
    duration: {
        type: String,
        required: true
    },
    projectType: {
        type: String,
        enum: ['one_time', 'ongoing', 'hourly'],
        required: true
    },
    
    //  Execution Status
    status: {
        type: String,
        enum: ['active', 'in_progress', 'under_review', 'completed', 'cancelled', 'disputed'],
        default: 'active'
    },
    
    //  Execution Timeline
    timeline: {
        startDate: {
            type: Date,
            default: Date.now
        },
        deadline: {
            type: Date,
            required: true
        },
        completedAt: {
            type: Date
        },
        extendedDeadline: {
            type: Date
        }
    },
    
    //  Milestones & Deliverables
    milestones: [milestoneSchema],
    deliverables: [deliverableSchema],
    
    //  Payment Tracking
    paymentInfo: {
        totalPaid: {
            type: Number,
            default: 0
        },
        lastPaymentDate: {
            type: Date
        }
    },
    
    //  Work Metrics
    workMetrics: {
        totalHours: {
            type: Number,
            default: 0
        },
        hoursLogged: {
            type: Number,
            default: 0
        },
        onTimeDelivery: {
            type: Boolean,
            default: false
        }
    },
    
    // Communication
    communication: {
        chatChannel: {
            type: String,
            trim: true
        },
        weeklyUpdates: {
            type: Boolean,
            default: false
        }
    },
    
    // Reviews
    reviews: {
        clientReview: reviewSchema,
        freelancerReview: reviewSchema
    }
}, {
    timestamps: true
});

// Indexes for better performance
projectSchema.index({ jobId: 1 }, { unique: true });
projectSchema.index({ freelancerId: 1, status: 1 });
projectSchema.index({ clientId: 1, status: 1 });
projectSchema.index({ category: 1, status: 1 });
projectSchema.index({ createdAt: -1 });

// Virtual for calculating remaining budget
projectSchema.virtual('remainingBudget').get(function() {
    return this.budget - (this.paymentInfo.totalPaid || 0);
});

// Virtual for total milestones amount
projectSchema.virtual('totalMilestonesAmount').get(function() {
    return this.milestones.reduce((total, milestone) => total + milestone.amount, 0);
});

// Method to check if project is active
projectSchema.methods.isActive = function() {
    return ['active', 'in_progress'].includes(this.status);
};

// Method to calculate progress percentage based on milestones
projectSchema.methods.getProgress = function() {
    if (this.milestones.length === 0) return 0;
    const completed = this.milestones.filter(m => 
        ['completed', 'paid'].includes(m.status)
    ).length;
    return (completed / this.milestones.length) * 100;
};

// Method to add a milestone
projectSchema.methods.addMilestone = function(milestoneData) {
    this.milestones.push(milestoneData);
    return this.save();
};

// Method to update milestone status
projectSchema.methods.updateMilestoneStatus = function(milestoneId, status) {
    const milestone = this.milestones.id(milestoneId);
    if (milestone) {
        milestone.status = status;
        if (status === 'completed') {
            milestone.completedAt = new Date();
        }
        return this.save();
    }
    throw new Error('Milestone not found');
};

// Method to mark project as completed
projectSchema.methods.markAsCompleted = function() {
    this.status = 'completed';
    this.timeline.completedAt = new Date();
    return this.save();
};

// Static method to find projects by freelancer
projectSchema.statics.findByFreelancer = function(freelancerId) {
    return this.find({ freelancerId }).sort({ createdAt: -1 });
};

// Static method to find projects by client
projectSchema.statics.findByClient = function(clientId) {
    return this.find({ clientId }).sort({ createdAt: -1 });
};

// Static method to find active projects
projectSchema.statics.findActive = function() {
    return this.find({
        status: { $in: ['active', 'in_progress'] }
    });
};

// Pre-save middleware to ensure data consistency
projectSchema.pre('save', async function(next) {
    try {
        // Validate that the referenced job exists
        if (this.isNew) {
            const Job = mongoose.model('Job');
            const job = await Job.findById(this.jobId);
            if (!job) {
                throw new Error('Referenced Job does not exist');
            }
            
            // Ensure this freelancer was hired for the job
            if (job.hiredFreelancer !== this.freelancerId) {
                throw new Error('Freelancer was not hired for this job');
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
