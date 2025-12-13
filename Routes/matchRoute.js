// Routes/matchRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../Models/User');
const { authenticate } = require('../Middlewares/authMiddleware');

// Match freelancers based on criteria
router.post('/match-freelancers', authenticate, async (req, res) => {
  try {
    const { service, timeline, budget, experience } = req.body;
    
    // Validate required fields
    if (!service || !timeline || !budget || !experience) {
      return res.status(400).json({
        success: false,
        error: 'All selection criteria are required'
      });
    }

    // Build query to find freelancers
    const query = {
      role: 'freelancer',
      'verification.status': 'verified', // Only verified freelancers
      'interviewStatus': 'approved' // Only approved freelancers
    };

    // Add service filter
    query.services = service;

    // Add experience level filter
    if (experience === 'entry') {
      query['freelancerStats.completedProjects'] = { $lte: 50 };
    } else if (experience === 'mid') {
      query['freelancerStats.completedProjects'] = { $gt: 50, $lte: 200 };
    } else if (experience === 'expert') {
      query['freelancerStats.completedProjects'] = { $gt: 200 };
    }

    // Find freelancers matching the criteria
    const freelancers = await User.find(query)
      .select('profile.name profile.title profile.avatar skills services freelancerStats hourlyRate availability verification interviewStatus')
      .limit(10) 
      .lean();

    // Calculate match scores and format response
    const matchedFreelancers = freelancers.map(freelancer => {
      const matchScore = calculateMatchScore(freelancer, { service, timeline, budget, experience });
      
      return {
        id: freelancer._id,
        name: freelancer.profile.name,
        title: freelancer.profile.title || 'Freelancer',
        initials: getInitials(freelancer.profile.name),
        rating: freelancer.freelancerStats?.avgRating || 4.5,
        completedProjects: freelancer.freelancerStats?.completedProjects || 0,
        successRate: freelancer.freelancerStats?.successRate || 85,
        hourlyRate: freelancer.hourlyRate || calculateHourlyRate(budget, experience),
        skills: freelancer.skills || [],
        experience: getExperienceLevel(freelancer.freelancerStats?.completedProjects),
        service: freelancer.services?.[0] || service,
        matchScore: matchScore,
        responseTime: getResponseTime(freelancer.availability),
        description: freelancer.profile.bio || `Experienced ${service} professional`,
        verified: freelancer.verification?.status === 'verified'
      };
    });

    // Sort by match score (highest first)
    matchedFreelancers.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      freelancers: matchedFreelancers,
      totalMatches: matchedFreelancers.length,
      criteria: { service, timeline, budget, experience }
    });

  } catch (error) {
    console.error('Match freelancers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find matches',
      message: error.message
    });
  }
});

// Helper function to calculate match score
function calculateMatchScore(freelancer, criteria) {
  let score = 0;

  // Service match (most important - 40 points)
  if (freelancer.services.includes(criteria.service)) {
    score += 40;
  }

  // Experience level match (30 points)
  const freelancerExp = getExperienceLevel(freelancer.freelancerStats?.completedProjects);
  if (freelancerExp === criteria.experience) {
    score += 30;
  } else if (
    (criteria.experience === 'mid' && freelancerExp === 'expert') ||
    (criteria.experience === 'entry' && freelancerExp === 'mid')
  ) {
    score += 20; // Higher experience is acceptable
  }

  // Rating based (20 points)
  const rating = freelancer.freelancerStats?.avgRating || 4.0;
  score += (rating - 3.5) * 8; // 4.0 = 4 points, 4.5 = 8 points, 5.0 = 12 points

  // Success rate based (10 points)
  const successRate = freelancer.freelancerStats?.successRate || 80;
  score += Math.max(0, (successRate - 80) / 2); // 90% = 5 points, 95% = 7.5 points

  // Availability bonus
  if (freelancer.availability === 'full-time') {
    score += 5;
  }

  return Math.min(Math.round(score), 95); // Cap at 95%
}

// Helper function to get experience level
function getExperienceLevel(completedProjects = 0) {
  if (completedProjects >= 200) return 'expert';
  if (completedProjects >= 50) return 'mid';
  return 'entry';
}

// Helper function to get initials
function getInitials(name) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Helper function to calculate hourly rate based on budget and experience
function calculateHourlyRate(budget, experience) {
  const baseRates = {
    budget: { entry: 25, mid: 35, expert: 45 },
    medium: { entry: 35, mid: 50, expert: 75 },
    enterprise: { entry: 50, mid: 80, expert: 120 }
  };
  
  return baseRates[budget]?.[experience] || 40;
}

// Helper function to get response time based on availability
function getResponseTime(availability) {
  const responseTimes = {
    'full-time': '1-2 hours',
    'part-time': '4-6 hours', 
    'not-available': '24+ hours'
  };
  return responseTimes[availability] || '4-6 hours';
}

module.exports = router;