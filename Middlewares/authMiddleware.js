
const jwt = require('jsonwebtoken')
const User = require('../Models/User')

const authMiddleware = async(req, res, next) => {
    try {
        console.log('🔐 === AUTH MIDDLEWARE START ===');
        console.log('🔐 JWT_SECRET exists:', !!process.env.JWT_SECRET);
        console.log('🔐 JWT_SECRET value:', process.env.JWT_SECRET ? '***' + process.env.JWT_SECRET.slice(-5) : 'NOT SET');
        
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
            console.log('🔐 Token received:', token ? `${token.substring(0, 20)}...` : 'No token');
        } else {
            console.log('🔐 No Authorization header found');
            console.log('🔐 Headers:', req.headers);
        }
        
        if (!token) {
            console.log('🔐 No token found');
            return res.status(401).json({ error: "Not authorized, no token" })
        }
        
        console.log('🔐 Verifying token...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔐 Token decoded successfully:', decoded);
        
        const userId = decoded.userId;
        console.log('🔐 User ID from token:', userId);
        
        if (!userId) {
            console.log('🔐 No userId in token');
            return res.status(401).json({ error: "Invalid token format - no userId" })
        }
        
        console.log('🔐 Finding user in database...');
        const user = await User.findById(userId).select('-password')
        
        if (!user) {
            console.log('🔐 User not found in database for ID:', userId);
            return res.status(401).json({ error: "User not found" })
        }
        
        console.log('🔐 User found:', {
            id: user._id,
            email: user.email,
            role: user.role
        });
        
        // Set user data
        req.user = user;
        req.userId = user._id;
        req.userRole = user.role;
        
        console.log('🔐 === AUTH MIDDLEWARE SUCCESS ===');
        next()
        
    } catch (error) {
        console.error('❌ === AUTH MIDDLEWARE ERROR ===');
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Full error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            console.log('❌ JWT Error - Invalid token signature');
            return res.status(401).json({ error: "Invalid token" })
        } else if (error.name === 'TokenExpiredError') {
            console.log('❌ JWT Error - Token expired');
            return res.status(401).json({ error: "Token expired" })
        } else {
            console.log('❌ Unknown authentication error');
            return res.status(500).json({ error: "Authentication failed: " + error.message })
        }
    }
}
        


// Add this function to your existing auth middleware
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.userRole} is not authorized to access this route`
            });
        }
        next();
    };
};




authMiddleware.requiredAdmin = async(req,res,next)=>{
    try{
        if(req.userRole !== 'admin'){
            return res.status(403).json({error:"Admin access required"})
        }
        next()
    }
    catch(error){
        res.status(403).json({error:"Admin authorized failed"})
    }
};


// Add these functions at the end of your authMiddleware.js file:

const authorizeClient = (req, res, next) => {
    if (req.userRole !== 'client') {
        return res.status(403).json({
            success: false,
            message: 'Client access required'
        });
    }
    next();
};

const authorizeFreelancer = (req, res, next) => {
    if (req.userRole !== 'freelancer') {
        return res.status(403).json({
            success: false,
            message: 'Freelancer access required'
        });
    }
    next();
};

module.exports = {
    authenticate: authMiddleware,
    authorize,
    authorizeClient,     
    authorizeFreelancer   
};

