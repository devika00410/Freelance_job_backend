const jwt = require('jsonwebtoken')
const User= require('../Models/User')


const authMiddleware = async(req,res,next)=>{

    try{
    let token;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token=req.headers.authorization.split(' ')[1]

    }
    if(!token){
        return res.status(401).json({error:"Not authorized,no token"})
    }
    const decoded = jwt.verify(token,process.env.JWT_SECRET)
  const user = await User.findById(decoded.userId).select('-password')
  if(!user){
    return res.status(401).json({error:"User not found"})
  }
//   if(!user.isActive){
//     return res.status(401).json({error:"Not authorized,token failed"})
//   }
  req.userId=user._id;
  req.userRole = user.role
  next()
} catch(error){
    console.error("Auth middleware error",error)
    res.status(401).json({error:"Account deactivated"})
}
}

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
}

module.exports=authMiddleware;
