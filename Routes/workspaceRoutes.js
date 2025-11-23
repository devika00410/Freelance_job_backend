const express = require('express');
const router = express.Router();
const workspaceController = require('../Controllers/workspaceController');
const {authenticate} = require('../Middlewares/authMiddleware');
const Message = require('../Models/Message')

router.use(authenticate);


// Workspace access
router.get('/:workspaceId', workspaceController.getWorkspaceDetails);
router.get('/:workspaceId/stats', workspaceController.getWorkspaceStats);

// Chat routes
router.get('/:workspaceId/messages', workspaceController.getWorkspaceMessages);
router.post('/:workspaceId/messages', workspaceController.sendMessage);

// File routes
router.get('/:workspaceId/files', workspaceController.getWorkspaceFiles);
router.post('/:workspaceId/files', workspaceController.uploadFile);

// Milestone routes 

router.get('/:workspaceId/milestones', workspaceController.getWorkspaceMilestones);

// Report issue
router.post('/:workspaceId/report-issue', workspaceController.reportIssue);

// Video call routes
router.post('/:workspaceId/schedule-call', workspaceController.scheduleVideoCall);

module.exports = router;