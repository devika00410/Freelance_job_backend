const mongoose =require('mongoose')

// message schema
const messageSchema= new mongoose.Schema({
    chatroomId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'ChatRoom',
        required:true
    },
    senderId:{
        type:String,
        required:true,
        ref:'User'
    },
    senderRole:{
        type:String,
        enum:['client','freelancer'],
        required:true
    },
    content:{
        type:String,
        required:true
    },
    messageType:{
        type:String,
        enum:['text','file','image','system'],
        default:'text'
    },
    readBy:[{
        userId:String,
        readAt:{type:Date, default:Date.now}
    }]
},{
    timestamps:true
});

const chatRoomSchema = new mongoose.Schema({
    projectId:{
        type:String,
        required:true,
        ref:'Project'
    },
    clientId:{
        type:String,
        required:true,
        ref:'User'
    },
    freelancerId:{
        type:String,
        required:true,
        ref:'User'
    },
    lastMessage:{
        type:String
    },
    lastMessageAt:{
        type:Date
    },
    unreadCounts:{
        client:{type:Number, default:0},
        freelancer:{type:Number,default:0}
    }
},{
    timestamps:true
});


// userSchema

const userSchema = new mongoose.Schema({
    _id:{
        type:String,
        required:true
    },
    username:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    role:{
        type:String,
        enum:['client','freelancer'],
        required:true
    },
    avatar:String,
    isOnline:{type:Boolean,default:false},
    lastSeen:{type:Date, default:Date.now}
},{
    timestamps:true
});

// Project schema

const projectSchema = new mongoose.Schema({
    _id:{
        type:String,
        required:true
    },
    name:{
        type:String,
        required:true
    },
    description:String,
    clientId:{type:String, ref:'User'},
    freelancerId:{type:String, ref:'User'},
    status:{
        type:String,
        enum:['active','completed','archived'],
        default:'active'
    }
},{
    timestamps:true
})