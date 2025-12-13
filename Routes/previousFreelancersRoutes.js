const express = require('express');
const router = express.Router();
const { getPreviousFreelancers } = require('../Controllers/previousFreelancersController');
const { authenticate,authorizeClient } = require('../Middlewares/authMiddleware');

router.get('/', authenticate,authorizeClient, getPreviousFreelancers);

module.exports = router;