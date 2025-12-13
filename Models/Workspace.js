const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  workspaceId: {
    type: String,
    required: true,
    unique: true
  },
  contractId: {
    type: String,
    required: true,
    ref: 'Contract'
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  freelancerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },

  // Role-based data sections
  sharedData: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'completed', 'paused', 'terminated'],
      default: 'active'
    },
    currentPhase: { type: Number, default: 1 },
    overallProgress: { type: Number, default: 0 },
    startDate: { type: Date, default: Date.now },
    estimatedEndDate: Date,
    totalBudget: Number,
    serviceType: { type: String, required: true },
    lastActivity: { type: Date, default: Date.now },
    unreadMessages: {
      client: { type: Number, default: 0 },
      freelancer: { type: Number, default: 0 }
    },
    
    // Shared messages (both can see)
    sharedMessages: [{
      _id: false,
      messageId: String,
      senderId: mongoose.Schema.Types.ObjectId,
      senderRole: String,
      content: String,
      timestamp: { type: Date, default: Date.now },
      messageType: { type: String, default: 'text' },
      attachments: [String],
      readBy: [mongoose.Schema.Types.ObjectId]
    }],
    
    // Shared files (both can see)
    sharedFiles: [{
      _id: false,
      fileId: String,
      filename: String,
      originalName: String,
      fileUrl: String,
      fileType: String,
      fileSize: Number,
      uploadedBy: mongoose.Schema.Types.ObjectId,
      uploaderRole: String,
      uploadDate: { type: Date, default: Date.now },
      description: String
    }],
    
    // Shared milestones (both can see)
    sharedMilestones: [{
      _id: false,
      milestoneId: String,
      title: String,
      description: String,
      phaseNumber: Number,
      dueDate: Date,
      amount: Number,
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'awaiting_approval', 'completed', 'approved', 'paid'],
        default: 'pending'
      },
      deliverables: [String],
      submittedDate: Date,
      approvedDate: Date,
      feedback: String
    }],
    
    // Shared video calls (both can see)
    sharedVideoCalls: [{
      _id: false,
      callId: String,
      title: String,
      description: String,
      roomUrl: String,
      roomName: String,
      scheduledTime: Date,
      duration: Number,
      status: String,
      participants: [{
        userId: mongoose.Schema.Types.ObjectId,
        role: String,
        joinedAt: Date
      }]
    }]
  },

  // Client-only data section
  clientData: {
    privateNotes: [{
      _id: false,
      noteId: String,
      content: String,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],
    privateFiles: [{
      _id: false,
      fileId: String,
      filename: String,
      fileUrl: String,
      fileType: String,
      uploadDate: { type: Date, default: Date.now },
      description: String
    }],
    paymentHistory: [{
      _id: false,
      paymentId: String,
      amount: Number,
      description: String,
      status: String,
      date: Date,
      milestoneId: String
    }],
    clientFeedback: [{
      _id: false,
      feedbackId: String,
      milestoneId: String,
      content: String,
      rating: Number,
      date: Date
    }],
    budgetTracking: {
      totalBudget: Number,
      paidAmount: Number,
      pendingAmount: Number,
      transactions: [{
        date: Date,
        amount: Number,
        description: String
      }]
    }
  },

  // Freelancer-only data section
  freelancerData: {
    privateNotes: [{
      _id: false,
      noteId: String,
      content: String,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],
    privateFiles: [{
      _id: false,
      fileId: String,
      filename: String,
      fileUrl: String,
      fileType: String,
      uploadDate: { type: Date, default: Date.now },
      description: String
    }],
    earningsTracking: {
      totalEarned: Number,
      pendingEarnings: Number,
      completedMilestones: Number,
      transactions: [{
        date: Date,
        amount: Number,
        description: String,
        status: String
      }]
    },
    workLogs: [{
      _id: false,
      logId: String,
      date: Date,
      hours: Number,
      description: String,
      milestoneId: String
    }],
    submissionHistory: [{
      _id: false,
      submissionId: String,
      milestoneId: String,
      files: [String],
      description: String,
      submittedDate: Date,
      status: String
    }]
  },

  // Role-based permissions
  permissions: {
    client: {
      canApproveMilestones: { type: Boolean, default: true },
      canRequestRevisions: { type: Boolean, default: true },
      canUploadFiles: { type: Boolean, default: true },
      canSendMessages: { type: Boolean, default: true },
      canMakePayments: { type: Boolean, default: true },
      canScheduleCalls: { type: Boolean, default: true },
      canViewPrivateNotes: { type: Boolean, default: true },
      canViewBudget: { type: Boolean, default: true }
    },
    freelancer: {
      canSubmitWork: { type: Boolean, default: true },
      canUploadFiles: { type: Boolean, default: true },
      canSendMessages: { type: Boolean, default: true },
      canMarkComplete: { type: Boolean, default: false },
      canTrackEarnings: { type: Boolean, default: true },
      canScheduleCalls: { type: Boolean, default: true },
      canViewPrivateNotes: { type: Boolean, default: true },
      canViewEarnings: { type: Boolean, default: true }
    }
  },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// // Auto-populate names
// workspaceSchema.pre('save', async function(next) {
//   try {
//     if (!this.sharedData.title && (this.clientId || this.freelancerId)) {
//       const User = require('./User');
      
//       if (this.clientId) {
//         const client = await User.findById(this.clientId);
//         if (client && !this.sharedData.title) {
//           this.sharedData.title = `Workspace with ${client.name || client.username || 'Client'}`;
//         }
//       }
//     }
    
//     this.updatedAt = Date.now();
//   } catch (error) {
//     console.error('Error auto-filling workspace data:', error);
//   }
  
//   next();
// });

// Add this instead:
workspaceSchema.pre('save', function(next) {
  // Set updatedAt
  this.updatedAt = Date.now();
  
  // Set a default title if missing
  if (this.sharedData && !this.sharedData.title) {
    this.sharedData.title = `Workspace ${this.workspaceId || 'Untitled'}`;
  }
  
  next();
});

// Static method to get workspace data for specific role
workspaceSchema.statics.getWorkspaceForRole = async function(workspaceId, userId, role) {
  const workspace = await this.findOne({ workspaceId });
  
  if (!workspace) return null;
  
  // Check access rights
  const hasAccess = role === 'client' 
    ? workspace.clientId.toString() === userId.toString()
    : workspace.freelancerId.toString() === userId.toString();
  
  if (!hasAccess) return null;
  
  // Filter data based on role
  const filteredWorkspace = workspace.toObject();
  
  if (role === 'client') {
    // Client sees shared + client data
    return {
      ...filteredWorkspace.sharedData,
      privateData: filteredWorkspace.clientData,
      permissions: filteredWorkspace.permissions.client,
      role: 'client',
      workspaceId: filteredWorkspace.workspaceId,
      contractId: filteredWorkspace.contractId,
      clientId: filteredWorkspace.clientId,
      freelancerId: filteredWorkspace.freelancerId,
      projectId: filteredWorkspace.projectId
    };
  } else if (role === 'freelancer') {
    // Freelancer sees shared + freelancer data
    return {
      ...filteredWorkspace.sharedData,
      privateData: filteredWorkspace.freelancerData,
      permissions: filteredWorkspace.permissions.freelancer,
      role: 'freelancer',
      workspaceId: filteredWorkspace.workspaceId,
      contractId: filteredWorkspace.contractId,
      clientId: filteredWorkspace.clientId,
      freelancerId: filteredWorkspace.freelancerId,
      projectId: filteredWorkspace.projectId
    };
  }
  
  return null;
};

// Method to add a shared message
workspaceSchema.methods.addSharedMessage = function(messageData) {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  this.sharedData.sharedMessages.push({
    messageId,
    ...messageData,
    timestamp: new Date()
  });
  
  this.sharedData.lastActivity = new Date();
  
  // Increment unread count for the other participant
  if (messageData.senderRole === 'client') {
    this.sharedData.unreadMessages.freelancer += 1;
  } else {
    this.sharedData.unreadMessages.client += 1;
  }
  
  return messageId;
};

// Method to add a private note
workspaceSchema.methods.addPrivateNote = function(role, noteData) {
  const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const note = {
    noteId,
    content: noteData.content,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  if (role === 'client') {
    this.clientData.privateNotes.push(note);
  } else {
    this.freelancerData.privateNotes.push(note);
  }
  
  return noteId;
};

// Method to mark messages as read
workspaceSchema.methods.markMessagesAsRead = function(role, userId) {
  this.sharedData.sharedMessages.forEach(message => {
    if (!message.readBy.includes(userId)) {
      message.readBy.push(userId);
    }
  });
  
  // Reset unread count for this user
  if (role === 'client') {
    this.sharedData.unreadMessages.client = 0;
  } else {
    this.sharedData.unreadMessages.freelancer = 0;
  }
};

module.exports = mongoose.model('Workspace', workspaceSchema);