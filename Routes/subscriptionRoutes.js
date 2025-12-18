const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../Models/Subscription');
const { authenticate } = require('../Middlewares/authMiddleware');
const authenticateAdmin = require('../Middlewares/adminMiddleware');
const User = require('../Models/User');
const AdminNotification = require('../Models/Notification');
// const UserNotification = require('../Models/UserNotification'); // ADD THIS IMPORT

// Helper functions moved to top
function getMonthlyPrice(planId) {
  const prices = {
    'client_plan': 2900,
    'freelancer_plan': 1900
  };
  return prices[planId] || 0;
}

function getYearlyPrice(planId) {
  const prices = {
    'client_plan': 27800,
    'freelancer_plan': 18200
  };
  return prices[planId] || 0;
}

function calculateExpiryDate(billingCycle) {
  const expiry = new Date();
  if (billingCycle === 'monthly') {
    expiry.setMonth(expiry.getMonth() + 1);
  } else {
    expiry.setFullYear(expiry.getFullYear() + 1);
  }
  return expiry;
}

// Get all subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = [
      {
        _id: 'free',
        name: 'Starter',
        price: 0,
        features: ['1 Active Project', 'Basic Workspace', '500MB Storage']
      },
      {
        _id: 'client_plan',
        name: 'Client',
        monthlyPrice: 2900, // $29.00 in cents
        yearlyPrice: 27800, // $278.00 in cents
        features: ['Unlimited Projects', 'Milestone Management', 'Priority Support']
      },
      {
        _id: 'freelancer_plan',
        name: 'Freelancer',
        monthlyPrice: 1900,
        yearlyPrice: 18200,
        features: ['Unlimited Proposals', 'Workspace Access', 'Portfolio Showcase']
      }
    ];
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Stripe Checkout Session
router.post('/create-checkout', authenticate, async (req, res) => {
  try {
    const { planId, billingCycle } = req.body;
    
    // Use authenticated user's ID
    const userId = req.user._id;
    
    // Validate required fields
    if (!planId || !billingCycle) {
      return res.status(400).json({ 
        message: 'Missing required fields: planId and billingCycle are required' 
      });
    }
    
    // Validate billing cycle
    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({ 
        message: 'Invalid billingCycle. Must be "monthly" or "yearly"' 
      });
    }
    
    // Validate plan
    if (!['client_plan', 'freelancer_plan'].includes(planId)) {
      return res.status(400).json({ 
        message: 'Invalid planId. Must be "client_plan" or "freelancer_plan"' 
      });
    }

    // Calculate amount based on billing cycle
    const amount = billingCycle === 'yearly' 
      ? getYearlyPrice(planId) 
      : getMonthlyPrice(planId);

    // Check if amount is valid
    if (amount <= 0) {
      return res.status(400).json({ 
        message: 'Invalid plan or pricing configuration' 
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${planId.replace('_', ' ')} Plan`,
              description: billingCycle === 'yearly' ? 'Annual Subscription' : 'Monthly Subscription'
            },
            unit_amount: amount,
            recurring: billingCycle === 'yearly' ? { interval: 'year' } : { interval: 'month' }
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: {
        userId: userId.toString(),
        planId,
        billingCycle
      }
    });

    // Create pending subscription
    await Subscription.create({
      userId,
      planId,
      billingCycle,
      amount: amount / 100, // Convert cents to dollars
      status: 'pending_payment',
      stripeSessionId: session.id
    });

    console.log(`Created checkout session: ${session.id} for user: ${userId}`);
    
    res.json({ 
      url: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      message: 'Failed to create checkout session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// Webhook for Stripe events
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleSuccessfulPayment(session);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

async function handleSuccessfulPayment(session) {
  try {
    const { userId, planId, billingCycle } = session.metadata;
    
    console.log(`Handling successful payment for session: ${session.id}, user: ${userId}`);
    
    // Update subscription status
    await Subscription.findOneAndUpdate(
      { stripeSessionId: session.id },
      {
        status: 'pending_admin_approval',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        paymentDate: new Date()
      }
    );

    // Notify admin
    await AdminNotification.create({
      type: 'new_subscription',
      title: 'New Subscription Payment',
      message: `User ${userId} has paid for ${planId} plan. Requires approval.`,
      data: {
        userId,
        planId,
        amount: session.amount_total / 100,
        billingCycle
      },
      priority: 'medium'
    });

  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

// ADD MISSING HANDLER FUNCTIONS
async function handleInvoicePaid(invoice) {
  try {
    console.log(`Invoice paid: ${invoice.id}`);
    // Handle recurring invoice payments
    // You might want to update subscription renewal dates here
  } catch (error) {
    console.error('Error handling invoice paid:', error);
  }
}

async function handlePaymentFailed(invoice) {
  try {
    console.log(`Payment failed for invoice: ${invoice.id}`);
    
    // Update subscription status to failed
    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: invoice.subscription },
      {
        status: 'payment_failed',
        lastError: 'Payment failed for recurring invoice'
      }
    );
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

// Admin approval endpoint
router.post('/admin/approve-subscription', authenticate, authenticateAdmin, async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ message: 'subscriptionId is required' });
    }
    
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Update subscription
    subscription.status = 'active';
    subscription.approvedAt = new Date();
    subscription.approvedBy = req.user._id;
    await subscription.save();

    // Update user's plan
    await User.findByIdAndUpdate(subscription.userId, {
      subscriptionPlan: subscription.planId,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: calculateExpiryDate(subscription.billingCycle)
    });

    // Create user notification
    await UserNotification.create({
      userId: subscription.userId,
      type: 'subscription_approved',
      title: 'Subscription Activated!',
      message: `Your ${subscription.planId} subscription has been approved and is now active.`
    });

    res.json({ 
      message: 'Subscription approved successfully',
      subscription 
    });
  } catch (error) {
    console.error('Error approving subscription:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get pending subscriptions for admin dashboard
router.get('/admin/pending-subscriptions', authenticate, authenticateAdmin, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ status: 'pending_admin_approval' })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Calculate monthly recurring revenue for dashboard
router.get('/admin/revenue-stats', authenticate, authenticateAdmin, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stats = await Subscription.aggregate([
      {
        $match: {
          status: 'active',
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          activeSubscriptions: { $sum: 1 },
          mrr: { 
            $sum: { 
              $cond: [
                { $eq: ['$billingCycle', 'monthly'] },
                '$amount',
                { $divide: ['$amount', 12] } // Annual to monthly
              ]
            }
          }
        }
      }
    ]);

    res.json(stats[0] || { totalRevenue: 0, activeSubscriptions: 0, mrr: 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;