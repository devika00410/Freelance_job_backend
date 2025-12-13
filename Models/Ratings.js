const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    projectId: {
        type: String,
        ref: 'Project',
        required: true
    },
    jobId: {
        type: String,
        ref: 'Job',
        required: true
    },
   
    raterId: {
        type: String,
        ref: 'User',
        required: true
    },

    
    ratedUserId: {
        type: String,
        ref: 'User',
        required: true
    },

    // Type of rating 
    type: {
        type: String,
        enum: ['freelancer', 'client'],
        required: true
    },

    // Overall rating
    overallRating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    
    categoryRatings: {
        communication: {
            type: Number,
            min: 1,
            max: 5,
            default: 5
        },
        quality: {
            type: Number,
            min: 1,
            max: 5,
            default: 5
        },
        professionalism: {
            type: Number,
            min: 1,
            max: 5,
            default: 5
        },
        deadline: {
            type: Number,
            min: 1,
            max: 5,
            default: 5
        },

        // For freelancers only
        technicalSkills: {
            type: Number,
            min: 1,
            max: 5,
            default: 5
        }
    },

    // Written feedback
    comment: {
        type: String,
        maxlength: 1000,
        trim: true
    },

 
    wouldWorkAgain: {
        type: Boolean,
        default: true
    },

    // Review status
    status: {
        type: String,
        enum: ['draft', 'submitted', 'published', 'flagged'],
        default: 'submitted'
    },
  
    response: {
        comment: String,
        respondedAt: Date
    }
}, {
    timestamps: true
});


ratingSchema.index({ ratedUserId: 1, type: 1 });
ratingSchema.index({ projectId: 1 });
ratingSchema.index({ raterId: 1 });
ratingSchema.index({ overallRating: -1 });
ratingSchema.index({ createdAt: -1 });

ratingSchema.virtual('averageCategoryRating').get(function() {
    const categories = Object.values(this.categoryRatings);
    const sum = categories.reduce((total, rating) => total + rating, 0);
    return (sum / categories.length).toFixed(1);
});


ratingSchema.methods.isPositive = function() {
    return this.overallRating >= 4;
};


ratingSchema.statics.getAverageRating = async function(userId, type) {
    const result = await this.aggregate([
        { 
            $match: { 
                ratedUserId: userId, 
                type: type,
                status: 'published'
            }
        },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$overallRating' },
                totalRatings: { $sum: 1 },
                fiveStar: { $sum: { $cond: [{ $eq: ['$overallRating', 5] }, 1, 0] } },
                fourStar: { $sum: { $cond: [{ $eq: ['$overallRating', 4] }, 1, 0] } },
                threeStar: { $sum: { $cond: [{ $eq: ['$overallRating', 3] }, 1, 0] } },
                twoStar: { $sum: { $cond: [{ $eq: ['$overallRating', 2] }, 1, 0] } },
                oneStar: { $sum: { $cond: [{ $eq: ['$overallRating', 1] }, 1, 0] } }
            }
        }
    ]);
    
    return result.length > 0 ? result[0] : { 
        averageRating: 0, 
        totalRatings: 0, 
        fiveStar: 0, 
        fourStar: 0, 
        threeStar: 0, 
        twoStar: 0, 
        oneStar: 0 
    };
};

module.exports = mongoose.model('Rating', ratingSchema);