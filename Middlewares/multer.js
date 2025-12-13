const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const createUploadDirs = () => {
  const dirs = [
    'uploads/',
    'uploads/profile/',
    'uploads/cover/',
    'uploads/projects/',
    'uploads/documents/',
    'uploads/gallery/'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createUploadDirs();

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/';
    
    // Determine upload directory based on file type or route
    if (req.baseUrl.includes('profile')) {
      uploadPath = 'uploads/profile/';
    } else if (req.baseUrl.includes('cover')) {
      uploadPath = 'uploads/cover/';
    } else if (req.baseUrl.includes('projects')) {
      uploadPath = 'uploads/projects/';
    } else if (req.baseUrl.includes('documents')) {
      uploadPath = 'uploads/documents/';
    } else if (req.baseUrl.includes('gallery')) {
      uploadPath = 'uploads/gallery/';
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create unique filename: timestamp-randomString-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = file.fieldname + '-' + uniqueSuffix + fileExtension;
    cb(null, fileName);
  }
});

// File filter for images
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// File filter for documents
const documentFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only document files (PDF, DOC, DOCX, PPT, TXT) are allowed!'), false);
  }
};

// File size limits (5MB for images, 10MB for documents)
const limits = {
  fileSize: {
    images: 5 * 1024 * 1024, // 5MB
    documents: 10 * 1024 * 1024 // 10MB
  }
};

// Multer instances for different upload types
const uploadProfileImage = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: { fileSize: limits.fileSize.images }
});

const uploadCoverImage = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: { fileSize: limits.fileSize.images }
});

const uploadProjectImages = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: { fileSize: limits.fileSize.images }
});

const uploadGalleryImages = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: { fileSize: limits.fileSize.images }
});

const uploadDocuments = multer({
  storage: storage,
  fileFilter: documentFilter,
  limits: { fileSize: limits.fileSize.documents }
});

// Multiple file upload for project galleries
const uploadMultipleImages = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: { fileSize: limits.fileSize.images }
}).array('images', 10); // Max 10 images

// Error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Please upload a smaller file.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Please upload fewer files.'
      });
    }
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

module.exports = {
  uploadProfileImage,
  uploadCoverImage,
  uploadProjectImages,
  uploadGalleryImages,
  uploadDocuments,
  uploadMultipleImages,
  handleMulterError
};