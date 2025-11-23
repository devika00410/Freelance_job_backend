const File = require('../Models/File');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

exports.getFiles = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const files = await File.findByWorkspace(workspaceId);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { workspaceId } = req.params;
    const { projectId, relatedPhase, purpose, description, tags } = req.body;

    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const fileType = determineFileType(fileExtension, req.file.mimetype);

    const fileData = {
      fileId: `file_${uuidv4()}`,
      projectId,
      workspaceId,
      uploadedBy: req.user.userId,
      uploaderRole: req.user.role,
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: formatFileSize(req.file.size),
      fileSizeBytes: req.file.size,
      fileType,
      fileExtension,
      mimeType: req.file.mimetype,
      relatedPhase: parseInt(relatedPhase),
      purpose,
      url: `/uploads/${req.file.filename}`,
      description: description || '',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    };

    const file = await File.create(fileData);
    res.status(201).json(file);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = await File.findOne({ fileId });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const canDelete = req.user.role === 'admin' || 
                     (req.user.role === 'freelancer' && file.canFreelancerDelete) ||
                     (req.user.role === 'client' && file.accessPermissions.client.canDelete);

    if (!canDelete) {
      return res.status(403).json({ error: 'Insufficient permissions to delete file' });
    }

    if (file.storageLocation === 'local' && fs.existsSync(file.url)) {
      fs.unlinkSync(file.url);
    }

    await File.deleteOne({ fileId });
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

exports.downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = await File.findOne({ fileId });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const canView = req.user.role === 'admin' || 
                   (req.user.role === 'client' && file.accessPermissions.client.canView) ||
                   (req.user.role === 'freelancer' && file.accessPermissions.freelancer.canView);

    if (!canView) {
      return res.status(403).json({ error: 'Insufficient permissions to view file' });
    }

    await file.incrementDownload();

    if (file.storageLocation === 'local') {
      const filePath = path.join(__dirname, '..', file.url);
      res.download(filePath, file.originalName);
    } else {
      res.redirect(file.downloadUrl);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to download file' });
  }
};

function determineFileType(extension, mimeType) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
  const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'];
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
  const documentExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
  const spreadsheetExtensions = ['.xls', '.xlsx', '.csv'];
  const presentationExtensions = ['.ppt', '.pptx'];
  const archiveExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz'];
  const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.html', '.css', '.php'];

  if (imageExtensions.includes(extension)) return 'image';
  if (videoExtensions.includes(extension)) return 'video';
  if (audioExtensions.includes(extension)) return 'audio';
  if (documentExtensions.includes(extension)) return 'document';
  if (spreadsheetExtensions.includes(extension)) return 'spreadsheet';
  if (presentationExtensions.includes(extension)) return 'presentation';
  if (archiveExtensions.includes(extension)) return 'archive';
  if (codeExtensions.includes(extension)) return 'code_file';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('video')) return 'video';
  if (mimeType.includes('audio')) return 'audio';
  if (mimeType.includes('pdf')) return 'document';
  if (mimeType.includes('text')) return 'document';

  return 'other';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}