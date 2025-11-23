// Use a different approach that avoids the router conflict
const express = require('express');

// Create application instance for routes
const app = express();

// Create routes directly on a mini-app
const clientAnalyticsApp = express();

const clientAnalyticsController = require('../Controllers/clientAnalyticsController');
const { authenticate, authorizeClient } = require('../Middlewares/authMiddleware');

// Apply middleware
clientAnalyticsApp.use(authenticate);
clientAnalyticsApp.use(authorizeClient);

// Define routes
clientAnalyticsApp.get('/overview', clientAnalyticsController.getClientOverview);
clientAnalyticsApp.get('/job-trends', clientAnalyticsController.getJobTrends);
clientAnalyticsApp.get('/financial', clientAnalyticsController.getFinancialAnalytics);
clientAnalyticsApp.get('/proposal-stats', clientAnalyticsController.getProposalAnalytics);
clientAnalyticsApp.get('/project-performance', clientAnalyticsController.getProjectPerformance);

module.exports = clientAnalyticsApp;