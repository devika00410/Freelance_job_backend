const Project = require('../Models/Project');
const Job = require('../Models/Job');
const User = require('../Models/User');

const clientProjectController = {
  // Post a new project (job)

  postProject: async (req, res) => {
    try {
      console.log('1. Starting postProject function');
      console.log('1.1 Request user:', req.user);
      console.log('1.2 Request userId:', req.userId);
      console.log('1.3 Request userRole:', req.userRole);

      // Get client ID - handle both authentication styles
      const clientId = req.user?._id || req.userId;

      if (!clientId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. User ID not found.'
        });
      }

      // Verify user role is client
      if (req.userRole !== 'client') {
        return res.status(403).json({
          success: false,
          message: 'Only clients can post projects.'
        });
      }

      const {
        title,
        description,
        budget,
        timeline,
        requiredSkills,
        serviceCategory,
        projectType,
        experienceLevel
      } = req.body;

      console.log('2. Received project data:', {
        title, budget, timeline, serviceCategory, requiredSkills
      });

      // Validate required fields
      if (!title || !description || !budget || !timeline || !serviceCategory) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      console.log('3. Client ID:', clientId);

      // Parse skills
      let skillsArray = [];
      if (Array.isArray(requiredSkills)) {
        skillsArray = requiredSkills;
      } else if (typeof requiredSkills === 'string') {
        skillsArray = requiredSkills.split(',').map(skill => skill.trim()).filter(skill => skill);
      }

      console.log('4. Parsed skills:', skillsArray);

      // Create new job
      // In postProject function, make sure category is set correctly
      const job = new Job({
        title: title.trim(),
        description: description.trim(),
        budget: parseFloat(budget),
        duration: parseInt(timeline),
        skillsRequired: skillsArray,
        category: serviceCategory, 
        serviceCategory: serviceCategory,
        projectType: projectType || 'one_time',
        experienceLevel: experienceLevel || 'intermediate',
        clientId: clientId,
        status: 'active',
        attachments: req.files ? req.files.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size
        })) : []
      });

      await job.save();
      console.log('5. Job saved successfully:', job._id);

      // Populate client info
      await job.populate('clientId', 'name email profilePicture rating totalProjects');

      res.status(201).json({
        success: true,
        message: 'Project posted successfully!',
        job: {
          _id: job._id,
          title: job.title,
          description: job.description,
          budget: job.budget,
          duration: job.duration,
          skillsRequired: job.skillsRequired,
          category: job.category,
          projectType: job.projectType,
          experienceLevel: job.experienceLevel,
          status: job.status,
          clientId: job.clientId,
          createdAt: job.createdAt
        }
      });

    } catch (error) {
      console.error('6. Error posting project:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while posting project: ' + error.message
      });
    }
  },

  // Get client projects with analytics
  getClientProjects: async (req, res) => {
    try {
      const { clientId } = req.params;

      // Verify the client is accessing their own data
      if (req.user.userId !== clientId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const projects = await Project.find({ clientId })
        .populate('freelancerId', 'name email profilePicture rating')
        .sort({ createdAt: -1 });

      // Also get posted jobs (active projects that are looking for freelancers)
      const jobs = await Job.find({ clientId })
        .populate('proposals.freelancerId', 'name profilePicture rating')
        .sort({ createdAt: -1 });

      // Transform data for client dashboard
      const clientProjects = projects.map(project => ({
        _id: project._id,
        title: project.title,
        freelancer: project.freelancerId?.name || 'Freelancer',
        status: project.status,
        progress: project.getProgress ? project.getProgress() : 0,
        budget: project.budget,
        spent: project.paymentInfo?.totalPaid || 0,
        deadline: project.timeline?.deadline,
        startDate: project.timeline?.startDate,
        currentPhase: project.milestones?.filter(m => m.status === 'completed').length + 1 || 1,
        lastActivity: project.updatedAt,
        needsAttention: project.status === 'under_review' || project.status === 'disputed',
        isOverdue: project.timeline?.deadline < new Date() && !['completed', 'cancelled'].includes(project.status),
        nextMilestone: project.milestones?.find(m => m.status === 'pending') || null,
        type: 'active_project'
      }));

      // Transform job postings
      const jobPostings = jobs.map(job => ({
        _id: job._id,
        title: job.title,
        status: job.status,
        budget: job.budget,
        duration: job.duration,
        skillsRequired: job.skillsRequired,
        proposalsCount: job.proposals?.length || 0,
        createdAt: job.createdAt,
        type: 'job_posting',
        proposals: job.proposals?.map(proposal => ({
          freelancer: proposal.freelancerId?.name,
          proposedAmount: proposal.proposedAmount,
          status: proposal.status,
          submittedAt: proposal.submittedAt
        })) || []
      }));

      res.json({
        success: true,
        projects: clientProjects,
        jobPostings: jobPostings
      });

    } catch (error) {
      console.error('Get client projects error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching client projects'
      });
    }
  },

  // Get client project analytics
  getClientProjectStats: async (req, res) => {
    try {
      const { clientId } = req.params;

      // Verify the client is accessing their own data
      if (req.user.userId !== clientId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const projects = await Project.find({ clientId });
      const jobs = await Job.find({ clientId });

      // Client-specific analytics
      const totalProjects = projects.length;
      const activeProjects = projects.filter(p => ['active', 'in_progress'].includes(p.status)).length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      const pendingReview = projects.filter(p => p.status === 'under_review').length;
      const totalSpent = projects.reduce((sum, p) => sum + (p.paymentInfo?.totalPaid || 0), 0);
      const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);

      // Job posting stats
      const activeJobPostings = jobs.filter(j => j.status === 'active').length;
      const totalProposals = jobs.reduce((sum, job) => sum + (job.proposals?.length || 0), 0);

      res.json({
        success: true,
        overview: {
          totalProjects,
          activeProjects,
          completedProjects,
          pendingReview,
          totalSpent,
          budget: totalBudget,
          savings: totalBudget - totalSpent,
          activeJobPostings,
          totalProposals
        }
      });

    } catch (error) {
      console.error('Get client stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching client stats'
      });
    }
  },

  // Get client pending actions
  getClientPendingActions: async (req, res) => {
    try {
      const { clientId } = req.params;

      // Verify the client is accessing their own data
      if (req.user.userId !== clientId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const projects = await Project.find({
        clientId,
        status: { $in: ['under_review', 'disputed'] }
      }).populate('freelancerId', 'name');

      const jobs = await Job.find({
        clientId,
        status: 'active'
      });

      const pendingActions = [];

      projects.forEach(project => {
        // Client needs to review deliverables
        if (project.status === 'under_review') {
          pendingActions.push({
            type: 'deliverable_review',
            project: project.title,
            projectId: project._id,
            freelancer: project.freelancerId?.name || 'Freelancer',
            deadline: project.timeline?.deadline,
            description: 'Review submitted deliverables',
            priority: 'high'
          });
        }

        // Client needs to approve milestones
        project.milestones?.forEach(milestone => {
          if (milestone.status === 'completed') {
            pendingActions.push({
              type: 'milestone_approval',
              project: project.title,
              projectId: project._id,
              freelancer: project.freelancerId?.name || 'Freelancer',
              deadline: milestone.dueDate,
              description: `Approve milestone: ${milestone.title}`,
              amount: milestone.amount,
              priority: 'medium'
            });
          }
        });
      });

      // Add job proposal reviews
      jobs.forEach(job => {
        const pendingProposals = job.proposals?.filter(p => p.status === 'pending') || [];
        if (pendingProposals.length > 0) {
          pendingActions.push({
            type: 'proposal_review',
            project: job.title,
            projectId: job._id,
            description: `Review ${pendingProposals.length} pending proposal(s)`,
            count: pendingProposals.length,
            priority: 'medium'
          });
        }
      });

      // Sort by priority
      pendingActions.sort((a, b) => {
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      res.json({
        success: true,
        actions: pendingActions
      });

    } catch (error) {
      console.error('Get client pending actions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching pending actions'
      });
    }
  }
};

// Helper function to notify relevant freelancers (for future implementation)
async function notifyRelevantFreelancers(job) {
  try {
    // Find freelancers whose skills match the job requirements
    const matchingFreelancers = await User.find({
      role: 'freelancer',
      'skills.name': { $in: job.skillsRequired.map(skill => new RegExp(skill, 'i')) },
      isActive: true
    }).select('_id name email skills notifications');

    console.log(`Found ${matchingFreelancers.length} freelancers with matching skills for job: ${job.title}`);

    // Here you can implement notification logic:
    // - Send emails
    // - Create in-app notifications
    // - Send push notifications

    return matchingFreelancers;
  } catch (error) {
    console.error('Error in notifyRelevantFreelancers:', error);
    return [];
  }
}

module.exports = clientProjectController;