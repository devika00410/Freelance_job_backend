const express = require('express');
const router = express.Router();
const videoCallController = require('../Controllers/videocallController');
const {authenticate} = require('../Middlewares/authMiddleware');

router.use(authenticate);

// Call management
router.post('/:workspaceId/schedule', videoCallController.scheduleCall);
router.post('/:workspaceId/instant-call', videoCallController.createInstantCall);
router.get('/:workspaceId/calls', videoCallController.getWorkspaceCalls);
router.get('/:workspaceId/call-stats', videoCallController.getCallStats);

// Specific call operations
router.get('/calls/:callId', videoCallController.getCallDetails);
router.put('/calls/:callId', videoCallController.updateCall);
router.put('/calls/:callId/cancel', videoCallController.cancelCall);
router.put('/calls/:callId/start', videoCallController.startCall);
router.put('/calls/:callId/end', videoCallController.endCall);

module.exports = router;