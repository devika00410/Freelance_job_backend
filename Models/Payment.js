const mongoose = require('mongoose');

const paymentProofSchema = new mongoose.Schema({
  clientSentProof: {
    type: String,
    default: null
  },
  freelancerReceivedProof: {
    type: String,
    default: null
  },
  clientSentDate: {
    type: Date,
    default: null
  },
  freelancerConfirmedDate: {
    type: Date,
    default: null
  },
  transactionId: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'paypal', 'stripe', 'wise', 'other'],
    default: null
  }
});

const disputeSchema = new mongoose.Schema({
  hasDispute: {
    type: Boolean,
    default: false
  },
  disputeReason: {
    type: String,
    default: null
  },
  raisedBy: {
    type: String,
    default: null
  },
  raisedAt: {
    type: Date,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolution: {
    type: String,
    default: null
  }
});

const paymentPhaseSchema = new mongoose.Schema({
  paymentPhaseId: {
    type: String,
    required: true,
    unique: true
  },
  projectId: {
    type: String,
    required: true
  },
  workspaceId: {
    type: String,
    required: true
  },
  phaseNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  phaseTitle: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'disputed', 'refunded'],
    default: 'pending'
  },
  paymentProof: paymentProofSchema,
  dispute: disputeSchema,
  completionDate: {
    type: Date,
    default: null
  },
  dueDate: {
    type: Date,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  fees: {
    platformFee: {
      type: Number,
      default: 0
    },
    transactionFee: {
      type: Number,
      default: 0
    },
    totalFees: {
      type: Number,
      default: 0
    }
  },
  netAmount: {
    type: Number,
    default: 0
  },
  metadata: {
    milestoneId: String,
    invoiceNumber: String,
    notes: String
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

paymentPhaseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  if (this.amount && this.fees) {
    this.fees.totalFees = (this.fees.platformFee || 0) + (this.fees.transactionFee || 0);
    this.netAmount = this.amount - this.fees.totalFees;
  }
  
  if (this.dispute.hasDispute && !this.dispute.raisedAt) {
    this.dispute.raisedAt = new Date();
    this.status = 'disputed';
  }
  
  if (this.paymentProof.clientSentDate && !this.completionDate) {
    this.completionDate = new Date();
    this.status = 'processing';
  }
  
  if (this.paymentProof.freelancerConfirmedDate) {
    this.status = 'completed';
  }
  
  next();
});

paymentPhaseSchema.virtual('isOverdue').get(function() {
  return new Date() > this.dueDate && this.status === 'pending';
});

paymentPhaseSchema.virtual('daysOverdue').get(function() {
  if (this.status !== 'pending') return 0;
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = today - due;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

paymentPhaseSchema.methods.submitPaymentProof = function(proofUrl, transactionId, paymentMethod) {
  this.paymentProof.clientSentProof = proofUrl;
  this.paymentProof.clientSentDate = new Date();
  this.paymentProof.transactionId = transactionId;
  this.paymentProof.paymentMethod = paymentMethod;
  this.status = 'processing';
  return this.save();
};

paymentPhaseSchema.methods.confirmPayment = function(proofUrl = null) {
  this.paymentProof.freelancerReceivedProof = proofUrl || this.paymentProof.clientSentProof;
  this.paymentProof.freelancerConfirmedDate = new Date();
  this.status = 'completed';
  return this.save();
};

paymentPhaseSchema.methods.raiseDispute = function(reason, raisedBy) {
  this.dispute.hasDispute = true;
  this.dispute.disputeReason = reason;
  this.dispute.raisedBy = raisedBy;
  this.dispute.raisedAt = new Date();
  this.status = 'disputed';
  return this.save();
};

paymentPhaseSchema.methods.resolveDispute = function(resolution) {
  this.dispute.resolvedAt = new Date();
  this.dispute.resolution = resolution;
  this.dispute.hasDispute = false;
  
  if (resolution === 'payment_released') {
    this.status = 'completed';
    this.paymentProof.freelancerConfirmedDate = new Date();
  } else if (resolution === 'payment_refunded') {
    this.status = 'refunded';
  }
  
  return this.save();
};

paymentPhaseSchema.statics.findByProject = function(projectId) {
  return this.find({ projectId }).sort({ phaseNumber: 1 });
};

paymentPhaseSchema.statics.findByWorkspace = function(workspaceId) {
  return this.find({ workspaceId }).sort({ phaseNumber: 1 });
};

paymentPhaseSchema.statics.findOverdue = function() {
  return this.find({ 
    dueDate: { $lt: new Date() },
    status: 'pending'
  });
};

paymentPhaseSchema.index({ projectId: 1, phaseNumber: 1 });
paymentPhaseSchema.index({ workspaceId: 1, status: 1 });
paymentPhaseSchema.index({ dueDate: 1 });
paymentPhaseSchema.index({ status: 1 });

const PaymentPhase = mongoose.model('PaymentPhase', paymentPhaseSchema);

module.exports = PaymentPhase;