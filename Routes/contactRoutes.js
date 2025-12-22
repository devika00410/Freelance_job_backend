// contactRoutes.js
const express = require('express');
const router = express.Router();
const contactController = require('../Controllers/contactController');
const { authenticate, authorize } = require('../Middlewares/authMiddleware');

// Public routes (no authentication required)
router.post('/submit', contactController.submitContact);


router.post('/contacts/submit', async (req, res) => {
  try {
    const { name, email, subject, message, userType } = req.body;
    
    // Create new contact record
    const newContact = new Contact({
      name,
      email,
      subject,
      message,
      userType,
      status: 'new',
      priority: 'medium',
      createdAt: new Date()
    });
    
    await newContact.save();
    
    // Optional: Send email notification to admin
    sendAdminNotificationEmail(name, email, subject, message);
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newContact
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form'
    });
  }
});

router.get('/admin/unread-count', authenticate, authorize(['admin', 'support']), async (req, res) => {
  try {
    const count = await Contact.countDocuments({ status: 'new' });
    const recent = await Contact.find({ status: 'new' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email subject createdAt');
    
    res.json({
      success: true,
      count,
      recentMessages: recent
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching unread contacts' 
    });
  }
});
// Admin-only routes (require authentication and admin role)
router.get('/all', authenticate, authorize(['admin', 'support']), contactController.getAllContacts);
router.get('/stats', authenticate, authorize(['admin', 'support']), contactController.getContactStats);
router.get('/:id', authenticate, authorize(['admin', 'support']), contactController.getContactById);
router.put('/:id/status', authenticate, authorize(['admin', 'support']), contactController.updateContactStatus);
router.post('/:id/notes', authenticate, authorize(['admin', 'support']), contactController.addAdminNote);
router.post('/:id/respond', authenticate, authorize(['admin', 'support']), contactController.sendResponse);

module.exports = router;