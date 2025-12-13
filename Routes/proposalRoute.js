const express=require('express')
const router=express.Router()
const proposalController=require('../Controllers/proposalController')
const {authenticate} = require('../Middlewares/authMiddleware')
const {proposalValidations} = require('../Middlewares/validationMiddleware')
const roleAuth=require('../Middlewares/roleAuth')


router.use(authenticate);

// proposal management routes
router.post('/',roleAuth('submit_proposals'), proposalValidations.submitProposal,proposalController.submitProposal)
router.get('/',roleAuth('manage_proposals'),proposalController.getFreelancerProposals)
router.get('/stats',roleAuth('view_proposals'),proposalController.getProposalStats)
router.get('/client/count', roleAuth('view_proposals'), proposalController.getClientProposalCount);

// specific proposal routes

router.get('/:proposalId',roleAuth('view_proposals'),proposalController.getProposalDetails)
router.put('/:proposalId',roleAuth('manage_proposals'),proposalController.updateProposal)
router.put('/:proposalId/withdraw',roleAuth('manage_proposals'),proposalController.withdrawProposal)
router.put('/:proposalId/accept',roleAuth('accept_proposals'),proposalController.acceptProposal)
router.put('/:proposalId/reject',roleAuth('view_proposals'),proposalController.rejectProposal)

module.exports=router;
