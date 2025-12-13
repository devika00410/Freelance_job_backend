const express=require('express')
const{register,login,adminLogin,adminRegister,getProfile,logout,getAdminProfile}= require('../Controllers/authController')

const {authenticate,authorize} =require('../Middlewares/authMiddleware')

const router= express.Router()

// Public routes
router.post('/register',register)
router.post('/login',login)
// router.get('/client/profile', authenticate, getProfile);
// router.get('/freelancer/profile', authenticate, getProfile);

// Admin only routes(separate)
router.post('/admin/login',adminLogin)
router.post('/admin/register',adminRegister)
router.get('/admin/profile', authenticate, authorize('admin'), getAdminProfile);

// Protected routes
router.get('/profile',authenticate,getProfile);
router.post('/logout',logout)

module.exports = router