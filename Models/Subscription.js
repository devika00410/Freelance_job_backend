// models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planId: {
    type: String,
    required: true,
    enum: ['free', 'client_plan', 'freelancer_plan', 'enterprise']
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending_payment', 'pending_admin_approval', 'active', 'cancelled', 'expired', 'failed'],
    default: 'pending_payment'
  },
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  stripeSessionId: String,
  paymentMethod: String,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  activatedAt: Date,
  expiresAt: Date,
  cancellationReason: String,
  cancelledAt: Date,
  metadata: {
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

subscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

subscriptionSchema.methods.calculateExpiryDate = function() {
  const date = new Date();
  if (this.billingCycle === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (this.billingCycle === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date;
};

subscriptionSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

subscriptionSchema.statics.findActiveSubscriptions = function() {
  return this.find({ 
    status: 'active',
    expiresAt: { $gt: new Date() }
  });
};

subscriptionSchema.statics.findPendingApproval = function() {
  return this.find({ status: 'pending_admin_approval' })
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Subscription', subscriptionSchema);