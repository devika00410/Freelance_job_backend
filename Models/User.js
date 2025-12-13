const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    email: {
        type: String, required: true, unique: true, trim: true, lowercase: true
    },
    password: {
        type: String, required: true
    },
    role: {
        type: String, enum: ['client', 'freelancer', 'admin'],
        required: true,
        default: 'client'
    },
    profile: {
        name: {
            type: String, required: true, trim: true
        },
        workEmail: {
            type: String, default: ''
        },
        avatar: {
            type: String, default: ''
        },
        bio: {
            type: String, default: ''
        },
        title: {
            type: String, default: ''
        },
        location: {
            type: String,
            default: ''
        },
        phone: {
            type: String,
            default: ""
        },
        // Client specific
        company: {
            type: String, default: ''
        },
        // Freelance specific
        hourlyRate: {
            type: Number,
            default: 0
        },
        availability: {
            type: String,
            enum: ['full-time', 'part-time', 'not-available'],
            default: 'full-time'
        },
        // Admin specific
        department: {
            type: String,
            default: ""
        }
    },
    skills: [{
        type: String,
        trim: true
    }],
    category: {
        type: String,
        trim: true
    },
    experienceLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'expert']
    },
    services: [{
        type: String
    }],
    verification: {
        emailVerified: {
            type: Boolean, default: false
        },
        phoneVerified: {
            type: Boolean, default: false
        },

        status: {
            type: String,
            enum: ['pending', 'verified', 'rejected'],
            default: 'pending'
        }
    },
    emailOTP: {
        code: { type: String },
        expiresAt: { type: Date }
    },
    phoneOTP: {
        code: { type: String },
        expiresAt: { type: Date }
    },
    settings: {
        notifications: {
            type: Boolean,
            default: true
        },
        privacy: {
            type: String,
            enum: ['public', 'private'],
            default: 'public'
        },
        language: {
            type: String,
            default: 'en'
        }
    },
    // Client specific stats
    clientStats: {
        totalProjects: {
            type: Number, default: 0
        },
        totalSpent: {
            type: Number,
            default: 0
        },
        activeProjects: {
            type: Number,
            default: 0
        },
        avgRating: {
            type: Number,
            default: 0
        }
    },
    // Freelancer specific stats
    freelancerStats: {
        totalEarnings: {
            type: Number,
            default: 0
        },
        completedProjects: {
            type: Number,
            default: 0
        },
        successRate: {
            type: Number,
            default: 0
        },
        avgRating: {
            type: Number,
            default: 0
        },
        onTimeDelivery: {
            type: Number,
            default: 0
        }
    },
    // Admin specific 
    adminPermission: {
        userManagement: {
            type: Boolean,
            default: false
        },
        contentModeration: {
            type: Boolean,
            default: false
        },
        financialOperations: {
            type: Boolean,
            default: false
        },
        systemConfiguration: {
            type: Boolean,
            default: false
        },
        supportAccess: {
            type: Boolean,
            default: false
        },
        analyticsAccess: {
            type: Boolean,
            default: false
        }
    },
    // Admin stats
    adminStats: {
        userManaged: {
            type: Number, default: 0
        },
        resolvedTickets: {
            type: Number,
            default: 0
        },
        systemUptime: {
            type: Number,
            default: 0
        }
    },
    // Freelancer specific
    interviewStatus: {
        type: String,
        enum: ['not-applied', 'pending', 'approved', 'rejected'],
        default: 'not-applied'
    },
    creditScore: {
        type: Number,
        default: 0
    }, portfolio: [{
        title: String,
        description: String,
        image: String,
        url: String
    }],
    badges: [{
        type: String
    }],
    // Admin specific
    securityLevel: {
        type: String,
        enum: ['super_admin', 'admin', 'moderator'],
        default: 'admin'
    },
    lastLogin: {
        type: Date
    }
},
    {
        timestamps: true
    })

module.exports = mongoose.model('User', userSchema)