const mongoose = require('mongoose')


const jobSchema = new mongoose.Schema({
   
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
        default:'INR'
    },
    serviceCategory:{
        type:String,
        required:true,
        default:"Web Development"
    },category:{
        type:String,
        required:true
    },
    skillsRequired:[{
        type:String,
        trim:true
    }],
    clientId:{
        type:mongoose.Schema.Types.ObjectId,
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
        required:true,
        default:'intermediate'
    },
    duration:{
        type:String,
        required:true,
        default:'1-3 months'
    },
    projectType:{
        type:String,
        enum:['one_time','ongoing','hourly'],
        required:true,
        default:'one_time'
    },
    proposals:[{
        type:String,
        ref:'Proposal'
    }],
    hiredFreelancer:{
        type:String,
        ref:'User'
    },
    projectId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Project'
    },
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
        required:true,
        default:()=>new Date(Date.now()+30*24*60*1000)
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
    return this.status === 'active' && this.hiringStatus === 'accepting_proposals'
     && this.deadline >new Date();
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

jobSchema.methods.hiredFreelancerAndCreateProject = async function(freelancerId){
    const Project = mongoose.model('Project');

    // create project for execution phase
    const project = new Project({
        jobId:this._id,
        clientId:this.clientId,
        freelancerId:freelancerId,
        title:this.title,
        description:this.description,
        budget:this.budget,
        currency:this.currency,
        category:this.category,
        serviceCategory:this.serviceCategory,
        skillsRequired:this.skillsRequired,
        timeline:{
            startDate: new Date(),
            deadline:this.deadline
        }
    });
    await project.save()

    // update job

    this.hiredFreelancer = freelancerId;
    this.hiringStatus = 'closed';
    this.projectId = project._id;

    await this.save()
    return project;
}

jobSchema.methods.hasHiredFreelancer = function(){
    return !!this.hiredFreelancer
}

jobSchema.methods.getHiredFreelancerInfo = function() {
    return {
        freelancerId: this.hiredFreelancer,
        isHired: !!this.hiredFreelancer,
        projectId: this.projectId
    };
}

const Job = mongoose.model('Job',jobSchema);

module.exports= Job

