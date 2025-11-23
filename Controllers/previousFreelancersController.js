const Project = require('../Models/Project');
const User = require('../Models/User');

const getPreviousFreelancers = async (req, res) => {
  try {
    const clientId = req.user.id; // From auth middleware
    
    // Find all completed projects for this client
    const projects = await Project.find({
      clientId: clientId,
      status: { $in: ['completed', 'under_review'] }
    }).populate('freelancerId', 'name email profilePhoto skills hourlyRate rating');
    
    // Calculate freelancer metrics
    const freelancerMap = new Map();
    
    projects.forEach(project => {
      if (project.freelancerId) {
        const freelancerId = project.freelancerId._id.toString();
        
        if (!freelancerMap.has(freelancerId)) {
          freelancerMap.set(freelancerId, {
            freelancerId: project.freelancerId._id,
            name: project.freelancerId.name,
            profilePhoto: project.freelancerId.profilePhoto,
            skills: project.freelancerId.skills || [],
            hourlyRate: project.freelancerId.hourlyRate,
            rating: project.freelancerId.rating || 0,
            completedProjects: 0,
            lastProject: project.title,
            lastProjectDate: project.updatedAt,
            availability: 'available', // You might want to calculate this
            successRate: 0,
            totalProjects: 0
          });
        }
        
        // Update metrics
        const freelancer = freelancerMap.get(freelancerId);
        freelancer.completedProjects += 1;
        freelancer.totalProjects += 1;
        
        // Update last project if newer
        if (new Date(project.updatedAt) > new Date(freelancer.lastProjectDate)) {
          freelancer.lastProject = project.title;
          freelancer.lastProjectDate = project.updatedAt;
        }
      }
    });
    
    // Convert map to array and calculate success rates
    const previousFreelancers = Array.from(freelancerMap.values()).map(freelancer => {
      // Calculate success rate (you can customize this logic)
      freelancer.successRate = Math.min(95 + (Math.random() * 5), 100); // Placeholder
      freelancer.avgDeliveryTime = 'on time'; // Calculate from project timelines
      
      return freelancer;
    });
    
    res.json({
      success: true,
      data: previousFreelancers
    });
    
  } catch (error) {
    console.error('Error fetching previous freelancers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch previous freelancers'
    });
  }
};

module.exports = {
  getPreviousFreelancers
};