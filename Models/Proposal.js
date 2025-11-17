const mongoose= require("mongoose")

const proposalMilestoneSchema= new mongoose.Schema({
    title:{
        type:String,
        required:true
    },
    days:{
        type:Number,
        required:true
    },
    amount:{
        type:Number,
        required:true
    }, description:String,
    status:{
        type:String,
        enum:['pending','active','completed','paid'],
        default:'pending'
    }
});
const proposalSchema= new mongoose.Schema({
    _id:{
        type:String,
        required:true
    },
    projectId:{
        type:String,
        ref:'Job',
        required:true
    },
    freelancerId:{
        type:String,
        ref:'User',
        required:true
    },
    clientId:{
        type:String,
        ref:'User',
        required:true
    },
    serviceCategory:{
        type:String,
        required:true
    },
    coverLetter:{
        type:String,
        required:true
    },
    proposalDetails:{
        estimatedHours:{
            type:Number,
            required:true
        },
        deliveryTime:{
            type:String,
            required:true
        },
        totalAmount:{
            type:Number,
            required:true
        },
        hourlyRate:{
            type:Number
        },
        revisions:{
            type:Number,
            default:1
        },
        supportPeriod:{
            type:String,
            default:'30 days'
        }
    },
    milestones:[proposalMilestoneSchema],
    status:{
        type:String,
        enum:['submitted','under_review','accepted','rejected','withdrawn','expired'],
        default:'submitted'
    },
    isHired:{
        type:Boolean,
        default:false
    },
    hiredAt:Date,
    rejectionReason:String,
    clientFeedback:String,
    freelancerRating:{
        type:Number,
        min:1,
        max:5
    },
    messages:[{
        senderId:String,
        message:String,
        sendAt:{
            type:Date,
            default:Date.now
        }
    }]
},{
    timestamps:true
})

// Pre-save middleware to calculate hourly rate

proposalSchema.pre('save',function(next){
    if(this.proposalDetails.estimatedHours && this.proposalDetails.totalAmount){
        this.proposalDetails.hourlyRate=
        this.proposalDetails.totalAmount/this.proposalDetails.estimatedHours
    }
    next()
})

// Indexes for better query performances

proposalSchema.index({projectId:1,status:1})
proposalSchema.index({freelancerId:1,status:1})
proposalSchema.index({clientId:1,status:1})
proposalSchema.index({createdAt:-1})

// to check if proposal is active
proposalSchema.methods.isActive=function(){
    return this.status === 'submitted' || this.status === 'under_review'
};

// accept proposal
proposalSchema.methods.acceptProposal = function(){
this.status='accepted';
this.isHired=true;
this.hiredAt=new Date()
return this.save()
}

// reject proposal
proposalSchema.methods.rejectProposal=function(reason){
    this.status='rejected';
    this.rejectionReason=reason;
    return this.save()
}

// Static method to get proposals by client
proposalSchema.statics.findByClient=function(clientId){
    return this.find({clientId})
    .populate('projectId','title budget duration')
    .populate('freelancerId','name profilePicture rating')
    .sort({createdAt:-1})
};

// Static method to get proposals by freelancer
proposalSchema.statics.findByFreelancer= function(freelancerId){
    return this.find({freelancerId})
    .populate('projectId','title budget duration clientId')
    .populate('clientId','name companyName rating')
    .sort({createdAt:-1})
}

// to get proposals for specific job

proposalSchema.statics.findByProject=function(projectId){
    return this.find({projectId})
    .populate('freelancerId','name profilePicture skills rating completedProjects')
.sort({createdAt:-1})
};

// count proposal status for a client
proposalSchema.statics.countByClientAndStats= function(clientId,status){
    return this.countDocuments({clientId,status})
};
const Proposal= mongoose.model('Proposal', proposalSchema)

module.exports = Proposal;

