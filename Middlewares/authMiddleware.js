
const jwt = require('jsonwebtoken')
const User = require('../Models/User')

const authMiddleware = async(req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1]
        }
        
        if (!token) {
            return res.status(401).json({ error: "Not authorized, no token" })
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findById(decoded.userId).select('-password')
        
        if (!user) {
            return res.status(401).json({ error: "User not found" })
        }
        
        // ✅ Check if account is active (uncomment and modify if you have this field)
        // if (user.status && user.status !== 'active') {
        //     return res.status(401).json({ error: "Account deactivated" })
        // }
        
        req.userId = user._id;
        req.userRole = user.role
        next()
        
    } catch (error) {
        console.error("Auth middleware error:", error)
        
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: "Invalid token" })
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Token expired" })
        } else {
            return res.status(500).json({ error: "Authentication failed" })
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

