const express = require('express')
const router = express.Router()
const clientController = require('../Controllers/clientController')
const jobController = require('../Controllers/jobController')
const clientContractController = require('../Controllers/clientContractController')
const clientPaymentController = require('../Controllers/clientPaymentController')
const clientReportController = require('../Controllers/clientReportController')
const clientWorkspaceController = require('../Controllers/clientWorkspaceController')
const { authenticate } = require('../Middlewares/authMiddleware')
const roleAuth = require('../Middlewares/roleAuth')
const { jobValidations } = require('../Middlewares/validationMiddleware')

router.use(authenticate)


// TEST ROUTE - Add this BEFORE your regular client route
router.get('/test-client/:workspaceId', async (req, res) => {
  try {
    console.log('🎯 TEST CLIENT ROUTE HIT - FORCE');
    console.log('📌 Workspace ID:', req.params.workspaceId);
    console.log('👤 User ID:', req.userId);
    
    // Just return dummy data
    res.json({
      success: true,
      workspace: {
        _id: 'test123',
        workspaceId: req.params.workspaceId,
        title: 'Digital Boost Strategy',
        description: 'Marketing campaign workspace',
        status: 'active',
        currentPhase: 2,
        overallProgress: 45,
        totalBudget: 5000,
        startDate: new Date('2024-01-15'),
        estimatedEndDate: new Date('2024-06-30'),
        userRoleInWorkspace: 'client',
        createdAt: new Date(),
        updatedAt: new Date(),
        client: {
          _id: req.userId,
          name: 'Diya',
          email: 'diya@gmail.com'
        },
        freelancer: {
          _id: 'freelancer123',
          name: 'Elsa Johnson',
          email: 'elsa@example.com',
          skills: ['Marketing', 'Strategy']
        }
      },
      message: 'TEST CLIENT ROUTE IS WORKING!'
    });
    
  } catch (error) {
    console.error('Test client route error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
      
// client dashboard and profile routes

router.get('/dashboard', roleAuth('client_dashboard'), clientController.getClientDashboard)
router.get('/profile', roleAuth('view_profile'), clientController.getClientProfile)
router.put('/profile', roleAuth('edit_profile'), clientController.updateClientProfile)
router.get('/analytics', roleAuth('client_dashboard'), clientController.getClientAnalytics)
router.post('/verify-mobile', roleAuth('edit_profile'), clientController.verifyMobile)


//client job management routes

router.post('/jobs',roleAuth('post_jobs'), jobValidations.createJob, clientController.createJob)
router.get('/jobs', roleAuth('manage_jobs'), clientController.getClientJobs)
router.get('/jobs/stats', roleAuth('manage_jobs'), clientController.getClientJobStats)
router.put('/jobs/:jobId', roleAuth('manage_jobs'), clientController.updateJob)
router.delete('/jobs/:jobId', roleAuth('manage_jobs'), clientController.deleteJob)
router.put('/jobs/:jobId/status', roleAuth('manage_jobs'), clientController.updateJobStatus)
router.put('/jobs/:jobId/close', roleAuth('manage_jobs'), clientController.closeJob)


// client proposal management routes

router.get('/proposals', roleAuth('view_proposals'), clientController.getClientProposals)
router.get('/proposals/:proposalId', roleAuth('view_proposals'), clientController.getProposalDetails)
router.post('/proposals/:proposalId/accept', roleAuth('accept_proposals'), clientController.acceptProposal)
router.put('/proposals/:proposalId/reject', roleAuth('view_proposals'), clientController.rejectProposal)

// job specific proposal routes
router.get('/jobs/:jobId/proposals', roleAuth('view_proposals'), clientController.getJobProposals)

//  public job routes(no auth required)
router.get('/public/jobs', jobController.getAllJobs)
router.get('/public/jobs/:jobId', jobController.getJobById)

// client contract routes

router.post('/contracts', roleAuth('manage_contracts'), clientContractController.createContract)
router.get('/contracts', roleAuth('view_contracts'), clientContractController.getClientContracts)
router.get('/contracts/stats', roleAuth('view_contracts'), clientContractController.getContractStats)
router.get('/contracts/:contractId', roleAuth('view_contracts'), clientContractController.getContractDetails)
router.put('/contracts/:contractId', roleAuth('manage_contracts'), clientContractController.updateContract)
router.put('/contracts/:contractId/sign', roleAuth('manage_contracts'), clientContractController.signContract)
router.put('/contracts/:contractId/send', roleAuth('manage_contracts'), clientContractController.sendContract)
router.put('/contracts/:contractId/cancel', roleAuth('manage_contracts'), clientContractController.cancelContract)
router.post(
    '/contracts/:contractId/create-workspace',
    roleAuth('manage_contracts'), // Use roleAuth like the first route
    clientContractController.createWorkspaceForContract
);

//client payment routes
router.post('/payments/intent', roleAuth('make_payments'), clientPaymentController.createPaymentIntent)
router.put('/payments/:paymentId/confirm', roleAuth('make_payments'), clientPaymentController.confirmPayment)
router.get('/payments', roleAuth('view_payments'), clientPaymentController.getPaymentHistory)
router.get('/payments/pending', roleAuth('view_payments'), clientPaymentController.getPendingPayments)
router.get('/payments/stats', roleAuth('view_payments'), clientPaymentController.getPaymentStats)
router.get('/payments/:paymentId', roleAuth('view_payments'), clientPaymentController.getPaymentDetails)

// client report routes
router.post('/reports', roleAuth('submit_reports'), clientReportController.submitReport)
router.get('/reports', roleAuth('view_reports'), clientReportController.getClientReports)
router.get('/reports/categories', roleAuth('submit_reports'), clientReportController.getReportCategories)
router.get('/reports/stats', roleAuth('view_reports'), clientReportController.getReportStats)
router.get('/reports/:reportId', roleAuth('view_reports'), clientReportController.getReportDetails)
router.put('/reports/:reportId', roleAuth('submit_reports'), clientReportController.updateReport)
router.put('/reports/:reportId/withdraw', roleAuth('submit_reports'), clientReportController.withdrawReport)

// client workspace routes
router.get('/workspaces', roleAuth('manage_workspaces'), clientWorkspaceController.getClientWorkspaces)
router.get('/workspaces/:workspaceId', roleAuth('manage_workspaces'), clientWorkspaceController.getWorkspaceDetails)
router.get('/workspaces/:workspaceId/milestones', roleAuth('manage_workspaces'), clientWorkspaceController.getWorkspaceMilestones)
router.get('/workspaces/:workspaceId/files', roleAuth('manage_workspaces'), clientWorkspaceController.getWorkspaceFiles)
router.get('/workspaces/:workspaceId/stats', roleAuth('manage_workspaces'), clientWorkspaceController.getWorkspaceStats)
router.put('/workspaces/:workspaceId/milestones/:milestoneId/approve', roleAuth('manage_workspaces'), clientWorkspaceController.approveMilestone)
router.put('/workspaces/:workspaceId/milestones/:milestoneId/revision', roleAuth('manage_workspaces'), clientWorkspaceController.requestMilestoneRevision)

module.exports = router
