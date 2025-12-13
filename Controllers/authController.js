const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User= require('../Models/User')


// User Registration (Client/Freelancer Only)
exports.register = async (req, res) => {
    try {
        const { email, password, name, role = 'client', workEmail } = req.body;

        // Basic validation
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Only allow client/freelancer roles
        if (!['client', 'freelancer'].includes(role)) {
            return res.status(400).json({ error: "Invalid role selection" });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password and create user - MOVED THIS BEFORE userData
        const hashedPassword = await bcrypt.hash(password, 12);

        const userData = {
            email,
            password: hashedPassword,
            role,
            profile: {
                name,
                ...(workEmail && { workEmail })
            }
        };

        const user = new User(userData);
        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            user: {
                id: user._id,
                email:user.email,
                role:user.role,
                name:user.profile.name
            },
            token
        });

    } catch (error) {
        console.error("User registration error:", error);
        res.status(500).json({
            success: false,
            error: "Registration failed"
        });
    }
};

// Regular Login(Client/Freelancer)

exports.login = async(req,res)=>{
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

        // ⭐️⭐️⭐️ TEMPORARILY REMOVE THIS BLOCK ⭐️⭐️⭐️
        // if(user.role=== "admin"){
        //     return res.status(401).json({error:'Please use admin login'})
        // }
        
        const isMatch= await bcrypt.compare(password,user.password)
        if(!isMatch){
            return res.status(401).json({error:"Invalid credentials"})
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
                name:user.profile?.name,
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
};
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
            userId:user._id,
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



// Admin Register Only
exports.adminRegister = async (req, res) => {
    try {
        const { email, password, name, secretKey } = req.body;
        
        // Verify admin secret key
        if (secretKey !== process.env.ADMIN_SECRET_KEY) {
            console.log("❌ SECRET KEY MISMATCH DETECTED!");
            return res.status(401).json({ 
                error: "Unauthorized admin registration",
                debug: {
                    received: secretKey,
                    expected: process.env.ADMIN_SECRET_KEY,
                    receivedLength: secretKey?.length,
                    expectedLength: process.env.ADMIN_SECRET_KEY?.length
                }
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({
            email,
            password: hashedPassword,
            role: "admin",
            profile: { name }
        });

        await user.save();

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            user: {
                id: user._id,
                email,
                role: 'admin',
                name
            },
            token
        });

        console.log("✅ Secret key matched! Proceeding with admin registration...");
        
    } catch (error) {
        console.error("Admin registration error:", error);
        res.status(500).json({
            success: false,
            error: "Admin registration failed"
        });
    }
};

       
// Get current user
exports.getProfile= async(req,res)=>{
    try{
        const user=await User.findById(req.userId).select('-password')
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
        message:"Log out successfully"
    })
}



exports.getAdminProfile = async (req, res) => {
    try {
        const admin = await User.findById(req.userId).select('-password');
        
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        if (admin.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                profile: admin.profile,
                createdAt: admin.createdAt,
                updatedAt: admin.updatedAt
            }
        });

    } catch (error) {
        console.error('Get admin profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

