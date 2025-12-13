const express = require('express')
const router = express.Router();
const jobController = require('../Controllers/jobController')
const { authenticate } = require('../Middlewares/authMiddleware');
const roleAuth = require('../Middlewares/roleAuth')

// public routes (no auth required for browsing)
router.get('/jobs', jobController.getAllJobs)

// protected routes (auth required) 
router.get('/:jobId', authenticate, jobController.getJobById)
router.post('/', authenticate, roleAuth('post_jobs'), jobController.createJob)
router.put('/:jobId', authenticate, roleAuth('manage_jobs'), jobController.updateJob);
router.delete('/:jobId', authenticate, roleAuth('manage_jobs'), jobController.deleteJob)
router.put('/:jobId/status', authenticate, roleAuth('manage_jobs'), jobController.updateJobStatus)
router.put('/:jobId/close', authenticate, roleAuth('manage_jobs'), jobController.closeJob)

// job proposals
router.get('/:jobId/proposals', authenticate, roleAuth('view_proposals'), jobController.getJobProposals)

// job status
router.get('/stats/client', authenticate, roleAuth('manage_jobs'), jobController.getClientJobStats)

module.exports = router;