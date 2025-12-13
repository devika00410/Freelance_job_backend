const mongoose = require('mongoose');

const popularPackageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    deliverables: [{
        type: String,
        required: true
    }],
    timeline: {
        type: String,
        required: true
    }
});

const serviceSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000
    },
    category: {
        type: String,
        required: true
    },
    subcategories: [{
        type: String,
        required: true
    }],
    // Remove the React icon import and use string for icon names
    icon: {
        type: String,
        default: 'clipboard-list' // Just use string icon names
    },
    tags: [{
        type: String,
        trim: true
    }],
    status: {
        type: String,
        enum: ['active', 'inactive', 'draft'],
        default: 'active'
    },
    popularity: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    requirements: {
        minExperience: {
            type: String,
            required: true
        },
        skills: [{
            type: String,
            required: true
        }],
        portfolioRequired: {
            type: Boolean,
            default: false
        },
        verificationRequired: {
            type: Boolean,
            default: false
        }
    },
    pricing: {
        hourlyRange: {
            min: {
                type: Number,
                required: true,
                min: 0
            },
            max: {
                type: Number,
                required: true,
                min: 0
            }
        },
        projectRange: {
            min: {
                type: Number,
                required: true,
                min: 0
            },
            max: {
                type: Number,
                required: true,
                min: 0
            }
        },
        popularPackages: [popularPackageSchema]
    },
    metrics: {
        successRate: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        avgDeliveryTime: {
            type: String,
            default: ''
        },
        clientSatisfaction: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },
        repeatClientRate: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        }
    },
    workflow: {
        discoveryCall: {
            type: Boolean,
            default: false
        },
        milestonePayments: {
            type: Boolean,
            default: false
        },
        revisionsIncluded: {
            type: Number,
            default: 0
        },
        supportPeriod: {
            type: String,
            default: ''
        }
    },
    createdBy: {
        type: String,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

serviceSchema.index({ category: 1, status: 1 });
serviceSchema.index({ subcategories: 1 });
serviceSchema.index({ tags: 1 });
serviceSchema.index({ popularity: -1 });

const Service = mongoose.model('Service', serviceSchema);
module.exports = Service;