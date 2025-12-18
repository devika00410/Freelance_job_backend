const express = require('express');
const router = express.Router();
const freelancerController = require('../Controllers/freelancerController');
const freelancerJobController = require('../Controllers/freelancerJobController');
const freelancerProposalController = require('../Controllers/freelancerProposalController');
const freelancerContractController = require('../Controllers/freelancerContractController');
const freelancerWorkspaceController = require('../Controllers/freelancerWorkspaceController');
const freelancerPortfolioController = require('../Controllers/freelancerPortfolioController');
const freelancerEarningsController = require('../Controllers/freelancerEarningsController');
const freelancerReportController = require('../Controllers/freelancerReportController');
const {authenticate} = require('../Middlewares/authMiddleware');
const roleAuth = require('../Middlewares/roleAuth');
const notificationController = require('../Controllers/notificationController'); // ADD THIS
const Contract = require('../Models/Contract');
const Transaction = require('../Models/Transaction');

// Multer configuration
const {
    uploadProfileImage,
    uploadCoverImage,
    uploadProjectImages,
    uploadGalleryImages,
    uploadDocuments,
    uploadMultipleImages,
    handleMulterError
} = require('../Middlewares/multer');

// Define auth as alias for authenticate
const auth = authenticate;

// IMPORTANT: REMOVED this line - it was causing duplicate authentication
// router.use(authenticate); // COMMENTED OUT OR DELETE THIS LINE

// ============= REAL-TIME DASHBOARD ROUTES =============
router.get('/dashboard-stats', authenticate, roleAuth('freelancer_dashboard'), freelancerController.getDashboardStats);
router.get('/activities', authenticate, roleAuth('freelancer_dashboard'), freelancerController.getActivities);
router.get('/activities/latest', authenticate, roleAuth('freelancer_dashboard'), freelancerController.getLatestActivities);
router.get('/recommended-jobs', authenticate, roleAuth('freelancer_dashboard'), freelancerJobController.getRecommendedJobs);
router.get('/jobs/:jobId/match-score', authenticate, roleAuth('freelancer_dashboard'), freelancerJobController.getJobMatchScore);
// router.get('/search', authenticate, roleAuth('freelancer_dashboard'), freelancerController.search);
router.get('/search', authenticate, roleAuth('freelancer_dashboard'), (req, res) => {
    console.log('Temporary search handler');
    res.json({
        success: true,
        message: 'Search endpoint - using temporary handler',
        results: []
    });
});




// ============= NOTIFICATION ROUTES =============
router.get('/notifications', authenticate, roleAuth('view_notifications'), notificationController.getNotifications);
router.get('/notifications/unread', authenticate, roleAuth('view_notifications'), notificationController.getUnreadNotifications);
router.get('/notifications/count', authenticate, roleAuth('view_notifications'), notificationController.getNotificationCount);
router.put('/notifications/:id/mark-read', authenticate, roleAuth('manage_notifications'), notificationController.markNotificationAsRead);
router.put('/notifications/mark-all-read', authenticate, roleAuth('manage_notifications'), notificationController.markAllNotificationsAsRead);
router.delete('/notifications/:id', authenticate, roleAuth('manage_notifications'), notificationController.deleteNotification);

// ============= ANALYTICS ROUTES =============
router.get('/analytics', authenticate, roleAuth('view_analytics'), freelancerController.getAnalytics);
router.get('/analytics/earnings', authenticate, roleAuth('view_analytics'), freelancerEarningsController.getAnalyticsEarnings);
router.get('/analytics/projects', authenticate, roleAuth('view_analytics'), freelancerController.getProjectAnalytics);
router.get('/analytics/proposals', authenticate, roleAuth('view_analytics'), freelancerProposalController.getProposalAnalytics);


// ============= EXISTING ROUTES (keep all these) =============
router.get('/dashboard', authenticate, roleAuth('freelancer_dashboard'), freelancerController.getFreelancerDashboard);
router.get('/profile', authenticate, roleAuth('view_profile'), freelancerController.getFreelancerProfile);
router.put('/profile', authenticate, roleAuth('edit_profile'), freelancerController.updateFreelancerProfile);
router.post('/profile', authenticate, roleAuth('edit_profile'), freelancerController.createFreelancerProfile);
router.get('/:freelancerId/profile', authenticate, roleAuth('view_profile'), freelancerController.getPublicProfile);

// ============= JOB ROUTES =============
router.get('/jobs/browse', authenticate, roleAuth('browse_jobs'), freelancerJobController.browseJobs);
router.get('/jobs/filters', authenticate, roleAuth('browse_jobs'), freelancerJobController.getJobFilters);
router.get('/jobs/recommended', authenticate, roleAuth('browse_jobs'), freelancerJobController.getRecommendedJobs);
router.get('/jobs/:jobId', authenticate, roleAuth('browse_jobs'), freelancerJobController.getJobDetails);
router.post('/jobs/search', authenticate, roleAuth('browse_jobs'), freelancerJobController.searchJobs);

// ============= PROPOSAL ROUTES =============
router.post('/proposals', authenticate, roleAuth('submit_proposals'), freelancerProposalController.submitProposal);
router.get('/proposals', authenticate, roleAuth('manage_proposals'), freelancerProposalController.getFreelancerProposals);
router.get('/proposals/stats', authenticate, roleAuth('manage_proposals'), freelancerProposalController.getProposalStats);
router.get('/proposals/:proposalId', authenticate, roleAuth('manage_proposals'), freelancerProposalController.getProposalDetails);
router.put('/proposals/:proposalId', authenticate, roleAuth('manage_proposals'), freelancerProposalController.updateProposal);
router.put('/proposals/:proposalId/withdraw', authenticate, roleAuth('manage_proposals'), freelancerProposalController.withdrawProposal);

// ============= CONTRACT ROUTES =============
router.get('/contracts', authenticate, roleAuth('manage_contracts'), freelancerContractController.getFreelancerContracts);
router.get('/contracts/stats', authenticate, roleAuth('manage_contracts'), freelancerContractController.getContractStats);
router.get('/contracts/pending-actions', authenticate, roleAuth('manage_contracts'), freelancerContractController.getPendingActions);
router.get('/contracts/:contractId', authenticate, roleAuth('manage_contracts'), freelancerContractController.getContractDetails);
router.put('/contracts/:contractId/sign', authenticate, roleAuth('manage_contracts'), freelancerContractController.signContract);
router.put('/contracts/:contractId/request-changes', authenticate, roleAuth('request_contract_changes'), freelancerContractController.requestContractChanges);
router.put('/contracts/:contractId/decline', authenticate, roleAuth('decline_contracts'), freelancerContractController.declineContract);

// ============= WORKSPACE ROUTES =============
router.get('/workspaces', authenticate, roleAuth('access_workspace'), freelancerWorkspaceController.getFreelancerWorkspaces);
router.get('/workspaces/stats/:workspaceId', authenticate, roleAuth('access_workspace'), freelancerWorkspaceController.getWorkspaceStats);
router.get('/workspaces/:workspaceId', authenticate, roleAuth('access_workspace'), freelancerWorkspaceController.getWorkspaceDetails);
router.get('/workspaces/:workspaceId/milestones', authenticate, roleAuth('access_workspace'), freelancerWorkspaceController.getWorkspaceMilestones);
router.get('/workspaces/:workspaceId/messages', authenticate, roleAuth('access_workspace'), freelancerWorkspaceController.getWorkspaceMessages);
router.get('/workspaces/:workspaceId/files', authenticate, roleAuth('access_workspace'), freelancerWorkspaceController.getWorkspaceFiles);
router.post('/workspaces/:workspaceId/files', authenticate, roleAuth('access_workspace'), freelancerWorkspaceController.uploadWorkspaceFile);
router.put('/workspaces/:workspaceId/milestones/:milestoneId/submit', authenticate, roleAuth('access_workspace'), freelancerWorkspaceController.submitMilestoneWork);

// ============= PORTFOLIO ROUTES =============
router.get('/portfolio', authenticate, roleAuth('manage_portfolio'), freelancerPortfolioController.getPortfolio);
router.put('/portfolio', authenticate, roleAuth('manage_portfolio'), freelancerPortfolioController.updatePortfolio);
router.get('/portfolio/stats', authenticate, roleAuth('manage_portfolio'), freelancerPortfolioController.getPortfolioStats);
router.put('/portfolio/bio', authenticate, roleAuth('manage_portfolio'), freelancerPortfolioController.updateBio);

// Portfolio projects routes with Multer
router.post('/portfolio/projects', 
    authenticate,
    roleAuth('manage_portfolio'), 
    uploadMultipleImages, 
    handleMulterError,
    freelancerPortfolioController.addProject
);

router.put('/portfolio/projects/:projectId', 
    authenticate,
    roleAuth('manage_portfolio'), 
    uploadMultipleImages, 
    handleMulterError,
    freelancerPortfolioController.updateProject
);

router.delete('/portfolio/projects/:projectId', authenticate, roleAuth('manage_portfolio'), freelancerPortfolioController.removeProject);

// Portfolio skills routes
router.post('/portfolio/skills', authenticate, roleAuth('manage_portfolio'), freelancerPortfolioController.addSkill);
router.delete('/portfolio/skills/:skillName', authenticate, roleAuth('manage_portfolio'), freelancerPortfolioController.removeSkill);

// Portfolio documents routes with Multer
router.post('/portfolio/documents', 
    authenticate,
    roleAuth('manage_portfolio'), 
    uploadDocuments.single('document'),
    handleMulterError,
    freelancerPortfolioController.uploadDocument
);

router.get('/portfolio/documents', authenticate, roleAuth('manage_portfolio'), freelancerPortfolioController.getDocuments);
router.delete('/portfolio/documents/:documentId', authenticate, roleAuth('manage_portfolio'), freelancerPortfolioController.removeDocument);

// Portfolio gallery routes with Multer
router.post('/portfolio/gallery', 
    authenticate,
    roleAuth('manage_portfolio'), 
    uploadGalleryImages.single('galleryImage'),
    handleMulterError,
    freelancerPortfolioController.uploadToGallery
);

router.get('/portfolio/gallery', authenticate, roleAuth('manage_portfolio'), freelancerPortfolioController.getGallery);
router.delete('/portfolio/gallery/:galleryItemId', authenticate, roleAuth('manage_portfolio'), freelancerPortfolioController.removeFromGallery);

// Portfolio images routes with Multer
router.post('/portfolio/upload/profile', 
    authenticate,
    roleAuth('manage_portfolio'), 
    uploadProfileImage.single('profileImage'),
    handleMulterError,
    freelancerPortfolioController.uploadProfileImage
);

router.post('/portfolio/upload/cover', 
    authenticate,
    roleAuth('manage_portfolio'), 
    uploadCoverImage.single('coverImage'),
    handleMulterError,
    freelancerPortfolioController.uploadCoverImage
);

// ============= EARNINGS ROUTES =============
router.get('/earnings/overview', authenticate, roleAuth('view_earnings'), freelancerEarningsController.getEarningsOverview);
router.get('/earnings/stats', authenticate, roleAuth('view_earnings'), freelancerEarningsController.getEarningsStats);
router.get('/earnings/transactions', authenticate, roleAuth('view_earnings'), freelancerEarningsController.getTransactionHistory);
router.get('/earnings/monthly', authenticate, roleAuth('view_earnings'), freelancerEarningsController.getMonthlyEarnings);
router.get('/earnings/by-project', authenticate, roleAuth('view_earnings'), freelancerEarningsController.getEarningsByProject);
router.get('/earnings/pending', authenticate, roleAuth('view_earnings'), freelancerEarningsController.getPendingPayments);
router.get('/earnings/transactions/:transactionId', authenticate, roleAuth('view_earnings'), freelancerEarningsController.getTransactionDetails);
router.post('/earnings/withdraw', authenticate, roleAuth('manage_earnings'), freelancerEarningsController.initiateWithdrawal);
router.get('/earnings', authenticate, roleAuth('view_earnings'), freelancerEarningsController.getFreelancerEarnings);
router.post('/earnings/test-transaction', authenticate, roleAuth('view_earnings'), freelancerEarningsController.createTestTransaction);

// ============= REPORT ROUTES =============
router.get('/reports', authenticate, roleAuth('submit_reports'), freelancerReportController.getFreelancerReports);
router.get('/reports/stats', authenticate, roleAuth('submit_reports'), freelancerReportController.getReportStats);
router.get('/reports/categories', authenticate, roleAuth('submit_reports'), freelancerReportController.getReportCategories);
router.get('/reports/:reportId', authenticate, roleAuth('submit_reports'), freelancerReportController.getReportDetails);
router.post('/reports', authenticate, roleAuth('submit_reports'), freelancerReportController.submitReport);
router.put('/reports/:reportId', authenticate, roleAuth('submit_reports'), freelancerReportController.updateReport);
router.put('/reports/:reportId/withdraw', authenticate, roleAuth('submit_reports'), freelancerReportController.withdrawReport);

// Serve uploaded files statically
router.use('/uploads', express.static('uploads'));

module.exports = router;