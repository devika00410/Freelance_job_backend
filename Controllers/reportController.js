const Report = require('../Models/Report');
const { v4: uuidv4 } = require('uuid');

// Get all reports for the authenticated user
exports.getUserReports = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    
    let reports;
    if (userRole === 'admin') {
      reports = await Report.find().sort({ createdAt: -1 });
    } else {
      const reporterReports = await Report.findByReporter(userId);
      const reportedReports = await Report.findByReportedUser(userId);
      reports = [...reporterReports, ...reportedReports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// Get report statistics
exports.getReportStats = async (req, res) => {
  try {
    const stats = await Report.getReportStats();
    
    const statusCounts = {
      open: 0,
      under_review: 0,
      resolved: 0,
      closed: 0,
      rejected: 0
    };
    
    let totalHighPriority = 0;
    let categoryBreakdown = {};
    
    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
      totalHighPriority += stat.highPriority;
      
      stat.byCategory.forEach(item => {
        if (!categoryBreakdown[item.category]) {
          categoryBreakdown[item.category] = { total: 0, highPriority: 0 };
        }
        categoryBreakdown[item.category].total++;
        if (['high', 'urgent'].includes(item.priority)) {
          categoryBreakdown[item.category].highPriority++;
        }
      });
    });
    
    res.json({
      statusCounts,
      totalHighPriority,
      categoryBreakdown,
      totalReports: Object.values(statusCounts).reduce((sum, count) => sum + count, 0)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report statistics' });
  }
};

// Get report categories
exports.getReportCategories = async (req, res) => {
  try {
    const categories = [
      'payment_dispute',
      'quality_issues',
      'missed_deadline',
      'unprofessional_behavior',
      'communication_issues',
      'scope_violation',
      'payment_fraud',
      'plagiarism',
      'account_issues',
      'other'
    ];
    
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

// Get specific report details
exports.getReportDetails = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await Report.findOne({ reportId });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const userId = req.userId;
    const userRole = req.userRole;
    
    const canAccess = userRole === 'admin' || 
                     report.reporterId === userId || 
                     report.reportedUserId === userId;
    
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied to this report' });
    }
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report details' });
  }
};

// Submit a new report
exports.submitReport = async (req, res) => {
  try {
    const {
      reportedUserId,
      reportedUserRole,
      projectId,
      workspaceId,
      category,
      title,
      description,
      priority,
      evidence
    } = req.body;
    
    const reportData = {
      reportId: `report_${uuidv4()}`,
      reporterId: req.userId,
      reporterRole: req.userRole,
      reportedUserId,
      reportedUserRole,
      projectId,
      workspaceId,
      category,
      title,
      description,
      priority: priority || 'medium',
      evidence: evidence || {},
      status: 'open'
    };
    
    const report = await Report.create(reportData);
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
};

// Update a report
exports.updateReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const updateData = req.body;
    
    const report = await Report.findOne({ reportId });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    if (report.reporterId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only reporter or admin can update report' });
    }
    
    if (report.status === 'resolved' || report.status === 'closed') {
      return res.status(400).json({ error: 'Cannot update resolved or closed report' });
    }
    
    const allowedUpdates = ['title', 'description', 'priority', 'evidence', 'category'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });
    
    const updatedReport = await Report.findOneAndUpdate(
      { reportId },
      { $set: updates },
      { new: true }
    );
    
    res.json(updatedReport);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report' });
  }
};

// Withdraw a report
exports.withdrawReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const report = await Report.findOne({ reportId });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    if (report.reporterId !== req.userId) {
      return res.status(403).json({ error: 'Only reporter can withdraw report' });
    }
    
    if (!['open', 'under_review'].includes(report.status)) {
      return res.status(400).json({ error: 'Cannot withdraw report in current status' });
    }
    
    report.status = 'closed';
    report.closedAt = new Date();
    
    await report.save();
    
    res.json({ message: 'Report withdrawn successfully', report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to withdraw report' });
  }
};