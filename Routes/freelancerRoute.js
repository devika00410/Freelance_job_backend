const express = require('express');
const router =express.Router();
const freelancerController=require('../Controllers/freelancerController');
const authMiddleware = require('../Middlewares/authMiddleware')
const roleAuth = require('../Middlewares/roleAuth')

router.use(authMiddleware)

router.get('/dashboard')