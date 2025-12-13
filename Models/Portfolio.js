const mongoose = require('mongoose');

const completedProjectSchema = new mongoose.Schema({
  projectId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  serviceType: {
    type: String,
    required: true
  },
  budget: {
    type: Number,
    required: true,
    min: 0
  },
  clientRating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  clientReview: {
    type: String,
    default: ''
  },
  completionDate: {
    type: Date,
    required: true
  },
  milestonePhases: {
    type: Number,
    required: true,
    min: 1
  },
  successfulPayments: {
    type: Number,
    required: true,
    min: 0
  },
  projectDuration: {
    type: String,
    default: ''
  },
  technologies: [{
    type: String,
    trim: true
  }],
  projectUrl: {
    type: String,
    default: ''
  },
  featured: {
    type: Boolean,
    default: false
  }
});

const certificationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  issuingOrganization: {
    type: String,
    required: true
  },
  issueDate: {
    type: Date,
    required: true
  },
  expirationDate: {
    type: Date,
    default: null
  },
  credentialId: {
    type: String,
    default: ''
  },
  credentialUrl: {
    type: String,
    default: ''
  }
});

const educationSchema = new mongoose.Schema({
  degree: {
    type: String,
    required: true
  },
  institution: {
    type: String,
    required: true
  },
  fieldOfStudy: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    default: null
  },
  currentlyEnrolled: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    default: ''
  }
});

const portfolioSchema = new mongoose.Schema({
  portfolioId: {
    type: String,
    required: true,
    unique: true
  },
  freelancerId: {
    type: String,
    required: true,
    unique: true
  },
  services: [{
    type: String,
    required: true
  }],
  skills: [{
    name: {
      type: String,
      required: true
    },
    proficiency: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate'
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      default: 0
    }
  }],
  experience: {
    type: String,
    required: true
  },
  totalExperienceYears: {
    type: Number,
    min: 0,
    default: 0
  },
  bio: {
    type: String,
    required: true
  },
  completedProjects: [completedProjectSchema],
  certifications: [certificationSchema],
  education: [educationSchema],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalRatings: {
    type: Number,
    min: 0,
    default: 0
  },
  totalProjects: {
    type: Number,
    min: 0,
    default: 0
  },
  successRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  hourlyRate: {
    type: Number,
    min: 0,
    default: 0
  },
  availability: {
    type: String,
    enum: ['available', 'unavailable', 'limited'],
    default: 'available'
  },
  languages: [{
    language: {
      type: String,
      required: true
    },
    proficiency: {
      type: String,
      enum: ['basic', 'conversational', 'fluent', 'native'],
      default: 'conversational'
    }
  }],
  location: {
    country: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    timezone: {
      type: String,
      default: ''
    },
    remote: {
      type: Boolean,
      default: true
    }
  },
  socialLinks: {
    website: {
      type: String,
      default: ''
    },
    github: {
      type: String,
      default: ''
    },
    linkedin: {
      type: String,
      default: ''
    },
    twitter: {
      type: String,
      default: ''
    }
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  coverPhoto: {
    type: String,
    default: ''
  },
  featured: {
    type: Boolean,
    default: false
  },
  verified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  documents:[{
    name:String,
    fileType:String,
    fileUrl:String,
    fileSize:String,
    description:String,
    uploadedAt:{type:Date,default:Date.now}
  }],
  gallery:[{
    name:String,
    imageUrl:String,
    description:String,
    uploadedAt:{type:Date,default:Date.now}
  }],
  profileImage:String,
  coverImage:String
},{timestamps:true});

portfolioSchema.pre('save', function(next) {
  this.lastUpdated = new Date();

  if (this.experience) {
    const yearsMatch = this.experience.match(/(\d+)/);
    if (yearsMatch) {
      this.totalExperienceYears = parseInt(yearsMatch[1]);
    }
  }

  if (this.completedProjects.length > 0) {
    this.totalProjects = this.completedProjects.length;
    
    const successfulProjects = this.completedProjects.filter(project => 
      project.successfulPayments === project.milestonePhases
    ).length;
    
    this.successRate = this.totalProjects > 0 ? 
      Math.round((successfulProjects / this.totalProjects) * 100) : 0;

    const totalRating = this.completedProjects.reduce((sum, project) => 
      sum + project.clientRating, 0
    );
    this.rating = this.totalProjects > 0 ? 
      parseFloat((totalRating / this.totalProjects).toFixed(1)) : 0;
    
    this.totalRatings = this.totalProjects;
  }

  next();
});

portfolioSchema.virtual('isAvailable').get(function() {
  return this.availability === 'available';
});

portfolioSchema.virtual('totalEarnings').get(function() {
  return this.completedProjects.reduce((total, project) => 
    total + project.budget, 0
  );
});

portfolioSchema.virtual('featuredProjects').get(function() {
  return this.completedProjects.filter(project => project.featured);
});

portfolioSchema.virtual('topSkills').get(function() {
  return this.skills
    .filter(skill => skill.proficiency === 'expert' || skill.proficiency === 'advanced')
    .slice(0, 5);
});

portfolioSchema.methods.addProject = function(projectData) {
  this.completedProjects.push(projectData);
  return this.save();
};

portfolioSchema.methods.removeProject = function(projectId) {
  this.completedProjects = this.completedProjects.filter(
    project => project.projectId !== projectId
  );
  return this.save();
};

portfolioSchema.methods.updateRating = function(projectId, newRating, review = '') {
  const project = this.completedProjects.find(p => p.projectId === projectId);
  if (project) {
    project.clientRating = newRating;
    if (review) {
      project.clientReview = review;
    }
  }
  return this.save();
};

portfolioSchema.methods.addSkill = function(skillName, proficiency = 'intermediate', years = 0) {
  const existingSkill = this.skills.find(skill => skill.name === skillName);
  if (existingSkill) {
    existingSkill.proficiency = proficiency;
    existingSkill.yearsOfExperience = years;
  } else {
    this.skills.push({
      name: skillName,
      proficiency,
      yearsOfExperience: years
    });
  }
  return this.save();
};

portfolioSchema.statics.findByService = function(serviceType) {
  return this.find({ 
    services: { $in: [serviceType] },
    featured: true 
  }).sort({ rating: -1 });
};

portfolioSchema.statics.findBySkills = function(skills) {
  return this.find({ 
    'skills.name': { $in: skills } 
  }).sort({ rating: -1 });
};

portfolioSchema.statics.findTopRated = function(limit = 10) {
  return this.find({ 
    totalRatings: { $gte: 5 },
    rating: { $gte: 4.0 }
  }).sort({ rating: -1 }).limit(limit);
};

portfolioSchema.index({ freelancerId: 1 });
portfolioSchema.index({ services: 1 });
portfolioSchema.index({ 'skills.name': 1 });
portfolioSchema.index({ rating: -1 });
portfolioSchema.index({ featured: 1 });
portfolioSchema.index({ 'location.country': 1 });

const Portfolio = mongoose.model('Portfolio', portfolioSchema);

module.exports = Portfolio;