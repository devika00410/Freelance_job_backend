const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  chatMessages: [{
    type: String,
    default: []
  }],
  files: [{
    type: String,
    default: []
  }],
  milestoneId: {
    type: String,
    default: null
  },
  paymentId: {
    type: String,
    default: null
  },
  contractId: {
    type: String,
    default: null
  },
  screenshots: [{
    type: String,
    default: []
  }],
  additionalNotes: {
    type: String,
    default: null
  }
});

const adminResolutionSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'assigned', 'under_review', 'resolved', 'escalated'],
    default: 'pending'
  },
  assignedAdmin: {
    type: String,
    default: null
  },
  assignedAt: {
    type: Date,
    default: null
  },
  resolution: {
    type: String,
    default: null
  },
  actionsTaken: [{
    action: {
      type: String,
      required: true
    },
    takenBy: {
      type: String,
      required: true
    },
    takenAt: {
      type: Date,
      default: Date.now
    },
    details: {
      type: String,
      default: null
    }
  }],
  resolvedAt: {
    type: Date,
    default: null
  },
  resolutionNotes: {
    type: String,
    default: null
  },
  penaltyApplied: {
    type: {
      type: String,
      enum: ['warning', 'suspension', 'termination', 'refund', 'fine', 'none'],
      default: 'none'
    },
    amount: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 0
    },
    reason: {
      type: String,
      default: null
    }
  }
});

const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true
  },
  reporterId: {
    type: String,
    required: true
  },
  reporterRole: {
    type: String,
    enum: ['client', 'freelancer', 'admin'],
    required: true
  },
  reportedUserId: {
    type: String,
    required: true
  },
  reportedUserRole: {
    type: String,
    enum: ['client', 'freelancer'],
    required: true
  },
  projectId: {
    type: String,
    required: true
  },
  workspaceId: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: [
      'payment_dispute',
      'quality_issues',
      'missed_deadline',
      'unprofessional_behavior',
      'communication_issues',
      'scope_violation',
      'payment_fraud',
      'plagiarism',
      'account_issues',
      'other'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'closed', 'rejected'],
    default: 'open'
  },
  evidence: evidenceSchema,
  adminResolution: adminResolutionSchema,
  responseFromReported: {
    response: {
      type: String,
      default: null
    },
    respondedAt: {
      type: Date,
      default: null
    },
    evidenceProvided: [{
      type: String,
      default: []
    }]
  },
  followUpActions: [{
    action: {
      type: String,
      required: true
    },
    requiredBy: {
      type: String,
      required: true
    },
    deadline: {
      type: Date,
      required: true
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date,
      default: null
    }
  }],
  communicationLog: [{
    message: {
      type: String,
      required: true
    },
    sentBy: {
      type: String,
      required: true
    },
    sentByRole: {
      type: String,
      enum: ['admin', 'reporter', 'reported_user'],
      required: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    isInternal: {
      type: Boolean,
      default: false
    }
  }],
  impactAssessment: {
    projectImpact: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    financialImpact: {
      type: Number,
      default: 0
    },
    timelineImpact: {
      type: Number,
      default: 0
    },
    relationshipImpact: {
      type: String,
      enum: ['recoverable', 'damaged', 'terminated'],
      default: 'recoverable'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  closedAt: {
    type: Date,
    default: null
  }
});

reportSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  if (this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
    this.adminResolution.resolvedAt = new Date();
    this.adminResolution.status = 'resolved';
  }

  if (this.status === 'closed' && !this.closedAt) {
    this.closedAt = new Date();
  }

  if (this.adminResolution.assignedAdmin && !this.adminResolution.assignedAt) {
    this.adminResolution.assignedAt = new Date();
    this.adminResolution.status = 'assigned';
  }

  next();
});

reportSchema.virtual('isActive').get(function() {
  return ['open', 'under_review'].includes(this.status);
});

reportSchema.virtual('daysOpen').get(function() {
  const diffTime = Math.abs(new Date() - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

reportSchema.virtual('requiresImmediateAttention').get(function() {
  return this.priority === 'urgent' || 
         (this.priority === 'high' && this.daysOpen > 2);
});

reportSchema.virtual('canBeResolved').get(function() {
  return this.status === 'open' || this.status === 'under_review';
});

reportSchema.methods.assignAdmin = function(adminId) {
  this.adminResolution.assignedAdmin = adminId;
  this.adminResolution.assignedAt = new Date();
  this.adminResolution.status = 'assigned';
  this.status = 'under_review';
  return this.save();
};

reportSchema.methods.addAction = function(action, takenBy, details = null) {
  this.adminResolution.actionsTaken.push({
    action,
    takenBy,
    details,
    takenAt: new Date()
  });
  return this.save();
};

reportSchema.methods.addCommunication = function(message, sentBy, sentByRole, isInternal = false) {
  this.communicationLog.push({
    message,
    sentBy,
    sentByRole,
    isInternal,
    sentAt: new Date()
  });
  return this.save();
};

reportSchema.methods.resolveReport = function(resolution, resolutionNotes, penalty = null) {
  this.status = 'resolved';
  this.adminResolution.resolution = resolution;
  this.adminResolution.resolutionNotes = resolutionNotes;
  this.adminResolution.status = 'resolved';
  
  if (penalty) {
    this.adminResolution.penaltyApplied = penalty;
  }
  
  this.resolvedAt = new Date();
  return this.save();
};

reportSchema.methods.addFollowUpAction = function(action, requiredBy, deadline) {
  this.followUpActions.push({
    action,
    requiredBy,
    deadline,
    completed: false
  });
  return this.save();
};

reportSchema.methods.completeFollowUpAction = function(actionIndex) {
  if (this.followUpActions[actionIndex]) {
    this.followUpActions[actionIndex].completed = true;
    this.followUpActions[actionIndex].completedAt = new Date();
  }
  return this.save();
};

reportSchema.statics.findByReporter = function(reporterId) {
  return this.find({ reporterId }).sort({ createdAt: -1 });
};

reportSchema.statics.findByReportedUser = function(reportedUserId) {
  return this.find({ reportedUserId }).sort({ createdAt: -1 });
};

reportSchema.statics.findByProject = function(projectId) {
  return this.find({ projectId }).sort({ createdAt: -1 });
};

reportSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ priority: -1, createdAt: -1 });
};

reportSchema.statics.findByAdmin = function(adminId) {
  return this.find({ 'adminResolution.assignedAdmin': adminId }).sort({ createdAt: -1 });
};

reportSchema.statics.getReportStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        highPriority: {
          $sum: { $cond: [{ $in: ['$priority', ['high', 'urgent']] }, 1, 0] }
        },
        byCategory: {
          $push: {
            category: '$category',
            priority: '$priority'
          }
        }
      }
    }
  ]);
};

reportSchema.index({ reportId: 1 });
reportSchema.index({ reporterId: 1 });
reportSchema.index({ reportedUserId: 1 });
reportSchema.index({ projectId: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ priority: -1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ 'adminResolution.assignedAdmin': 1 });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;