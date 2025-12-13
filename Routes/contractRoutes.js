const express = require('express');
const router = express.Router();
const clientContractController = require('../Controllers/clientContractController');
const freelancerContractController = require('../Controllers/freelancerContractController');
const { authenticate } = require('../Middlewares/authMiddleware');
const roleAuth = require('../Middlewares/roleAuth');

// Apply authentication to all routes
router.use(authenticate);



// Add this debug route before the other routes
router.get('/debug/contract/:contractId', authenticate, async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.userId;
    
    const Contract = require('../Models/Contract');
    
    const contract = await Contract.findById(contractId)
      .populate('clientId', 'name email')
      .populate('freelancerId', 'name email');
    
    if (!contract) {
      return res.json({
        success: false,
        message: 'Contract not found in database',
        contractId,
        userId
      });
    }
    
    res.json({
      success: true,
      contract: {
        _id: contract._id,
        contractId: contract.contractId,
        title: contract.title,
        status: contract.status,
        clientId: contract.clientId,
        freelancerId: contract.freelancerId,
        clientSigned: contract.clientSigned,
        freelancerSigned: contract.freelancerSigned,
        clientSignedAt: contract.clientSignedAt,
        freelancerSignedAt: contract.freelancerSignedAt,
        createdAt: contract.createdAt
      },
      userInfo: {
        userId: userId,
        isClient: contract.clientId?._id?.toString() === userId.toString(),
        isFreelancer: contract.freelancerId?._id?.toString() === userId.toString()
      },
      canSign: !contract.freelancerSigned && ['sent', 'pending', 'draft'].includes(contract.status)
    });
    
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get contract by workspace ID
router.get('/workspace/:workspaceId', authenticate, async (req, res) => {
  try {
    console.log('🔍 Fetching contract for workspace:', req.params.workspaceId);
    
    const Contract = require('../Models/Contract');
    const contract = await Contract.findOne({ 
      workspaceId: req.params.workspaceId 
    });
    
    if (!contract) {
      return res.json({
        success: true,
        message: 'No contract found for this workspace',
        contract: null
      });
    }
    
    res.json({
      success: true,
      contract: contract
    });
    
  } catch (error) {
    console.error('Contract fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new contract
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

// Client contract stats
router.get(
    '/client/contracts/stats',
    roleAuth('view_contracts'),
    clientContractController.getContractStats
);

// Get single contract
router.get(
    '/client/contracts/:contractId',
    roleAuth('view_contracts'),
    clientContractController.getContractDetails
);

// Update contract
router.put(
    '/client/contracts/:contractId',
    roleAuth('manage_contracts'),
    clientContractController.updateContract
);

// Client sign contract
router.put(
    '/client/contracts/:contractId/sign',
    roleAuth('manage_contracts'),
    clientContractController.signContract
);

// Send contract
router.put(
    '/client/contracts/:contractId/send',
    roleAuth('manage_contracts'),
    clientContractController.sendContract
);

// Cancel contract
router.put(
    '/client/contracts/:contractId/cancel',
    roleAuth('manage_contracts'),
    clientContractController.cancelContract
);

/* ============================================================
   FREELANCER CONTRACT ROUTES
============================================================ */

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

// Freelancer sign
router.put(
    '/freelancer/contracts/:contractId/sign',
    roleAuth('manage_contracts'),
    freelancerContractController.signContract
);

// Freelancer request changes
router.put(
    '/freelancer/contracts/:contractId/request-changes',
    roleAuth('manage_contracts'),
    freelancerContractController.requestContractChanges
);

// Freelancer decline
router.put(
    '/freelancer/contracts/:contractId/decline',
    roleAuth('manage_contracts'),
    freelancerContractController.declineContract
);

// Freelancer contract stats
router.get(
    '/freelancer/contracts/stats',
    roleAuth('view_contracts'),
    freelancerContractController.getContractStats
);

// Freelancer pending actions
router.get(
    '/freelancer/contracts/pending-actions',
    roleAuth('view_contracts'),
    freelancerContractController.getPendingActions
);

/* ============================================================
   WORKSPACE CREATION ROUTE (IMPORTANT)
   ⭐ MUST be BEFORE shared '/:contractId' routes
============================================================ */

router.post('/:contractId/create-workspace', roleAuth('manage_contracts'), async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.userId;

    const Contract = require('../Models/Contract');
    const contract = await Contract.findById(contractId);

    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    // Ensure user is part of this contract
    if (
      contract.clientId.toString() !== userId.toString() &&
      contract.freelancerId.toString() !== userId.toString()
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Both signatures required
    if (!contract.clientSigned || !contract.freelancerSigned) {
      return res.status(400).json({
        success: false,
        message: "Contract is not fully signed yet"
      });
    }

    // Already has workspace
    if (contract.workspaceId) {
      return res.status(200).json({
        success: true,
        message: "Workspace already exists",
        workspaceId: contract.workspaceId
      });
    }

    // Create workspace
    const WorkspaceService = require('../Services/WorkspaceService');
    const workspace = await WorkspaceService.createWorkspaceFromContract(contract._id);

    return res.json({
      success: true,
      message: "Workspace created successfully",
      workspace: {
        id: workspace._id,
        workspaceId: workspace.workspaceId,
        projectTitle: workspace.projectTitle,
        redirectUrl: `/workspace/${workspace.workspaceId}`
      }
    });

  } catch (error) {
    console.error("Create workspace error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error creating workspace"
    });
  }
});

/* ============================================================
   SHARED CONTRACT ROUTES (client & freelancer)
============================================================ */

// Get contract by ID (shared)
router.get('/:contractId', roleAuth('view_contracts'), async (req, res) => {
    try {
        const { contractId } = req.params;
        const userId = req.userId;
        const userRole = req.userRole;

        const Contract = require('../Models/Contract');

        const contract = await Contract.findOne({
            _id: contractId,
            $or: [{ clientId: userId }, { freelancerId: userId }]
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
            $or: [{ clientId: userId }, { freelancerId: userId }]
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

/* ============================================================ */

module.exports = router;
