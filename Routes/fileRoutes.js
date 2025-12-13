const express = require('express');
const router = express.Router();
const fileController = require('../Controllers/fileController');
const {authenticate} = require('../Middlewares/authMiddleware');
const uploadMiddleware = require('../Middlewares/uploadMiddleware'); // This now exports multer directly

router.use(authenticate);

// File routes - use uploadMiddleware.single() directly
router.get('/:workspaceId/files', fileController.getFiles);
router.post('/:workspaceId/files', uploadMiddleware.single('file'), fileController.uploadFile);
router.delete('/:workspaceId/files/:fileId', fileController.deleteFile);
router.get('/:workspaceId/files/:fileId/download', fileController.downloadFile);

module.exports = router;