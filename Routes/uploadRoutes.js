const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Create unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const filename = 'image-' + uniqueSuffix + fileExtension;
    console.log('Saving file as:', filename);
    cb(null, filename);
  }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter
});

// Single file upload endpoint
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }
    
    console.log('File uploaded successfully:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    
    const filePath = `/uploads/${req.file.filename}`;
    const fullUrl = `http://localhost:5000${filePath}`;
    
    console.log('File path:', filePath);
    console.log('Full URL:', fullUrl);
    
    // Return success response with both relative path and full URL
    res.json({
      success: true,
      filePath: filePath,
      fullUrl: fullUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      message: 'File uploaded successfully'
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Upload failed: ' + error.message 
    });
  }
});

// Multiple file upload endpoint
router.post('/upload-multiple', upload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No files uploaded' 
      });
    }
    
    const fileData = req.files.map(file => ({
      filePath: `/uploads/${file.filename}`,
      fullUrl: `http://localhost:5000/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      fileSize: file.size
    }));
    
    res.json({
      success: true,
      files: fileData,
      message: `${req.files.length} files uploaded successfully`
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Upload failed' 
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }
  }
  
  console.error('Upload route error:', error);
  res.status(400).json({
    success: false,
    error: error.message
  });
});

module.exports = router;