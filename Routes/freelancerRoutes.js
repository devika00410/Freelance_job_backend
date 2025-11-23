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
const Contract = require('../Models/Contract')

// apply authentication to all freelancer routes
router.use(authenticate);




// freelancer dashboard routes
router.get('/dashboard', roleAuth('freelancer_dashboard'), freelancerController.getFreelancerDashboard);
router.get('/profile', roleAuth('view_profile'), freelancerController.getFreelancerProfile);
router.put('/profile', roleAuth('edit_profile'), freelancerController.updateFreelancerProfile);

// job routes
router.get('/jobs/browse', roleAuth('browse_jobs'), freelancerJobController.browseJobs);
router.get('/jobs/filters', roleAuth('browse_jobs'), freelancerJobController.getJobFilters);
router.get('/jobs/recommended', roleAuth('browse_jobs'), freelancerJobController.getRecommendedJobs);
router.get('/jobs/:jobId', roleAuth('browse_jobs'), freelancerJobController.getJobDetails);
router.post('/jobs/search', roleAuth('browse_jobs'), freelancerJobController.searchJobs);

// proposal routes
router.post('/proposals', roleAuth('submit_proposals'), freelancerProposalController.submitProposal);
router.get('/proposals', roleAuth('manage_proposals'), freelancerProposalController.getFreelancerProposals);
router.get('/proposals/stats', roleAuth('manage_proposals'), freelancerProposalController.getProposalStats);
router.get('/proposals/:proposalId', roleAuth('manage_proposals'), freelancerProposalController.getProposalDetails);
router.put('/proposals/:proposalId', roleAuth('manage_proposals'), freelancerProposalController.updateProposal);
router.put('/proposals/:proposalId/withdraw', roleAuth('manage_proposals'), freelancerProposalController.withdrawProposal);

// contract routes
// === CONTRACT ROUTES (CLEANED VERSION) ===

// Get contracts
router.get('/contracts', roleAuth('manage_contracts'), freelancerContractController.getFreelancerContracts);
router.get('/contracts/stats', roleAuth('manage_contracts'), freelancerContractController.getContractStats);
router.get('/contracts/pending-actions', roleAuth('manage_contracts'), freelancerContractController.getPendingActions);
router.get('/contracts/:contractId', roleAuth('manage_contracts'), freelancerContractController.getContractDetails);

// Contract actions
router.put('/contracts/:contractId/sign', roleAuth('manage_contracts'), freelancerContractController.signContract);
router.put('/contracts/:contractId/request-changes', roleAuth('request_contract_changes'), freelancerContractController.requestContractChanges);
router.put('/contracts/:contractId/decline', roleAuth('decline_contracts'), freelancerContractController.declineContract);



// workspace routes
router.get('/workspaces', roleAuth('access_workspace'), freelancerWorkspaceController.getFreelancerWorkspaces);
router.get('/workspaces/stats/:workspaceId', roleAuth('access_workspace'), freelancerWorkspaceController.getWorkspaceStats);
router.get('/workspaces/:workspaceId', roleAuth('access_workspace'), freelancerWorkspaceController.getWorkspaceDetails);
router.get('/workspaces/:workspaceId/milestones', roleAuth('access_workspace'), freelancerWorkspaceController.getWorkspaceMilestones);
router.get('/workspaces/:workspaceId/messages', roleAuth('access_workspace'), freelancerWorkspaceController.getWorkspaceMessages);
router.get('/workspaces/:workspaceId/files', roleAuth('access_workspace'), freelancerWorkspaceController.getWorkspaceFiles);
router.post('/workspaces/:workspaceId/files', roleAuth('access_workspace'), freelancerWorkspaceController.uploadWorkspaceFile);
router.put('/workspaces/:workspaceId/milestones/:milestoneId/submit', roleAuth('access_workspace'), freelancerWorkspaceController.submitMilestoneWork);


// portfolio routes
router.get('/portfolio', roleAuth('manage_portfolio'), freelancerPortfolioController.getPortfolio);
router.put('/portfolio', roleAuth('manage_portfolio'), freelancerPortfolioController.updatePortfolio);
router.get('/portfolio/stats', roleAuth('manage_portfolio'), freelancerPortfolioController.getPortfolioStats);
router.put('/portfolio/bio', roleAuth('manage_portfolio'), freelancerPortfolioController.updateBio);


// portfolio projects routes
router.post('/portfolio/projects', roleAuth('manage_portfolio'), freelancerPortfolioController.addProject);
router.put('/portfolio/projects/:projectId', roleAuth('manage_portfolio'), freelancerPortfolioController.updateProject);
router.delete('/portfolio/projects/:projectId', roleAuth('manage_portfolio'), freelancerPortfolioController.removeProject);


// portfolio skills routes
router.post('/portfolio/skills', roleAuth('manage_portfolio'), freelancerPortfolioController.addSkill);
router.delete('/portfolio/skills/:skillName', roleAuth('manage_portfolio'), freelancerPortfolioController.removeSkill);



// portfolio documents routes
router.post('/portfolio/documents', roleAuth('manage_portfolio'), freelancerPortfolioController.uploadDocument);
router.get('/portfolio/documents', roleAuth('manage_portfolio'), freelancerPortfolioController.getDocuments);
router.delete('/portfolio/documents/:documentId', roleAuth('manage_portfolio'), freelancerPortfolioController.removeDocument);

// portfolio gallery routes
router.post('/portfolio/gallery', roleAuth('manage_portfolio'), freelancerPortfolioController.uploadToGallery);
router.get('/portfolio/gallery', roleAuth('manage_portfolio'), freelancerPortfolioController.getGallery);
router.delete('/portfolio/gallery/:galleryItemId', roleAuth('manage_portfolio'), freelancerPortfolioController.removeFromGallery);


// portfolio images routes
router.put('/portfolio/images', roleAuth('manage_portfolio'), freelancerPortfolioController.uploadPortfolioImage);


// earnings routes
router.get('/earnings/overview', roleAuth('view_earnings'), freelancerEarningsController.getEarningsOverview);
router.get('/earnings/stats', roleAuth('view_earnings'), freelancerEarningsController.getEarningsStats);
router.get('/earnings/transactions', roleAuth('view_earnings'), freelancerEarningsController.getTransactionHistory);
router.get('/earnings/monthly', roleAuth('view_earnings'), freelancerEarningsController.getMonthlyEarnings);
router.get('/earnings/by-project', roleAuth('view_earnings'), freelancerEarningsController.getEarningsByProject);
router.get('/earnings/pending', roleAuth('view_earnings'), freelancerEarningsController.getPendingPayments);
router.get('/earnings/transactions/:transactionId', roleAuth('view_earnings'), freelancerEarningsController.getTransactionDetails);
router.post('/earnings/withdraw', roleAuth('manage_earnings'), freelancerEarningsController.initiateWithdrawal);


// report routes
router.get('/reports', roleAuth('submit_reports'), freelancerReportController.getFreelancerReports);
router.get('/reports/stats', roleAuth('submit_reports'), freelancerReportController.getReportStats);
router.get('/reports/categories', roleAuth('submit_reports'), freelancerReportController.getReportCategories);
router.get('/reports/:reportId', roleAuth('submit_reports'), freelancerReportController.getReportDetails);
router.post('/reports', roleAuth('submit_reports'), freelancerReportController.submitReport);
router.put('/reports/:reportId', roleAuth('submit_reports'), freelancerReportController.updateReport);
router.put('/reports/:reportId/withdraw', roleAuth('submit_reports'), freelancerReportController.withdrawReport);

module.exports = router;