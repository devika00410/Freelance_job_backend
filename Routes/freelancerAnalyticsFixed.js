const express = require('express');
const freelancerAnalyticsApp = express();
const freelancerAnalyticsController = require('../Controllers/freelanceAnalyticsController');
const { authenticate, authorizeFreelancer } = require('../Middlewares/authMiddleware');

freelancerAnalyticsApp.use(authenticate);
freelancerAnalyticsApp.use(authorizeFreelancer);

freelancerAnalyticsApp.get('/overview', freelancerAnalyticsController.getFreelancerOverview);
freelancerAnalyticsApp.get('/earnings', freelancerAnalyticsController.getEarningsAnalytics);
freelancerAnalyticsApp.get('/performance', freelancerAnalyticsController.getPerformanceStats);
freelancerAnalyticsApp.get('/project-stats', freelancerAnalyticsController.getProjectStats);

module.exports = freelancerAnalyticsApp;