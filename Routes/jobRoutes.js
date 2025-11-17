const express = require('express')
const router = express.Router();
const jobController = require('../Controllers/jobController')
const authMiddleware=require('../Middlewares/authMiddleware');
const roleAuth=require('../Middlewares/roleAuth')
const { route } = require('./clientRoute');

// public routes(no auth required for browsing)
router.get('/jobs',jobController.getAllJobs)
// router.get('/categories',jobController.getJobCategories)
router.get('/:jobId',jobController.getJobById)

// protected routes(auth required)
// router.use(authMiddleware)

// job creation and management

router.post('/',roleAuth('post_jobs'),jobController.createJob)
router.put('/:jobId',roleAuth('manage_jobs'),jobController.updateJob);
router.delete('/:jobId',roleAuth('manage_jobs'),jobController.deleteJob)
router.put('/:jobId/status',roleAuth('manage_jobs'),jobController.updateJobStatus)
router.put('/:jobId/close',roleAuth('manage_jobs'),jobController.closeJob)

// job proposals
router.get('/:jobId/proposals',roleAuth('view_proposals'),jobController.getJobProposals)

// job status
router.get('/stats/client',roleAuth('manage_jobs'), jobController.getClientJobStats)

module.exports =router;

