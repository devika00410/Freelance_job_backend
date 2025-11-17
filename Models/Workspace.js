const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema({
    startDate:{
        type:Date,
        required:true
    },
    estimatedEndDate:{
        type:Date,
        required:true
    },
    daysRemaining:{
        type:Number,
        required:true,
        min:0
    },
    actualEndtDate:{
        type:Date,
        default:null
    },
    extensions:[{
        reason:String,
        additionalDays:Number,
        extendedDate:Date,
        requestedBy:String, 
        approved:{
            type:Boolean,
            default:false
        },
        requestedAt:{
            type:Date,
            default:Date.now
        }
    }]

});

const componentsSchema = new mongoose.Schema({
    chatroom:{
        type:String,
        required:true,
        trim:true
    },
    milestones:{
        type:String,
        required:true,
        trim:true
    },
    payments:{
        type:String,
        required:true,
        trim:true
    },
    files:{
        type:String,
        required:true,
        trim:true
    },
    tasks:{
        type:String,
        trim:true,
        default:null
    },
    meetings:{
        type:String,
        trim:true,
        default:null
    }
});

const workspaceSchema = new mongoose.Schema({
    workspaceId:{
        type:String,
        required:true,
        unique:true,
        trim:true
    },
    projectId:{
        type:String,
        required:true,
        trim:true
    },
    projectTitle:{
        type:String,
        required:true,
        trim:true
    },
    clientId:{
        type:String,
        required:true,
        trim:true
    },
    freelancerId:{
        type:String,
        required:true,
        trim:true
    },
    serviceType:{
        type:String,
        required:true,
        trim:true
    },
    status:{
        type:String,
        enum:['active','completed','paused','cancelled','disputed','on-hold'],
        default:'active'
    },
    currentPhase:{
        type:Number,
        required:true,
        min:1,
        default:1
    },
    overallProgress:{
        type:Number,
        required:true,
        min:0,
        max:100,
        default:0
    },
    timeline:timelineSchema,
    components:componentsSchema,
    unreadMessages:{
        client:{
            type:Number,
            default:0,
            min:0
        },
        freelancer:{
            type:Number,
            default:0,
            min:0
        },
        total:{
            type:Number,
            default:0,
            min:0
        }
    },
    pendingApprovals:{
        type:Number,
        default:0,
        min:0
    },
    pendingTasks:{
        type:Number,
        default:0,
        min:0
    },
    recentActivity:[{
        type:{
            type:String,
            enum:['message','milestone','payment','file','approval','phase_change'],
            required:true
        },
        descriptiom:String,
        initiatedBy:String,
        timestamp:{
            type:Date,
            default:Date.now
        },
        metadata: mongoose.Schema.Types.Mixed
    }],
    settings:{
        notifications:{
            email:{
                type:Boolean,
                default:true
            },
            push:{
                type:Boolean,
                default:true
            },
            desktop:{
                type:Boolean,
                default:true
            }
           
        },
         autoExtend:{
                type:Boolean,
                default:false
            },
            weeklyReports:{
                type:Boolean,
                default:true
            }
    },
    createdAt:{
        type:Date,
        default:Date.noe
    },
    updatedAt:{
        type:Date,
        default:Date.now
    },
    lastActivityAt:{
        type:Date,
        default:Date.now
    }
});

workspaceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  if(this.unreadMessages && (this.isModified('unreadMessages.client') || this.isModified('unreadMessages.freelancer'))){
    this.unreadMessages.total = (this.unreadMessages.client || 0) + (this.unreadMessages.freelancer || 0)
  }

  next()

})

workspaceSchema.virtual('isActive').get(function(){
    return this.status === 'active';
});

// virtual for calculating timeline progress

workspaceSchema.virtual('timelineProgress').get(function() {
  const totalDays = Math.ceil((this.timeline.estimatedEndDate - this.timeline.startDate) / (1000 * 60 * 60 * 24));
  const daysPassed = Math.ceil((new Date() - this.timeline.startDate) / (1000 * 60 * 60 * 24));
  return Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
});

// virtual for overdue status

workspaceSchema.virtual('isOverdue').get(function() {
  return new Date() > this.timeline.estimatedEndDate && this.status === 'active';
});

// method to add recent activity
workspaceSchema.methods.addActivity = function(activity) {
  this.recentActivity.unshift(activity);
  
  // keep only last 50 activities
  if (this.recentActivity.length > 50) {
    this.recentActivity = this.recentActivity.slice(0, 50);
  }
  
  this.lastActivityAt = new Date();
  return this.save();
};

// method to update progress
workspaceSchema.methods.updateProgress = function(newProgress, newPhase = null) {
  this.overallProgress = Math.max(0, Math.min(100, newProgress));

   if (newPhase !== null) {
    this.currentPhase = newPhase;
  }
  
  this.lastActivityAt = new Date();
  return this.save();
};

// static method to find workspaces by client
workspaceSchema.statics.findByClient = function(clientId) {
  return this.find({ clientId });
};

// static method to find workspaces by freelancer
workspaceSchema.statics.findByFreelancer = function(freelancerId) {
  return this.find({ freelancerId });
};

// static method to find active workspaces
workspaceSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};


workspaceSchema.index({ clientId: 1, status: 1 });
workspaceSchema.index({ freelancerId: 1, status: 1 });
workspaceSchema.index({ projectId: 1 });
workspaceSchema.index({ lastActivityAt: -1 });

const Workspace = mongoose.model('Workspace', workspaceSchema);

module.exports = Workspace;