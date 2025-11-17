const express = require('express')
const router = express.Router()
const clientController = require('../Controllers/clientController')
const {authenticate}=require('../Middlewares/authMiddleware');
const roleAuth = require('../Middlewares/roleAuth');


router.use(authenticate);


router.get('/debug-user', (req, res) => {
 console.log('User ID from token:', req.userId);
 console.log('User Role from token:', req.userRole);
 
 res.json({
 userId: req.userId,
userRole: req.userRole,
 message: 'Debug info'
 });
});


router.get('/test-simple', (req, res) => {
console.log('✅ Test route hit successfully');
res.json({ message: 'Test route working', timestamp: new Date() });
});

// clientDashboard routes
router.get('/dashboard',roleAuth('client_dashboard'),clientController.getClientDashboard)
router.get('/profile',roleAuth('view_profile'),clientController.getClientProfile)
router.put('/profile',roleAuth('edit_profile'),clientController.updateClientProfile)
router.get('/analytics',roleAuth('client_dashboard'),clientController.getClientAnalytics)
router.post('/verify-mobile', roleAuth('edit_profile'),clientController.verifyMobile)

// client job management routes
router.post('/jobs',roleAuth('post_jobs'),clientController.createJob)
router.get('/jobs',roleAuth('manage_jobs'),clientController.getClientJobs)
router.get('/jobs/stats',roleAuth('manage_jobs'),clientController.getClientJobStats)

// client proposal management

router.get('/proposals',roleAuth('view_proposals'),clientController.getClientProposals)
router.put('/jobs/:jobId',roleAuth('manage_jobs'),clientController.updateJob)
router.delete('/jobs/:jobId',roleAuth('manage_jobs'),clientController.deleteJob)
router.put('/jobs/:jobId/status',roleAuth('manage_jobs'),clientController.updateJobStatus)
router.put('/jobs/:jobId/close',roleAuth('manage_jobs'),clientController.closeJob)

// specific proposal routes
router.get('/proposals/:proposalId',roleAuth('view_proposals'),clientController.getProposalDetails)
router.get('/proposals/:proposalId/accept',roleAuth('accept_proposals'), clientController.acceptProposal)
router.put('/proposals/:proposalId/reject',roleAuth('view_proposals'),clientController.rejectProposal)

// job specific proposals
router.get('/jobs/:jobId/proposals',roleAuth('view_proposals'),clientController.getJobProposals)



module.exports=router;