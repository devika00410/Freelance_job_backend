const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileId: {
    type: String,
    required: true,
    unique: true
  },
  projectId: {
    type: String,
    required: true
  },
  workspaceId: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: String,
    required: true
  },
  uploaderRole: {
    type: String,
    enum: ['client', 'freelancer', 'admin'],
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileSize: {
    type: String,
    required: true
  },
  fileSizeBytes: {
    type: Number,
    required: true
  },
  fileType: {
    type: String,
    enum: [
      'design_document',
      'code_file',
      'image',
      'video',
      'audio',
      'document',
      'spreadsheet',
      'presentation',
      'archive',
      'other'
    ],
    required: true
  },
  fileExtension: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  relatedPhase: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  purpose: {
    type: String,
    enum: [
      'milestone_submission',
      'client_feedback',
      'reference_material',
      'contract_document',
      'progress_report',
      'final_deliverable',
      'other'
    ],
    required: true
  },
  url: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  version: {
    type: Number,
    default: 1
  },
  previousVersion: {
    type: String,
    default: null
  },
  isCurrentVersion: {
    type: Boolean,
    default: true
  },
  accessPermissions: {
    client: {
      canView: { type: Boolean, default: true },
      canDownload: { type: Boolean, default: true },
      canDelete: { type: Boolean, default: false }
    },
    freelancer: {
      canView: { type: Boolean, default: true },
      canDownload: { type: Boolean, default: true },
      canDelete: { type: Boolean, default: true }
    }
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloaded: {
    type: Date,
    default: null
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  },
  metadata: {
    dimensions: {
      width: Number,
      height: Number
    },
    duration: Number,
    pages: Number,
    resolution: String
  },
  checksum: {
    type: String,
    default: null
  },
  storageLocation: {
    type: String,
    enum: ['local', 's3', 'google_drive', 'azure'],
    default: 'local'
  }
});

fileSchema.pre('save', function(next) {
  if (this.fileSize && !this.fileSizeBytes) {
    const sizeMatch = this.fileSize.match(/(\d+\.?\d*)\s*(\w+)/);
    if (sizeMatch) {
      const value = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toLowerCase();
      const multipliers = { 'kb': 1024, 'mb': 1024 * 1024, 'gb': 1024 * 1024 * 1024 };
      this.fileSizeBytes = Math.round(value * (multipliers[unit] || 1));
    }
  }

  if (!this.fileExtension && this.filename) {
    this.fileExtension = this.filename.split('.').pop().toLowerCase();
  }

  next();
});

fileSchema.virtual('downloadUrl').get(function() {
  return `${this.url}?download=true`;
});

fileSchema.virtual('isImage').get(function() {
  return ['image', 'design_document'].includes(this.fileType);
});

fileSchema.virtual('isVideo').get(function() {
  return this.fileType === 'video';
});

fileSchema.virtual('isDocument').get(function() {
  return ['document', 'spreadsheet', 'presentation'].includes(this.fileType);
});

fileSchema.virtual('canClientDownload').get(function() {
  return this.accessPermissions.client.canDownload;
});

fileSchema.virtual('canFreelancerDelete').get(function() {
  return this.accessPermissions.freelancer.canDelete;
});

fileSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  this.lastDownloaded = new Date();
  return this.save();
};

fileSchema.methods.archiveFile = function() {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

fileSchema.methods.restoreFile = function() {
  this.isArchived = false;
  this.archivedAt = null;
  return this.save();
};

fileSchema.methods.createNewVersion = function(newFileData) {
  this.isCurrentVersion = false;
  return this.save().then(() => {
    const newFile = this.toObject();
    delete newFile._id;
    newFile.fileId = `file_${Date.now()}`;
    newFile.previousVersion = this.fileId;
    newFile.version = this.version + 1;
    newFile.isCurrentVersion = true;
    Object.assign(newFile, newFileData);
    return File.create(newFile);
  });
};

fileSchema.statics.findByProject = function(projectId) {
  return this.find({ projectId, isArchived: false }).sort({ uploadDate: -1 });
};

fileSchema.statics.findByWorkspace = function(workspaceId) {
  return this.find({ workspaceId, isArchived: false }).sort({ uploadDate: -1 });
};

fileSchema.statics.findByPhase = function(workspaceId, phaseNumber) {
  return this.find({ 
    workspaceId, 
    relatedPhase: phaseNumber,
    isArchived: false 
  }).sort({ uploadDate: -1 });
};

fileSchema.statics.findByPurpose = function(workspaceId, purpose) {
  return this.find({ 
    workspaceId, 
    purpose,
    isArchived: false 
  }).sort({ uploadDate: -1 });
};

fileSchema.statics.findByUploader = function(uploadedBy) {
  return this.find({ uploadedBy, isArchived: false }).sort({ uploadDate: -1 });
};

fileSchema.index({ projectId: 1, uploadDate: -1 });
fileSchema.index({ workspaceId: 1, relatedPhase: 1 });
fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ fileType: 1 });
fileSchema.index({ purpose: 1 });
fileSchema.index({ isArchived: 1 });

const File = mongoose.model('File', fileSchema);

module.exports = File;