const express = require('express');
const router = express.Router();
const notificationController = require('../Controllers/notificationController');
const {authenticate} = require('../Middlewares/authMiddleware');

router.use(authenticate);

// Notification management
router.get('/', notificationController.getNotifications);
router.get('/stats', notificationController.getNotificationStats);

// Notification actions
router.put('/:notificationId/read', notificationController.markNotificationAsRead); 
router.put('/mark-all-read', notificationController.markAllNotificationsAsRead); 
router.delete('/:notificationId', notificationController.deleteNotification);
router.delete('/', notificationController.clearAll);

module.exports = router;