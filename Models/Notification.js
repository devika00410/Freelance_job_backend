const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  notificationId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    enum: ['client', 'freelancer', 'admin'],
    required: true
  },

type: {
  type: String,
  enum: [
    'milestone_submission',
    'milestone_approved', 
    'milestone_revision',
    'payment_sent',
    'payment_received',
    'payment_failed',
    'project_invitation',
    'contract_sent',     
    'contract_signed',   
    'contract_created',   
    'contract_updated',   
    'contract_cancelled', 
    'message_received',
    'file_uploaded',
    'deadline_reminder',
    'project_completed',
    'dispute_raised',
    'dispute_resolved',
    'system_announcement'
  ],
  required: true
},
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: [
      'project_update',
      'payment',
      'message',
      'system',
      'reminder',
      'security',
      'contract'
    ],
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  actionRequired: {
    type: Boolean,
    default: false
  },
  metadata: {
    projectId: {
      type: String,
      default: null
    },
    workspaceId: {
      type: String,
      default: null
    },
    milestoneId: {
      type: String,
      default: null
    },
    paymentId: {
      type: String,
      default: null
    },
    chatroomId: {
      type: String,
      default: null
    },
    fileId: {
      type: String,
      default: null
    },
    triggeredBy: {
      type: String,
      default: null
    },
    triggeredByRole: {
      type: String,
      enum: ['client', 'freelancer', 'admin', 'system'],
      default: null
    },
    additionalData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  actionUrl: {
    type: String,
    default: null
  },
  expiresAt: {
    type: Date,
    default: function() {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      return expiryDate;
    }
  },
  readAt: {
    type: Date,
    default: null
  },
  archivedAt: {
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

notificationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  if (this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  
  if (this.isArchived && !this.archivedAt) {
    this.archivedAt = new Date();
  }
  
  next();
});

notificationSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

notificationSchema.virtual('daysSinceCreated').get(function() {
  const diffTime = Math.abs(new Date() - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

notificationSchema.virtual('isActionable').get(function() {
  return this.actionRequired && !this.isRead && !this.isExpired;
});

notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsUnread = function() {
  this.isRead = false;
  this.readAt = null;
  return this.save();
};

notificationSchema.methods.archive = function() {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

notificationSchema.methods.unarchive = function() {
  this.isArchived = false;
  this.archivedAt = null;
  return this.save();
};

notificationSchema.statics.findByUser = function(userId, options = {}) {
  const { 
    limit = 50, 
    skip = 0, 
    unreadOnly = false, 
    archived = false,
    category = null 
  } = options;
  
  const query = { userId, isArchived: archived };
  
  if (unreadOnly) {
    query.isRead = false;
  }
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

notificationSchema.statics.findByProject = function(projectId) {
  return this.find({ 
    'metadata.projectId': projectId,
    isArchived: false 
  }).sort({ createdAt: -1 });
};

notificationSchema.statics.findByWorkspace = function(workspaceId) {
  return this.find({ 
    'metadata.workspaceId': workspaceId,
    isArchived: false 
  }).sort({ createdAt: -1 });
};

notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { 
      userId, 
      isRead: false 
    },
    { 
      isRead: true,
      readAt: new Date() 
    }
  );
};

notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ 
    userId, 
    isRead: false,
    isArchived: false 
  });
};

notificationSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
        },
        actionRequired: {
          $sum: { $cond: [{ $eq: ['$actionRequired', true] }, 1, 0] }
        },
        byCategory: {
          $push: {
            category: '$category',
            isRead: '$isRead'
          }
        }
      }
    }
  ]);
};

notificationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({ 
    expiresAt: { $lt: new Date() } 
  });
};

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, isArchived: 1 });
notificationSchema.index({ 'metadata.projectId': 1 });
notificationSchema.index({ 'metadata.workspaceId': 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;