const mongoose = require('mongoose')

const milestonesSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: String,
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'paid'],
        default: 'pending'
    },
    dueDate: Date,
    completedAt: Date
});

const jobSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description:{
        type:String,
        required:true
    },
    budget:{
        type:Number,
        required:true
    }, currency:{
        type:String,
        default:'USD'
    },
    serviceCategory:{
        type:String,
        required:true
    },category:{
        type:String,
        required:true
    },
    skillsRequired:[{
        type:String,
        trim:true
    }],
    clientId:{
        type:String,
        ref:'User',
        required:true
    },
    status:{
        type:String,
        enum:['draft','active','paused','completed','cancelled'],
        default:'active'
    },
    hiringStatus:{
        type:String,
        enum:['accepting_proposals','reviewing_proposals','hiring','closed'],
        default:'accepting_proposals'
    },
    experienceLevel:{
        type:String,
        enum:['entry','intermediate','expert'],
        required:true
    },
    duration:{
        type:String,
        required:true
    },
    projectType:{
        type:String,
        enum:['one_time','ongoing','hourly'],
        required:true
    },
    proposals:[{
        type:String,
        ref:'Proposal'
    }],
    hiredFreelancer:{
        type:String,
        ref:'User'
    },
    mileStones:[milestonesSchema],
    preferences:{
        location:{
            type:String,
            default:'any'
        },
        englishLevel:{
            type:String,
            enum:['basic','conversational','fluent','native'],
            default:'fluent'
        },
        timezoneOverlap:{
            type:String,
            default:'4+hours'
        }
    },
    visibility:{
        type:String,
        enum:['public','private','invite_only'],
        default:'public'
    },
    proposalCount:{
        type:Number,
        default:0
    },
    viewCount:{
        type:Number,
        default:0
    },deadline:{
        type:Date,
        required:true
    }
},{
    timestamps:true
})

jobSchema.index({clientId:1,status:1})
jobSchema.index({category:1,status:1})
jobSchema.index({skillsRequired:1})
jobSchema.index({createdAt:-1})

// to check if job is still active
jobSchema.methods.isActive=function(){
    return this.status === 'active' && this.hiringStatus === 'accepting_proposals';
}

// static method to get jobs by client
jobSchema.statics.findByClient= function(clientId){
    return this.find({clientId}).sort({createdAt:-1})
}

// statis method to get active jobs

jobSchema.statics.findActive= function(){
    return this.find({
status:'active',
hiringStatus:'accepting_proposals',
deadline:{$gt:new Date()}
    })
}

const Job = mongoose.model('Job',jobSchema);

module.exports= Job

