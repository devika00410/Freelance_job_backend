const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
    currentStatus:{
        type:String,
        enum:['not_started',
            'in_progress',
            'awaiting_client_approval',
            "client_review",
            'revisions_requested',
            'approved',
            'competed',
            'paid',
            'disputed'
        ],
        default:'not_started'
    },
    freelancerSubmitted:{
        type:Date,
        default:null
    },
    clientApproved:{
        type:Boolean,
        default:false
    },
    clientApprovedAt:{
        type:Date,
        default:null
    },
    submittedWork:[{
        filename:String,
        fileUrl:String,
        fileType:String,
        uploadedAt:{
            type:Date,
            default:Date.now
        },
        description:String,
        version:{
            type:Number,
            default:1
        }
    }],
    clientFeedback:{
        type:String,
        trim:true,
        default:null
    },
    feedbackHistory:[{
        feedback:String,
        givenBy:String,
        givenAt:{
            type:Date,
            default:Date.now
        },
        type:{
            type:String,
            enum:['general','revision','approval','rejection'],
            default:'general'
        }
    }],
    revisions:{
        count:{
            type:Number,
            default:0
        },
        maxAllowed:{
            type:Number,
            default:3
        },
        history:[{
            revisionNumber:Number,
            requestedAt:Date,
            requestedBy:String,
            reason:String,
            completedAt:Date,
            changesMade:String
        }]
    }
});

const requirementsSchema= new mongoose.Schema({
    requirement:{
        type:String,
        required:true,
        trim:true
    },
    completed:{
        type:Boolean,
        default:false
    },
    completedAt:{
        type:Date,
        default:null
    },
    verifiedBy:{
        type:String,
        default:null
    }
});

const milestoneSchema = new mongoose.Schema({
    milestoneId:{
        type:String,
        required:true,
        unique:true,
        trim:true
    },
    projectId:{
        type:String,
        required:true,
        trim:true
    },
    workspaceId:{
        type:String,
        required:true,
        trim:true,
        
    },
phaseNumber:{
    type:Number,
    required:true,
    min:1,
    max:5,
    validate:{
        validator:Number.isInteger,
        message:'Phase number must be an integer'
    }
},
phaseTitle:{
    type:String,
    required:true,
    trim:true
},
description:{
    type:String,
    required:true,
    trim:true
},
dueDate:{
    type:Date,
    required:true
},
phaseAmount:{
    type:Number,
    required:true,
    min:0
},
status:{
    type:String,
    enum:[
        'not_started',
        'in_progress',
        'awaiting_approval',
        'approved',
        'completed',
        'paid',
        'cancelled',
        'disputed'
    ],
    default:'not_started'
},
progress:progressSchema,
completionRequiements:[requirementsSchema],
dependencies:[{
    phaseNumber:Number,
    milestoneId:String,
    requirement:String
}],

nextPhase:{
    type:Number,
    min:2,
    max:5,
    validate:{
        validator:function(value){
            return value === null || (value>this.phaseNumber && value <=5);

        },
        message:'Next phase must be greater than current phase and not exceed 5'

    }
},
timeline:{
    estimatedStartDate:Date,
    actualStartDate:Date,
    estimatedEndDate:Date,
    actualEndDate:Date,
    daysExtended:{
        type:Number,
        default:0
    },
    extensionReason:String
},
payment:{
    released:{
        type:Boolean,
        default:false
    },
    releasedAt:Date,
    transactionId:String,
    amount:Number,
    paymentMethod:String
},
metadata:{
    priority:{
        type:String,
        enum:['low','medium','high','critical'],
        default:'medium'
    },
    complexity:{
        type:String,
        enum:['simple','moderate','complex'],
        default:'moderate'
    },
    tags:[String]
},
createdBy:{
    type:String,
    required:true
},
assignedTo:{
    type:String,
    required:true
},
createdAt:{
    type:Date,
    default:Date.now
},
updatedAt:{
    type:Date,
    default:Date.now
}
})

milestoneSchema.pre('save',function(next){
    this.updatedAt = Date.now();

    if(this.phaseNumber <5){
        this.nextPhase = this.phaseNumber +1;
    } else{
        this.nextPhase = null
    };

    // update status based on progress

    if(this.progress){
        if(this.progress.currentStatus === 'approved' && this.progress.clientApproved)
        {
            this.status = 'approved';
        } else if(this.progress.currentStatus === 'paid'){
            this.status = 'paid'
        }
    }

    // calculate completion percentage based on requirements
    if(this.completionRequiements && this.completionRequiements.length>0){
        const completedCount = this.completionRequirements.filter(req=>req.completed).length;
        this.progressPercentage = (completedCount / this.completionRequiements.length)*100
    }
    next()
});

// virtual for overdue status
milestoneSchema.virtual('isOverdue').get(function() {
  return new Date() > this.dueDate && !['completed', 'paid'].includes(this.status);
});


// virtual for days remaining
milestoneSchema.virtual('daysRemaining').get(function() {
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// method to submit work for approval
milestoneSchema.methods.submitForApproval = function(files, description = '') {
  this.progress.currentStatus = 'awaiting_client_approval';
  this.progress.freelancerSubmitted = new Date();
  this.status = 'awaiting_approval';
  
  if (files && files.length > 0) {
    this.progress.submittedWork.push(...files);
  }
  
  return this.save();
};

// method to approve milestone
milestoneSchema.methods.approveMilestone = function(clientId, feedback = '') {
  this.progress.clientApproved = true;
  this.progress.clientApprovedAt = new Date();
  this.progress.currentStatus = 'approved';
  this.status = 'approved';
  
  if (feedback) {
    this.progress.clientFeedback = feedback;
    this.progress.feedbackHistory.push({
      feedback,
      givenBy: clientId,
      type: 'approval'
    });
  }
  
  return this.save();
};

// method to request revision
milestoneSchema.methods.requestRevision = function(requestedBy, feedback, changesRequested) {
  this.progress.currentStatus = 'revisions_requested';
  this.progress.clientApproved = false;
  this.progress.clientFeedback = feedback;
  
  this.progress.revisions.count += 1;
  this.progress.revisions.history.push({
    revisionNumber: this.progress.revisions.count,
    requestedAt: new Date(),
    requestedBy,
    reason: feedback,
    changesMade: changesRequested || ''
  });
  
  this.progress.feedbackHistory.push({
    feedback,
    givenBy: requestedBy,
    type: 'revision'
  });
  return this.save();
};

// method to complete requirement

milestoneSchema.methods.completeRequirement = function(requirementIndex, verifiedBy = null) {
  if (this.completionRequirements[requirementIndex]) {
    this.completionRequirements[requirementIndex].completed = true;
    this.completionRequirements[requirementIndex].completedAt = new Date();
    this.completionRequirements[requirementIndex].verifiedBy = verifiedBy;
  }
  return this.save();
};

// static method to find milestones by project
milestoneSchema.statics.findByProject = function(projectId) {
  return this.find({ projectId }).sort({ phaseNumber: 1 });
};

// static method to find milestones by workspace
milestoneSchema.statics.findByWorkspace = function(workspaceId) {
  return this.find({ workspaceId }).sort({ phaseNumber: 1 });
};

// static method to find milestones by status
milestoneSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ dueDate: 1 });
};

// static method to get project phase summary
milestoneSchema.statics.getProjectPhaseSummary = function(projectId) {
  return this.aggregate([
    { $match: { projectId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$phaseAmount' },
        phases: { $push: '$phaseNumber' }
      }
    }
  ]);
};

//  indexes for better query performance

milestoneSchema.index({ projectId: 1, phaseNumber: 1 });
milestoneSchema.index({ workspaceId: 1, status: 1 });
milestoneSchema.index({ dueDate: 1 });
milestoneSchema.index({ status: 1 });
milestoneSchema.index({ assignedTo: 1, status: 1 });

const Milestone = mongoose.model('Milestone', milestoneSchema);

module.exports = Milestone;

