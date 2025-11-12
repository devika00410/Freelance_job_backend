const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User= require('../Models/Users')

// Client/ Freelancer registeration

exports.register= async(req,res)=>{
    try{
        const{email,password,name,role='client'} =req.body

        // Validate input
        if(!email || !password || !name){
            return res.status(400).json({error:'All fields are required'})
        }

        // Only allow client/freelancer roles
if(!['client','freelancer'].includes(role)){
    return res.status(400).json({error:"Invalid role selection"})
}

// Email validation
const emailRegex= /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
if(!emailRegex.test(email)){
    return res.status(400).json({error:"Invalid email format"})
}

// Password strength
if(password.length<6){
    return res.status(400).json({error:'Password must be atleast 6 characters'})
}
// Check if user exists
const existingUser=await User.findOne({email})
if(existingUser){
    return res.status(409).json({error:'User already exists'})
}

// Hash password and create user
const hashedPassword= await bacrypt.hash(password, 12)
const user= new User({
    email,password:hashedPassword,
    role,
    profile:{name}
})
await user.save()

// Generate token (expires in 7 days)

const token= jwt.sign(
    {userId:user._id},
    process.env.JWT_SECRET,
    {expiresIn:'7d'}
);
res.status(201).json({
    success:true,
    user:{
        id: user._id,email,role,name,profile:user.profile
    }, token
})
    } catch(error){
        console.log("Registration error:",error);
        res.status(500).json({
            success:false,
            error:"Regsitration failed.Please try again"
        })
    }
}

// Regular Login(Client/Freelancer)

exports.login =async(req,res)=>{
    try{
        const{email,password}=req.body

        // Validate input
        if(!email || !password){
            return res.status(400).json({error:"Email and password are required"})
        }

        const user= await User.findOne({email});
        if(!user){
            return res.status(401).json({error:"Invalid credentials"})
        }

        // Prevents admin login through regular endpoints
        if(user.role=== "admin"){
            return res.status(401).json({error:'Please useadmin login'})
        }
        const isMatch= await bcrypt.compare(password,user.password)
        if(!isMatch){
            return res.status(401).json({error:"Invalid  credentials"})
        }
        // Update last login
        user.lastLogin = new Date();
        await user.save()

        const token= jwt.sign(
            {userId:user._id},
            process.env.JWT_SECRET,
            {expiresIn:'7d'}
        )
        res.json({
            success:true,
            user:{
                id:user._id,
                email:user.email,
                role:user.role,
                name:user.profile.name,
                profile:user.profile
            },
            token
        })
    }
    catch(error){
        console.error('Login error:',error)
        res.status(500).json({
            success:false,
            error:"Login failed.Please try again"
        })
    }
}
// Admin login(Strictly for admin role only)

exports.adminLogin= async(req,res)=>{
    try{
        const{email,password}=req.body;
    if(!email || !password){
        return res.status(400).json({error:"Email and password required"})
    }
    // Only allow admin role only
    const user= await User.findOne({email,role:"admin"})
    if(!user){
        return res.status(400).json({error:"Admin access only"})
    }
    const isMatch = await bcrypt.compare(password,user.password)
    if(!isMatch){
        return res.status(401).json({error:"Invalid credentials"})
    }
    // Update last login
    user.lastLogin=new Date()
    await user.save()

    // Admin token with longer expiry
    const token=jwt.sign(
        {
            userId:user_id,
            role:"admin"
        },
        process.env.JWT_SECRET,{expiresIn:'30d'}
    )
    res.json({
        success:true,user:{
            id:user._id,
            email:user.email,
            role:user.role,
            name:user.profile.name,
            profile:user.profile
        },token
    })
    }
    catch(error){
        console.error("Admin login error")
        res.status(500).json({
            success:false,
            error:"Admin login failed"
        })
    }
}

// Admin Register
exports.adminRegister=async(req,res)=>{
    try{
        const{email,password,name,secretKey}=req.body
        if(!email || !password || !name || !secretKey){
            return res.status(400).json({error:"All fields are required"})
        }

        if(secretKey !== process.env.ADMIN_SECRET_KEY){
            console.warn("Unauthorized admin registration attempt from :",req.ip)
            return res.status(401).json({error:"Unauthorized admin registration"})
        }
        const existingAdmin= await User.findOne({role:"admin"})
        if(existingAdmin && process.env.ALLOW_MULTIPLE_ADMINS !== 'true'){
            return res.status(409).json({error:"Admin already exists"})
        }
        const existingUser= await User.findOne({email})
        if(existingUser){
            return res.status(409).json({error:"User already exists"})
        }
        // Stronger password for admin
        if(password.length<8){
            return res.status(400).json({error:"Admin password must be atleast 8 characters"})
        }
        const hashedPassword=await bcrypt.hash(password,12)
        const user= new User({
            email,password:hashedPassword,
            role:"admin",
            profle:{
                name,
                isVerified:true
            },
            isActive:true
        })
        await user.save()
        console.log("New admin registered:",email)

          const token=jwt.sign({
        userId:user._id,
        role:"admin"
    },
    process.env.JWT_SECRET,
    {expiresIn:'30d'}
)
res.status(201).json({
    success:true,
    user:{
        id:user._id,
        email,role:'admin',
        name,
        profile:user.profile
    },token
})
    } catch(error){
        console.error("Admin registration error:", error)
        res.status(500).json({
            success:false,
            error:"Admin registered failed"
        })
    }
  
}

// Get current user
exports.getProfile= async(req,res)=>{
    try{
        const user=await User.findById(req.user.Id).select('-password')
        if(!user){
            return res.status(404).json({error:"User not found"})
        }
        res.json({
            success:true,
            user:{
                id:user._id,
                email:user.email,
                role:user.role,
                name:user.profile.name,
                profile:user.profile
            }
        })
    }
    catch(error){
        console.error("Get user error:",error)
        res.status(500).json({
            success:false,
            error:"Failed to get user data"
        })
    }
}

// Logout
exports.logout =(req,res)=>{
    res.json({
        success:true,
        message:"Logges out successfully"
    })
}