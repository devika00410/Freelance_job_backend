const express = require('express');
const router = express.Router();
const clientProjectController = require('../Controllers/clientProjectController');
const { authenticate } = require('../Middlewares/authMiddleware');
const upload = require('../Middlewares/uploadMiddleware'); 

router.use(authenticate);

// POST project (job posting)
router.post('/', upload.array('attachments', 5), clientProjectController.postProject);

// GET client projects
router.get('/:clientId', clientProjectController.getClientProjects);
router.get('/:clientId/stats', clientProjectController.getClientProjectStats);
router.get('/:clientId/pending-actions', clientProjectController.getClientPendingActions);

module.exports = router;