const Service = require('../Models/Service');
const User = require('../Models/User');


exports.getAllServices = async (req, res) => {
    try {
        const services = await Service.find({ status: 'active' })
            .sort({ popularity: -1 })
            .select('-createdBy -__v');
        
        res.status(200).json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching services'
        });
    }
};


exports.getServiceById = async (req, res) => {
    try {
        const service = await Service.findOne({ 
            _id: req.params.id, 
            status: 'active' 
        }).select('-createdBy -__v');
        
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: service
        });
    } catch (error) {
        console.error('Get service error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching service'
        });
    }
};

// @desc    Get freelancers by service
// @route   GET /api/services/:id/freelancers
// @access  Public
exports.getFreelancersByService = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            page = 1, 
            limit = 10, 
            experienceLevel,
            minRate,
            maxRate,
            availability,
            verified,
            sortBy = 'popularity'
        } = req.query;
        
        // Validate service exists
        const service = await Service.findOne({ 
            _id: id, 
            status: 'active' 
        });
        
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }
        
        // Build filter for users
        const filter = {
            role: 'freelancer',
            services: id,
            'verification.status': 'verified' // Default to verified freelancers only
        };
        
        // Apply additional filters
        if (experienceLevel) {
            filter.experienceLevel = experienceLevel;
        }
        
        if (availability) {
            filter['profile.availability'] = availability;
        }
        
        if (verified === 'false' || verified === '0') {
            delete filter['verification.status']; // Include unverified if requested
        }
        
        // Rate filtering
        const rateFilter = {};
        if (minRate) {
            rateFilter['profile.hourlyRate'] = { $gte: Number(minRate) };
        }
        if (maxRate) {
            rateFilter['profile.hourlyRate'] = { ...rateFilter['profile.hourlyRate'], $lte: Number(maxRate) };
        }
        if (Object.keys(rateFilter).length > 0) {
            filter['$and'] = [rateFilter];
        }
        
        // Calculate pagination
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        
        // Build sort
        let sort = {};
        switch(sortBy) {
            case 'rating':
                sort = { 'freelancerStats.avgRating': -1 };
                break;
            case 'rate-low':
                sort = { 'profile.hourlyRate': 1 };
                break;
            case 'rate-high':
                sort = { 'profile.hourlyRate': -1 };
                break;
            case 'projects':
                sort = { 'freelancerStats.completedProjects': -1 };
                break;
            case 'popularity':
            default:
                sort = { 'freelancerStats.successRate': -1 };
        }
        
        // Execute query with pagination
        const freelancers = await User.find(filter)
            .select('-password -emailOTP -phoneOTP -settings -adminPermission -adminStats -clientStats -__v')
            .sort(sort)
            .limit(limit)
            .skip(startIndex);
        
        // Get total count
        const total = await User.countDocuments(filter);
        
        // Pagination result
        const pagination = {};
        
        if (endIndex < total) {
            pagination.next = {
                page: page + 1,
                limit
            };
        }
        
        if (startIndex > 0) {
            pagination.prev = {
                page: page - 1,
                limit
            };
        }
        
        res.status(200).json({
            success: true,
            count: freelancers.length,
            pagination: {
                ...pagination,
                total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page)
            },
            service: {
                id: service._id,
                name: service.name,
                description: service.description,
                hourlyRange: service.pricing.hourlyRange
            },
            data: freelancers
        });
    } catch (error) {
        console.error('Get freelancers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching freelancers'
        });
    }
};

// @desc    Search freelancers across all services
// @route   GET /api/freelancers/search
// @access  Public
exports.searchFreelancers = async (req, res) => {
    try {
        const { 
            service,
            skills,
            location,
            page = 1, 
            limit = 10 
        } = req.query;
        
        // Build filter
        const filter = {
            role: 'freelancer',
            'verification.status': 'verified'
        };
        
        // Service filter
        if (service) {
            filter.services = service;
        }
        
        // Skills filter (case-insensitive partial match)
        if (skills) {
            const skillsArray = skills.split(',').map(skill => skill.trim());
            filter.skills = { $in: skillsArray.map(skill => new RegExp(skill, 'i')) };
        }
        
        // Location filter (case-insensitive partial match)
        if (location) {
            filter['profile.location'] = new RegExp(location, 'i');
        }
        
        // Calculate pagination
        const startIndex = (page - 1) * limit;
        
        // Execute query
        const freelancers = await User.find(filter)
            .select('profile.name profile.title profile.avatar profile.hourlyRate profile.location skills services experienceLevel freelancerStats.avgRating freelancerStats.completedProjects')
            .sort({ 'freelancerStats.avgRating': -1 })
            .limit(limit)
            .skip(startIndex);
        
        // Get total count
        const total = await User.countDocuments(filter);
        
        res.status(200).json({
            success: true,
            count: freelancers.length,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page)
            },
            data: freelancers
        });
    } catch (error) {
        console.error('Search freelancers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error searching freelancers'
        });
    }
};

// @desc    Get popular services
// @route   GET /api/services/popular
// @access  Public
exports.getPopularServices = async (req, res) => {
    try {
        const services = await Service.find({ status: 'active' })
            .sort({ popularity: -1 })
            .limit(6)
            .select('_id name description icon pricing.hourlyRange metrics.clientSatisfaction');
        
        res.status(200).json({
            success: true,
            data: services
        });
    } catch (error) {
        console.error('Get popular services error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching popular services'
        });
    }
};

// @desc    Update service popularity (call when service is viewed)
// @route   PATCH /api/services/:id/view
// @access  Public
exports.incrementServicePopularity = async (req, res) => {
    try {
        const service = await Service.findByIdAndUpdate(
            req.params.id,
            { $inc: { popularity: 1 } },
            { new: true }
        );
        
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: service.popularity
        });
    } catch (error) {
        console.error('Update popularity error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating service popularity'
        });
    }
};