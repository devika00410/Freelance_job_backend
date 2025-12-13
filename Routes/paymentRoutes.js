const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { authenticate } = require('../Middlewares/authMiddleware');

router.use(authenticate);

// Create payment intent
router.post('/create-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', metadata } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      metadata: metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Other routes can be added later
router.post('/confirm', (req, res) => {
  res.json({ message: 'Payment confirmed' });
});

router.get('/history', (req, res) => {
  res.json({ message: 'Payment history' });
});

module.exports = router;