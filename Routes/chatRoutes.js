const express = require('express');
const router = express.Router();
const chatController = require('../Controllers/chatController');
const {authenticate} = require('../Middlewares/authMiddleware');

router.use(authenticate);

// Message management
router.get('/:workspaceId/messages', chatController.getMessages);
router.post('/:workspaceId/messages', chatController.sendMessage);
router.delete('/:workspaceId/messages/:messageId', chatController.deleteMessage);

// Message status
router.put('/:workspaceId/mark-read', chatController.markAsRead);
router.get('/:workspaceId/unread-count', chatController.getUnreadCount);

// Search
router.get('/:workspaceId/search', chatController.searchMessages);

// Participants
router.get('/:workspaceId/participants', chatController.getParticipants);

module.exports = router;