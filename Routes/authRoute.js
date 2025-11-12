const express=require('express')
const{register,login,adminLogin,adminRegister,getProfile,logout}= require('../Controllers/authController')

const {protect}=require('../Middlewares/authMiddleware')

const router= express.Router()

// Public routes
router.post('/register',register)
router.post('/login',login)

// Admin only routes(separate)
router.post('/admin/login',adminLogin)
router.post('/admin/register',adminRegister)

// Protected routes
router.get('/profile',protect,getProfile);
router.post('/logout',logout)

module.exports = router