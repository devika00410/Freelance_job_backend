const express = require('express');
const router = express.Router();
const workspaceController = require('../Controllers/workspaceController');
const { authenticate } = require('../Middlewares/authMiddleware');

// ==================== MIDDLEWARE ====================
router.use(authenticate);


// Add this to workspaceRoutes.js at the top after authentication middleware
router.use((req, res, next) => {
  console.log('📡 Workspace route hit:', req.method, req.url);
  console.log('👤 Authenticated user:', req.userId);
  console.log('👤 User object:', req.user);
  next();
});

// ==================== DEBUG ROUTES ====================
// Test if routes are working
router.get('/test-connection', (req, res) => {
  console.log('✅ Workspace routes test - User ID:', req.userId);
  res.json({
    success: true,
    message: 'Workspace routes are working',
    userId: req.userId,
    userRole: req.userRole,
    timestamp: new Date().toISOString()
  });
});

// List all workspaces for debugging
router.get('/debug/all', async (req, res) => {
  try {
    const Workspace = require('../Models/Workspace');
    const workspaces = await Workspace.find({}).limit(5);
    
    res.json({
      success: true,
      count: workspaces.length,
      workspaces: workspaces.map(ws => ({
        _id: ws._id,
        workspaceId: ws.workspaceId,
        title: ws.title || ws.projectTitle,
        clientId: ws.clientId,
        freelancerId: ws.freelancerId,
        status: ws.status
      }))
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== MAIN ROUTES ====================
// Client workspace route - MUST set userRole to 'client'
// In workspaceRoutes.js, replace the client route with this:


// ==================== SIMPLE FALLBACK ROUTE ====================
// Add this as a backup route
router.get('/simple/:workspaceId', async (req, res) => {
  try {
    console.log('🔍 Simple workspace route called');
    
    // Always return success with dummy data
    res.json({
      success: true,
      workspace: {
        _id: req.params.workspaceId,
        workspaceId: req.params.workspaceId,
        title: 'Digital Boost Strategy',
        description: 'Marketing strategy project workspace',
        status: 'active',
        currentPhase: 2,
        overallProgress: 45,
        totalBudget: 5000,
        startDate: new Date('2024-01-15'),
        client: {
          _id: req.userId,
          name: 'Diya',
          email: 'client@example.com'
        },
        freelancer: {
          _id: 'freelancer123',
          name: 'Elsa',
          email: 'elsa@example.com',
          skills: ['Marketing', 'Strategy', 'Digital']
        },
        milestones: [
          {
            _id: '1',
            title: 'Initial Research',
            status: 'completed',
            amount: 1000
          },
          {
            _id: '2',
            title: 'Strategy Development',
            status: 'in_progress',
            amount: 2000
          }
        ],
        recentMessages: [],
        filesCount: 3,
        userRoleInWorkspace: 'client',
        userPermissions: {
          canApproveMilestones: true,
          canUploadFiles: true,
          canSendMessages: true
        },
        createdAt: new Date('2024-01-01'),
        lastActivity: new Date()
      }
    });
  } catch (error) {
    console.error('Simple route error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// In workspaceRoutes.js, add this temporary debug route:
router.get('/debug/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.userId;
    
    console.log('=== DEBUG ROUTE START ===');
    console.log('Workspace ID:', workspaceId);
    console.log('User ID:', userId);
    console.log('User:', req.user);
    
    // Try to find the workspace
    const workspace = await Workspace.findOne({ workspaceId: workspaceId });
    console.log('Workspace found:', !!workspace);
    
    if (workspace) {
      console.log('Workspace structure:', {
        _id: workspace._id,
        workspaceId: workspace.workspaceId,
        clientId: workspace.clientId,
        freelancerId: workspace.freelancerId,
        hasSharedData: !!workspace.sharedData
      });
    }
    
    res.json({
      success: true,
      workspaceId,
      userId,
      workspaceExists: !!workspace,
      workspace: workspace ? {
        _id: workspace._id,
        workspaceId: workspace.workspaceId,
        clientId: workspace.clientId,
        freelancerId: workspace.freelancerId
      } : null
    });
    
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Add this test route
router.get('/test-db-connection', async (req, res) => {
  try {
    const Workspace = require('../Models/Workspace');
    
    // Count all workspaces
    const count = await Workspace.countDocuments();
    
    // Get one workspace to check structure
    const sample = await Workspace.findOne().lean();
    
    res.json({
      success: true,
      count: count,
      sample: sample ? {
        _id: sample._id,
        workspaceId: sample.workspaceId,
        clientId: sample.clientId,
        freelancerId: sample.freelancerId,
        hasSharedData: !!sample.sharedData
      } : null,
      message: 'Database connection working'
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add this route for testing
router.get('/test-milestones/:workspaceId', async (req, res) => {
  try {
    console.log('✅ TEST MILESTONES ROUTE HIT');
    
    // Just return dummy data for testing
    res.json({
      success: true,
      milestones: [
        {
          _id: '1',
          title: 'Initial Research',
          description: 'Complete market research',
          status: 'completed',
          phaseNumber: 1,
          amount: 1000
        },
        {
          _id: '2',
          title: 'Strategy Development',
          description: 'Create marketing strategy',
          status: 'in_progress',
          phaseNumber: 2,
          amount: 2000
        }
      ],
      currentPhase: 2,
      overallProgress: 50,
      message: 'Test milestones endpoint working'
    });
    
  } catch (error) {
    console.error('Test milestones error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// In workspaceRoutes.js, add this SIMPLE client route
router.get('/simple-client/:workspaceId', async (req, res) => {
  try {
    console.log('✅ SIMPLE CLIENT ROUTE HIT');
    
    res.json({
      success: true,
      workspace: {
        _id: 'test123',
        workspaceId: req.params.workspaceId,
        title: 'Test Workspace',
        status: 'active',
        overallProgress: 45,
        currentPhase: 2,
        totalBudget: 5000,
        startDate: new Date('2024-01-15'),
        userRoleInWorkspace: 'client',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      message: 'Simple client route is working!'
    });
    
  } catch (error) {
    console.error('Simple client route error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// In workspaceRoutes.js
router.get('/client/:workspaceId', (req, res, next) => {
  req.userRole = 'client';
  next();
}, workspaceController.getRoleBasedWorkspace);

router.get('/freelancer/:workspaceId', (req, res, next) => {
  req.userRole = 'freelancer';
  next();
}, workspaceController.getRoleBasedWorkspace);


// ==================== OTHER ROUTES (keep existing) ====================
router.get('/:workspaceId/shared/messages', workspaceController.getSharedMessages);
router.post('/:workspaceId/shared/messages', workspaceController.sendSharedMessage);
router.get('/:workspaceId/shared/milestones', workspaceController.getWorkspaceMilestones);
router.get('/:workspaceId/shared/files', workspaceController.getWorkspaceFiles);
router.post('/:workspaceId/shared/files', workspaceController.uploadFile);

// Client-specific features
router.get('/:workspaceId/client/notes', workspaceController.getPrivateNotes);
router.post('/:workspaceId/client/notes', workspaceController.addPrivateNote);
router.put('/:workspaceId/milestones/:milestoneId/approve', workspaceController.approveMilestone);

// Freelancer-specific features
router.get('/:workspaceId/freelancer/notes', workspaceController.getPrivateNotes);
router.post('/:workspaceId/freelancer/notes', workspaceController.addPrivateNote);
router.put('/:workspaceId/milestones/:milestoneId/submit', workspaceController.submitMilestoneWork);

// Common features
router.post('/:workspaceId/report-issue', workspaceController.reportIssue);
router.post('/:workspaceId/schedule-call', workspaceController.scheduleVideoCall);
router.post('/:workspaceId/instant-call', workspaceController.createInstantCall);

module.exports = router;