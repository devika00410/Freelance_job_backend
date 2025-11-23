const express = require('express');
const router = express.Router();
const clientContractController = require('../Controllers/clientContractController');
const freelancerContractController = require('../Controllers/freelancerContractController');
const { authenticate } = require('../Middlewares/authMiddleware');
const roleAuth = require('../Middlewares/roleAuth');

// Apply authentication to all routes
router.use(authenticate);

// ===== CLIENT CONTRACT ROUTES =====

// Create new contract (Client only)
router.post(
    '/client/contracts', 
    roleAuth('manage_contracts'), 
    clientContractController.createContract
);

// Get client contracts
router.get(
    '/client/contracts', 
    roleAuth('view_contracts'), 
    clientContractController.getClientContracts
);

// Get client contract statistics
router.get(
    '/client/contracts/stats', 
    roleAuth('view_contracts'), 
    clientContractController.getContractStats
);

// Get specific contract details (Client)
router.get(
    '/client/contracts/:contractId', 
    roleAuth('view_contracts'), 
    clientContractController.getContractDetails
);

// Update contract (Client - draft/sent status only)
router.put(
    '/client/contracts/:contractId', 
    roleAuth('manage_contracts'), 
    clientContractController.updateContract
);

// Sign contract (Client)
router.put(
    '/client/contracts/:contractId/sign', 
    roleAuth('manage_contracts'), 
    clientContractController.signContract
);

// Send contract to freelancer (Client)
router.put(
    '/client/contracts/:contractId/send', 
    roleAuth('manage_contracts'), 
    clientContractController.sendContract
);

// Cancel contract (Client)
router.put(
    '/client/contracts/:contractId/cancel', 
    roleAuth('manage_contracts'), 
    clientContractController.cancelContract
);

// ===== FREELANCER CONTRACT ROUTES =====

// Get freelancer contracts
router.get(
    '/freelancer/contracts', 
    roleAuth('view_contracts'), 
    freelancerContractController.getFreelancerContracts
);

// Get freelancer contract details
router.get(
    '/freelancer/contracts/:contractId', 
    roleAuth('view_contracts'), 
    freelancerContractController.getContractDetails
);

// Sign contract (Freelancer)
router.put(
    '/freelancer/contracts/:contractId/sign', 
    roleAuth('manage_contracts'), 
    freelancerContractController.signContract
);

// Request contract changes (Freelancer)
router.put(
    '/freelancer/contracts/:contractId/request-changes', 
    roleAuth('manage_contracts'), 
    freelancerContractController.requestContractChanges
);

// Decline contract (Freelancer)
router.put(
    '/freelancer/contracts/:contractId/decline', 
    roleAuth('manage_contracts'), 
    freelancerContractController.declineContract
);

// Get freelancer contract statistics
router.get(
    '/freelancer/contracts/stats', 
    roleAuth('view_contracts'), 
    freelancerContractController.getContractStats
);

// Get pending actions for freelancer
router.get(
    '/freelancer/contracts/pending-actions', 
    roleAuth('view_contracts'), 
    freelancerContractController.getPendingActions
);

// SHARED CONTRACT ROUTES (Both Client and Freelancer)

// Get contract by ID (shared - both parties can view if they're part of it)
router.get('/:contractId', roleAuth('view_contracts'), async (req, res) => {
    try {
        const { contractId } = req.params;
        const userId = req.userId;
        const userRole = req.userRole;

        const Contract = require('../Models/Contract');
        const contract = await Contract.findOne({
            _id: contractId,
            $or: [
                { clientId: userId },
                { freelancerId: userId }
            ]
        })
        .populate('projectId', 'title description category budget')
        .populate('clientId', 'name companyName profilePicture email phone')
        .populate('freelancerId', 'name profilePicture rating skills email phone');

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or access denied"
            });
        }

        res.json({
            success: true,
            contract,
            userRole,
            canSign: userRole === 'client' ? !contract.clientSigned : !contract.freelancerSigned
        });

    } catch (error) {
        console.error("Get shared contract error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching contract"
        });
    }
});

// Get contract milestones (shared)
router.get('/:contractId/milestones', roleAuth('view_contracts'), async (req, res) => {
    try {
        const { contractId } = req.params;
        const userId = req.userId;

        const Contract = require('../Models/Contract');
        const contract = await Contract.findOne({
            _id: contractId,
            $or: [
                { clientId: userId },
                { freelancerId: userId }
            ]
        }).select('phases totalBudget');

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or access denied"
            });
        }

        res.json({
            success: true,
            milestones: contract.phases || [],
            totalBudget: contract.totalBudget
        });

    } catch (error) {
        console.error("Get contract milestones error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching milestones"
        });
    }
});

// ADMIN/SUPERVISOR CONTRACT ROUTES

// Get all contracts (Admin/Supervisor)
router.get(
    '/admin/contracts', 
    roleAuth('admin_access'), 
    async (req, res) => {
        try {
            const { status, page = 1, limit = 20 } = req.query;
            
            let query = {};
            if (status && status !== 'all') {
                query.status = status;
            }

            const Contract = require('../Models/Contract');
            const contracts = await Contract.find(query)
                .populate('projectId', 'title category')
                .populate('clientId', 'name companyName email')
                .populate('freelancerId', 'name email skills')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalContracts = await Contract.countDocuments(query);

            res.json({
                success: true,
                contracts,
                totalPages: Math.ceil(totalContracts / limit),
                currentPage: parseInt(page),
                totalContracts
            });

        } catch (error) {
            console.error("Admin get contracts error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching contracts"
            });
        }
    }
);

// Admin contract statistics
router.get(
    '/admin/contracts/stats', 
    roleAuth('admin_access'), 
    async (req, res) => {
        try {
            const Contract = require('../Models/Contract');
            
            const stats = await Contract.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalValue: { $sum: '$totalBudget' },
                        avgValue: { $avg: '$totalBudget' }
                    }
                }
            ]);

            const overallStats = await Contract.aggregate([
                {
                    $group: {
                        _id: null,
                        totalContracts: { $sum: 1 },
                        totalValue: { $sum: '$totalBudget' },
                        activeContracts: {
                            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                        },
                        completedContracts: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        }
                    }
                }
            ]);

            res.json({
                success: true,
                statusDistribution: stats,
                overview: overallStats[0] || {
                    totalContracts: 0,
                    totalValue: 0,
                    activeContracts: 0,
                    completedContracts: 0
                }
            });

        } catch (error) {
            console.error("Admin contract stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching contract statistics"
            });
        }
    }
);

module.exports = router;