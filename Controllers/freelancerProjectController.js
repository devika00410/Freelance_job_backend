const Project = require('../Models/Project');

const freelancerProjectController = {
  // Get freelancer projects with analytics
  getFreelancerProjects: async (req, res) => {
    try {
      const { freelancerId } = req.params;
      
      const projects = await Project.find({ freelancerId })
        .populate('clientId', 'name email profilePicture rating')
        .sort({ createdAt: -1 });

      // Transform data for freelancer dashboard
      const freelancerProjects = projects.map(project => ({
        _id: project._id,
        title: project.title,
        client: project.clientId?.name || 'Client',
        status: project.status,
        progress: project.getProgress(),
        budget: project.budget,
        earned: project.paymentInfo.totalPaid || 0,
        pendingPayment: project.milestones
          .filter(m => m.status === 'completed')
          .reduce((sum, m) => sum + m.amount, 0),
        deadline: project.timeline.deadline,
        startDate: project.timeline.startDate,
        currentPhase: project.milestones.filter(m => m.status === 'completed').length + 1,
        lastActivity: project.updatedAt,
        isOverdue: project.timeline.deadline < new Date() && !['completed', 'cancelled'].includes(project.status),
        nextMilestone: project.milestones.find(m => m.status === 'pending') || null
      }));

      res.json({
        success: true,
        projects: freelancerProjects
      });

    } catch (error) {
      console.error('Get freelancer projects error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching freelancer projects'
      });
    }
  },

  // Get freelancer project analytics
  getFreelancerProjectStats: async (req, res) => {
    try {
      const { freelancerId } = req.params;

      const projects = await Project.find({ freelancerId });
      
      // Freelancer-specific analytics
      const total = projects.length;
      const active = projects.filter(p => ['active', 'in_progress'].includes(p.status)).length;
      const completed = projects.filter(p => p.status === 'completed').length;
      const underReview = projects.filter(p => p.status === 'under_review').length;
      const totalEarned = projects.reduce((sum, p) => sum + (p.paymentInfo.totalPaid || 0), 0);
      const pendingPayment = projects.reduce((sum, p) => 
        sum + p.milestones.filter(m => m.status === 'completed').reduce((msum, m) => msum + m.amount, 0), 0);

      res.json({
        success: true,
        overview: {
          total,
          active,
          completed,
          underReview,
          totalEarned,
          pendingPayment,
          potentialEarnings: projects.reduce((sum, p) => sum + (p.budget || 0), 0) - totalEarned
        }
      });

    } catch (error) {
      console.error('Get freelancer stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching freelancer stats'
      });
    }
  },

  // Get freelancer pending actions
  getFreelancerPendingActions: async (req, res) => {
    try {
      const { freelancerId } = req.params;

      const projects = await Project.find({ 
        freelancerId,
        status: { $in: ['revision_requested', 'active', 'in_progress'] }
      }).populate('clientId', 'name');

      const pendingActions = [];

      projects.forEach(project => {
        // Freelancer needs to do revisions
        if (project.status === 'revision_requested') {
          pendingActions.push({
            type: 'revision_work',
            project: project.title,
            projectId: project._id,
            client: project.clientId.name,
            deadline: project.timeline.deadline,
            description: 'Complete requested revisions'
          });
        }

        // Freelancer needs to submit milestones
        project.milestones.forEach(milestone => {
          if (milestone.status === 'pending') {
            pendingActions.push({
              type: 'milestone_submission',
              project: project.title,
              projectId: project._id,
              client: project.clientId.name,
              deadline: milestone.dueDate,
              description: `Submit work for: ${milestone.title}`,
              amount: milestone.amount
            });
          }
        });
      });

      res.json({
        success: true,
        actions: pendingActions
      });

    } catch (error) {
      console.error('Get freelancer pending actions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching freelancer pending actions'
      });
    }
  }
};

module.exports = freelancerProjectController;