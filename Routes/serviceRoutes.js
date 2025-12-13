const express = require('express');
const router = express.Router();
const serviceController = require('../Controllers/serviceController');

// Public routes
router.get('/', serviceController.getAllServices);
router.get('/popular', serviceController.getPopularServices);
router.get('/:id', serviceController.getServiceById);
router.get('/:id/freelancers', serviceController.getFreelancersByService);
router.patch('/:id/view', serviceController.incrementServicePopularity);

// Search route (could also be in separate searchRoutes.js)
router.get('/search/freelancers', serviceController.searchFreelancers);

module.exports = router;