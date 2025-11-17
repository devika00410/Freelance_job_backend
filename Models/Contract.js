const mongoose = require('mongoose');

const phaseSchema = new mongoose.Schema({
    phase:{
        type:Number,
        required:true,
        min:1
    },
    title:{
        type:String,
        required:true,
        trim:true
    },
    amount:{
        type:Number,
        required:true,
        min:0
    },
    status:{
        type:String,
        enum:['pending','in-progress','completed','approved','paid'],
        default:'pending'
    },
    completedDate:{
        type:Date,
        default:null
    }
});

const contractSchema = new mongoose.Schema({
    contractId:{
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
    title:{
        type:String,
        required:true,
        trim:true
    },
    terms:{
        type:String,
        required:true,
        trim:true
    },
    totalBudget:{
        type:Number,
        required:true,
        trim:true
    },
    timeline:{
        type:String,
        required:true,
        trim:true
    },
    milestonStructure:{
        type:String,
        required:true,
        trim:true
    },
    phases:[phaseSchema],
    status:{
        type:String,
        enum:['draft','pending','signed','active','completed','cancelled','disputed'],
        default:'draft'
    },
    clientSigned:{
        type:Boolean,
        default:false
    },
    freelancerSigned:{
        type:Boolean,
        default:false
    },
    startDate:{
        type:Date,
        required:true
    },
    endDate:{
        type:Date,
        default:null
    },
    completionDate:{
        type:Date,
        default:null
    },clientSignedAt:{
        type:Date,
        default:null
    },
    freelancerSignedAt:{
        type:Date,
        default:null
    },
    createdAt:{
        type:Date,
        default:Date.now
    },
    updatedAt:{
        type:Date,
        default:Date.now
    }

});


// update the updated field before saving

contractSchema.pre('save',function(next){
    this.updatedAt=Date.now();
    next()
})

// virtual for calculating total paid amount
contractSchema.virtual('totalPaid').get(function(){
    return this.phases.filter(phase=>phase.status === 'paid')
    .reduce((total,phase)=>total+phase.amount,0)
})


// to get current phase
contractSchema.methods.getCurrentPhase = function(){
    return this.phases.find(phase=>
    ['pending','in-progress'].includes(phase.status)
    ) || this.phases[this.phases.length - 1]
};

// static method to find contracts by client
contractSchema.statics.findByClient=function(clientId){
    return this.find({clientId})
};

// static method to find contracts by freelancer
contractSchema.statics.findByFreelancer=function(freelancerId){
    return this.find({freelancerId})
};

const Contract = mongoose.model('Contract',contractSchema);

module.exports = Contract

