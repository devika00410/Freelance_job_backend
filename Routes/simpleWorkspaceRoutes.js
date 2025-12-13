// simpleWorkspaceRoutes.js
const express = require('express');
const router = express.Router();
const simpleWorkspaceController = require('../Controllers/simpleWorkspaceController');
const { authenticate } = require('../Middlewares/authMiddleware');

// Apply auth middleware
router.use(authenticate);

// Simple test route
router.get('/ping', (req, res) => {
  console.log('✅ PING ROUTE HIT');
  res.json({ 
    success: true, 
    message: 'pong',
    userId: req.userId,
    timestamp: new Date().toISOString()
  });
});

// Simple client workspace route
router.get('/client/:workspaceId', (req, res) => {
  console.log('✅ CLIENT ROUTE HIT');
  console.log('📌 Workspace ID:', req.params.workspaceId);
  console.log('👤 User:', req.user);
  
  // Set user role
  req.userRole = 'client';
  
  // Call the simple controller
  simpleWorkspaceController.getRoleBasedWorkspace(req, res);
});

// Simple freelancer workspace route  
router.get('/freelancer/:workspaceId', (req, res) => {
  req.userRole = 'freelancer';
  simpleWorkspaceController.getRoleBasedWorkspace(req, res);
});

module.exports = router;