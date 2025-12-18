const Subscription = require('../Models/Subscription');
const User = require('../Models/User');
const AdminNotification = require('../Models/Notification');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.getPlans = async (req, res) => {
  try {
    const plans = [
      {
        _id: 'free',
        name: 'Starter',
        price: 0,
        features: ['1 Active Project', 'Basic Workspace', '500MB Storage', 'Community Support']
      },
      {
        _id: 'client_plan',
        name: 'Client',
        monthlyPrice: 2900,
        yearlyPrice: 27800,
        features: ['Unlimited Projects', 'Milestone Management', 'Priority Support', '10GB Storage']
      },
      {
        _id: 'freelancer_plan',
        name: 'Freelancer',
        monthlyPrice: 1900,
        yearlyPrice: 18200,
        features: ['Unlimited Proposals', 'Workspace Access', 'File Sharing', '5GB Storage']
      },
      {
        _id: 'enterprise',
        name: 'Enterprise',
        customPrice: true,
        features: ['Unlimited Everything', 'Dedicated Support', 'Custom Solutions', 'API Access']
      }
    ];
    res.status(200).json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createCheckoutSession = async (req, res) => {
  try {
    const { planId, billingCycle, userId } = req.body;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let priceId;
    let amount;
    
    // Map to Stripe Price IDs (you need to create these in Stripe Dashboard)
    const priceMap = {
      'client_plan_monthly': 'price_xxx_monthly',
      'client_plan_yearly': 'price_xxx_yearly',
      'freelancer_plan_monthly': 'price_yyy_monthly',
      'freelancer_plan_yearly': 'price_yyy_yearly'
    };

    if (planId === 'enterprise') {
      // For enterprise, redirect to contact form
      return res.status(200).json({ 
        redirectUrl: '/schedule-call',
        type: 'enterprise' 
      });
    }

    // Create Stripe Customer if doesn't exist
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user._id.toString() }
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceMap[`${planId}_${billingCycle}`],
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: {
        userId: user._id.toString(),
        planId,
        billingCycle
      },
      subscription_data: {
        metadata: {
          userId: user._id.toString(),
          planId,
          billingCycle
        }
      }
    });

    // Create pending subscription record
    const subscription = new Subscription({
      userId: user._id,
      planId,
      billingCycle,
      amount: billingCycle === 'monthly' ? 29 : 278, // Adjust based on plan
      status: 'pending_payment',
      stripeSessionId: session.id
    });
    await subscription.save();

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: error.message });
  }
};

async function handleCheckoutCompleted(session) {
  const { userId, planId, billingCycle } = session.metadata;
  
  // Find and update subscription
  const subscription = await Subscription.findOne({ stripeSessionId: session.id });
  if (subscription) {
    subscription.status = 'pending_admin_approval';
    subscription.stripeCustomerId = session.customer;
    subscription.stripeSubscriptionId = session.subscription;
    await subscription.save();
    
    // Create admin notification
    await AdminNotification.create({
      type: 'new_subscription',
      title: 'New Subscription Payment',
      message: `User has paid for ${planId} plan. Requires approval.`,
      data: {
        userId,
        planId,
        amount: session.amount_total / 100,
        billingCycle
      },
      priority: 'medium'
    });
  }
}

exports.approveSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const adminId = req.user._id;
    
    const subscription = await Subscription.findById(subscriptionId)
      .populate('userId');
    
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    if (subscription.status !== 'pending_admin_approval') {
      return res.status(400).json({ message: 'Subscription is not pending approval' });
    }

    // Update subscription
    subscription.status = 'active';
    subscription.approvedAt = new Date();
    subscription.approvedBy = adminId;
    subscription.activatedAt = new Date();
    subscription.expiresAt = subscription.calculateExpiryDate();
    await subscription.save();

    // Update user
    const user = subscription.userId;
    user.subscriptionPlan = subscription.planId;
    user.subscriptionStatus = 'active';
    user.subscriptionExpiresAt = subscription.expiresAt;
    await user.save();

    // Create user notification
    await UserNotification.create({
      userId: user._id,
      type: 'subscription_approved',
      title: 'Subscription Activated!',
      message: `Your ${subscription.planId} subscription has been approved and is now active.`,
      read: false
    });

    res.status(200).json({ 
      message: 'Subscription approved successfully',
      subscription 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPendingSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ status: 'pending_admin_approval' })
      .populate('userId', 'name email')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });
    
    res.status(200).json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRevenueStats = async (req, res) => {
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
                { $divide: ['$amount', 12] }
              ]
            }
          }
        }
      }
    ]);

    // Get today's revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRevenue = await Subscription.aggregate([
      {
        $match: {
          status: 'active',
          approvedAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          amount: { $sum: '$amount' }
        }
      }
    ]);

    const result = {
      totalRevenue: stats[0]?.totalRevenue || 0,
      activeSubscriptions: stats[0]?.activeSubscriptions || 0,
      monthlyRecurringRevenue: stats[0]?.mrr || 0,
      todayRevenue: todayRevenue[0]?.amount || 0,
      pendingApprovals: await Subscription.countDocuments({ status: 'pending_admin_approval' })
    };

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId, reason } = req.body;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Cancel in Stripe
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    }

    subscription.status = 'cancelled';
    subscription.cancellationReason = reason;
    subscription.cancelledAt = new Date();
    await subscription.save();

    // Update user
    await User.findByIdAndUpdate(subscription.userId, {
      subscriptionStatus: 'cancelled'
    });

    res.status(200).json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};