const express=require('express')
const router=express.Router()
const proposalController=require('../Controllers/proposalController')
const authMiddleware = require('../Middlewares/authMiddleware')
const roleAuth=require('../Middlewares/roleAuth')

// apply authentication to all proposal routes
router.use(authMiddleware);

// proposal management routes
router.post('/proposals',roleAuth('submit_proposals'),proposalController.submitProposal)
router.get('/',roleAuth('manage_proposals'),proposalController.getFreelancerProposals)
router.get('/stats',roleAuth('view_proposals'),proposalController.getProposalStats)

// specific proposal routes

router.get('/:proposalId',roleAuth('view_proposals'),proposalController.getProposalDetails)
router.put('/:proposalId',roleAuth('manage_proposals'),proposalController.updateProposal)
router.put('/:proposalId/withdraw',roleAuth('manage_proposals'),proposalController.withdrawProposal)
router.put('/:proposalId/accept',roleAuth('accept_proposals'),proposalController.acceptProposal)
router.put('/:proposalId/reject',roleAuth('view_proposals'),proposalController.rejectProposal)

module.exports=router;
