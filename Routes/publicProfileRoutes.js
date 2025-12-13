const express = require('express');
const router = express.Router();
const User = require('../Models/User');

// Get public profile by username or ID
router.get('/profile/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Find user by ID or email 
    const user = await User.findOne({
      $or: [
        { _id: identifier },
        { email: identifier },
        { 'profile.name': { $regex: identifier, $options: 'i' } }
      ],
      role: 'freelancer'
    }).select('-password -emailOTP -phoneOTP -settings -adminPermission -adminStats -securityLevel');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Only return public information
    const publicProfile = {
      ...user.toObject(),
      email: user.settings?.privacy === 'public' ? user.email : undefined
    };

    res.json({
      success: true,
      profile: publicProfile
    });

  } catch (error) {
    console.error('Public profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile'
    });
  }
});

// Search freelancers
router.get('/search', async (req, res) => {
  try {
    const { q, skills, page = 1, limit = 10 } = req.query;
    
    let query = { role: 'freelancer' };
    
    // Search by name or skills
    if (q) {
      query.$or = [
        { 'profile.name': { $regex: q, $options: 'i' } },
        { 'profile.title': { $regex: q, $options: 'i' } },
        { skills: { $in: [new RegExp(q, 'i')] } }
      ];
    }
    
    // Filter by skills
    if (skills) {
      query.skills = { $in: skills.split(',') };
    }

    const freelancers = await User.find(query)
      .select('profile.name profile.title profile.avatar profile.location profile.hourlyRate skills freelancerStats verification')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ 'freelancerStats.avgRating': -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      freelancers,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error searching profiles'
    });
  }
});

module.exports = router;