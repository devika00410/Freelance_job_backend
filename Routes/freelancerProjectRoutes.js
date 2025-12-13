const express = require('express');
const router = express.Router();
const freelancerProjectController = require('../Controllers/freelancerProjectController');
const { authenticate } = require('../Middlewares/authMiddleware');

router.use(authenticate);

router.get('/:freelancerId', freelancerProjectController.getFreelancerProjects);
router.get('/:freelancerId/stats', freelancerProjectController.getFreelancerProjectStats);
router.get('/:freelancerId/pending-actions', freelancerProjectController.getFreelancerPendingActions);

module.exports = router;