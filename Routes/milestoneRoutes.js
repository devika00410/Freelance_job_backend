const express = require('express');
const router = express.Router();
const milestoneController = require('../Controllers/milestoneController');
const {authenticate} = require('../Middlewares/authMiddleware');

router.use(authenticate);



// Milestone access
router.get('/:workspaceId/milestones', milestoneController.getMilestones);
router.get('/:workspaceId/milestones/:milestoneId', milestoneController.getMilestoneDetails);
router.get('/:workspaceId/milestones-stats', milestoneController.getMilestoneStats);

// Client-only routes
router.post('/:workspaceId/milestones', milestoneController.createMilestone);
router.put('/:workspaceId/milestones/:milestoneId', milestoneController.updateMilestone);
router.put('/:workspaceId/milestones/:milestoneId/approve', milestoneController.approveMilestone);
router.put('/:workspaceId/milestones/:milestoneId/request-revision', milestoneController.requestRevision);

// Freelancer-only routes
router.put('/:workspaceId/milestones/:milestoneId/start', milestoneController.startMilestone);
router.put('/:workspaceId/milestones/:milestoneId/submit', milestoneController.submitWork);

module.exports = router;