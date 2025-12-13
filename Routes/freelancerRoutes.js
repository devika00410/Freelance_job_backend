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
const Contract = require('../Models/Contract');

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

// apply authentication to all freelancer routes
router.use(authenticate);


// Add this to freelancerRoutes.js temporarily
router.get('/earnings/debug', authenticate, async (req, res) => {
    try {
        const freelancerId = req.userId;
        
        console.log('Debug - Freelancer ID:', freelancerId);
        
        // Check transactions
        const transactions = await Transaction.find({ 
            toUser: freelancerId 
        });
        
        console.log('Debug - Found transactions:', transactions.length);
        
        res.json({
            freelancerId: freelancerId,
            transactionCount: transactions.length,
            transactions: transactions
        });
        
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ error: error.message });
    }
});

// In your freelancer routes - FIXED: Use authenticate or auth
router.get('/test', authenticate, async (req, res) => { // Changed from 'auth' to 'authenticate'
    try {
        console.log('Test route - User ID:', req.userId);
        console.log('Test route - User:', req.user);
        
        // Test database connection
        const contractCount = await Contract.countDocuments({});
        console.log('Total contracts in DB:', contractCount);
        
        res.json({
            success: true,
            message: 'Test successful',
            userId: req.userId,
            userType: req.user.userType,
            contractCount
        });
    } catch (error) {
        console.error('Test route error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// freelancer dashboard routes
router.get('/dashboard', roleAuth('freelancer_dashboard'), freelancerController.getFreelancerDashboard);
router.get('/profile', roleAuth('view_profile'), freelancerController.getFreelancerProfile);
router.put('/profile', roleAuth('edit_profile'), freelancerController.updateFreelancerProfile);
// Add this route in freelancerRoutes.js after the existing profile routes
router.post('/profile', roleAuth('edit_profile'), freelancerController.createFreelancerProfile);
router.get('/:freelancerId/profile', roleAuth('view_profile'), freelancerController.getPublicProfile);

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

// contract routes - FIXED: Use consistent authentication
router.get('/contracts', authenticate, roleAuth('manage_contracts'), freelancerContractController.getFreelancerContracts);
router.get('/contracts/stats', authenticate, roleAuth('manage_contracts'), freelancerContractController.getContractStats);
router.get('/contracts/pending-actions', authenticate, roleAuth('manage_contracts'), freelancerContractController.getPendingActions);
router.get('/contracts/:contractId', authenticate, roleAuth('manage_contracts'), freelancerContractController.getContractDetails);
router.put('/contracts/:contractId/sign', authenticate, roleAuth('manage_contracts'), freelancerContractController.signContract);
router.put('/contracts/:contractId/request-changes', authenticate, roleAuth('request_contract_changes'), freelancerContractController.requestContractChanges);
router.put('/contracts/:contractId/decline', authenticate, roleAuth('decline_contracts'), freelancerContractController.declineContract);

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

// portfolio projects routes with Multer
router.post('/portfolio/projects', 
    roleAuth('manage_portfolio'), 
    uploadMultipleImages, 
    handleMulterError,
    freelancerPortfolioController.addProject
);

router.put('/portfolio/projects/:projectId', 
    roleAuth('manage_portfolio'), 
    uploadMultipleImages, 
    handleMulterError,
    freelancerPortfolioController.updateProject
);

router.delete('/portfolio/projects/:projectId', roleAuth('manage_portfolio'), freelancerPortfolioController.removeProject);

// portfolio skills routes
router.post('/portfolio/skills', roleAuth('manage_portfolio'), freelancerPortfolioController.addSkill);
router.delete('/portfolio/skills/:skillName', roleAuth('manage_portfolio'), freelancerPortfolioController.removeSkill);

// portfolio documents routes with Multer
router.post('/portfolio/documents', 
    roleAuth('manage_portfolio'), 
    uploadDocuments.single('document'),
    handleMulterError,
    freelancerPortfolioController.uploadDocument
);

router.get('/portfolio/documents', roleAuth('manage_portfolio'), freelancerPortfolioController.getDocuments);
router.delete('/portfolio/documents/:documentId', roleAuth('manage_portfolio'), freelancerPortfolioController.removeDocument);

// portfolio gallery routes with Multer
router.post('/portfolio/gallery', 
    roleAuth('manage_portfolio'), 
    uploadGalleryImages.single('galleryImage'),
    handleMulterError,
    freelancerPortfolioController.uploadToGallery
);

router.get('/portfolio/gallery', roleAuth('manage_portfolio'), freelancerPortfolioController.getGallery);
router.delete('/portfolio/gallery/:galleryItemId', roleAuth('manage_portfolio'), freelancerPortfolioController.removeFromGallery);

// portfolio images routes with Multer
router.post('/portfolio/upload/profile', 
    roleAuth('manage_portfolio'), 
    uploadProfileImage.single('profileImage'),
    handleMulterError,
    freelancerPortfolioController.uploadProfileImage
);

router.post('/portfolio/upload/cover', 
    roleAuth('manage_portfolio'), 
    uploadCoverImage.single('coverImage'),
    handleMulterError,
    freelancerPortfolioController.uploadCoverImage
);

// Remove the old images route 
// router.put('/portfolio/images', roleAuth('manage_portfolio'), freelancerPortfolioController.uploadPortfolioImage);

// earnings routes
router.get('/earnings/overview', roleAuth('view_earnings'), freelancerEarningsController.getEarningsOverview);
router.get('/earnings/stats', roleAuth('view_earnings'), freelancerEarningsController.getEarningsStats);
router.get('/earnings/transactions', roleAuth('view_earnings'), freelancerEarningsController.getTransactionHistory);
router.get('/earnings/monthly', roleAuth('view_earnings'), freelancerEarningsController.getMonthlyEarnings);
router.get('/earnings/by-project', roleAuth('view_earnings'), freelancerEarningsController.getEarningsByProject);
router.get('/earnings/pending', roleAuth('view_earnings'), freelancerEarningsController.getPendingPayments);
router.get('/earnings/transactions/:transactionId', roleAuth('view_earnings'), freelancerEarningsController.getTransactionDetails);
router.post('/earnings/withdraw', roleAuth('manage_earnings'), freelancerEarningsController.initiateWithdrawal);
router.get('/earnings', roleAuth('view_earnings'), freelancerEarningsController.getFreelancerEarnings);

router.post('/earnings/test-transaction', roleAuth('view_earnings'), freelancerEarningsController.createTestTransaction);

// report routes
router.get('/reports', roleAuth('submit_reports'), freelancerReportController.getFreelancerReports);
router.get('/reports/stats', roleAuth('submit_reports'), freelancerReportController.getReportStats);
router.get('/reports/categories', roleAuth('submit_reports'), freelancerReportController.getReportCategories);
router.get('/reports/:reportId', roleAuth('submit_reports'), freelancerReportController.getReportDetails);
router.post('/reports', roleAuth('submit_reports'), freelancerReportController.submitReport);
router.put('/reports/:reportId', roleAuth('submit_reports'), freelancerReportController.updateReport);
router.put('/reports/:reportId/withdraw', roleAuth('submit_reports'), freelancerReportController.withdrawReport);

// Serve uploaded files statically
router.use('/uploads', express.static('uploads'));

module.exports = router;