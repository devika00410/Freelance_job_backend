const Report = require('../Models/Report');
const User = require('../Models/User');

const adminReportController = {
    // Get all reports with filters
    getAllReports: async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 10, 
                status, 
                priority, 
                category, 
                assignedAdmin,
                startDate, 
                endDate 
            } = req.query;
            
            let query = {};
            if (status && status !== 'all') query.status = status;
            if (priority && priority !== 'all') query.priority = priority;
            if (category && category !== 'all') query.category = category;
            if (assignedAdmin) query['adminResolution.assignedAdmin'] = assignedAdmin;
            
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            const reports = await Report.find(query)
                .populate('reporterId', 'name email profile')
                .populate('reportedUserId', 'name email profile')
                .sort({ priority: -1, createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalReports = await Report.countDocuments(query);

            res.json({
                success: true,
                reports,
                totalPages: Math.ceil(totalReports / limit),
                currentPage: parseInt(page),
                totalReports
            });

        } catch (error) {
            console.error("Get reports error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching reports"
            });
        }
    },

    // Get report details
    getReportDetails: async (req, res) => {
        try {
            const { reportId } = req.params;

            const report = await Report.findById(reportId)
                .populate('reporterId', 'name email profile')
                .populate('reportedUserId', 'name email profile');

            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found"
                });
            }

            res.json({
                success: true,
                report
            });

        } catch (error) {
            console.error("Get report details error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching report details"
            });
        }
    },

    // Assign report to admin
    assignReport: async (req, res) => {
        try {
            const { reportId } = req.params;
            const { adminId } = req.body;

            const report = await Report.findById(reportId);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found"
                });
            }

            await report.assignAdmin(adminId);

            res.json({
                success: true,
                message: "Report assigned successfully",
                report
            });

        } catch (error) {
            console.error("Assign report error:", error);
            res.status(500).json({
                success: false,
                message: "Server error assigning report"
            });
        }
    },

    // Add admin action to report
    addAdminAction: async (req, res) => {
        try {
            const { reportId } = req.params;
            const { action, details } = req.body;

            const report = await Report.findById(reportId);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found"
                });
            }

            await report.addAction(action, req.userId, details);

            res.json({
                success: true,
                message: "Action added successfully",
                report
            });

        } catch (error) {
            console.error("Add admin action error:", error);
            res.status(500).json({
                success: false,
                message: "Server error adding admin action"
            });
        }
    },

    // Add communication to report
    addCommunication: async (req, res) => {
        try {
            const { reportId } = req.params;
            const { message, isInternal = false } = req.body;

            const report = await Report.findById(reportId);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found"
                });
            }

            await report.addCommunication(message, req.userId, 'admin', isInternal);

            res.json({
                success: true,
                message: "Communication added successfully",
                report
            });

        } catch (error) {
            console.error("Add communication error:", error);
            res.status(500).json({
                success: false,
                message: "Server error adding communication"
            });
        }
    },

    // Resolve report
    resolveReport: async (req, res) => {
        try {
            const { reportId } = req.params;
            const { resolution, resolutionNotes, penalty } = req.body;

            const report = await Report.findById(reportId);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found"
                });
            }

            await report.resolveReport(resolution, resolutionNotes, penalty);

            res.json({
                success: true,
                message: "Report resolved successfully",
                report
            });

        } catch (error) {
            console.error("Resolve report error:", error);
            res.status(500).json({
                success: false,
                message: "Server error resolving report"
            });
        }
    },

    // Add follow-up action
    addFollowUpAction: async (req, res) => {
        try {
            const { reportId } = req.params;
            const { action, requiredBy, deadline } = req.body;

            const report = await Report.findById(reportId);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found"
                });
            }

            await report.addFollowUpAction(action, requiredBy, new Date(deadline));

            res.json({
                success: true,
                message: "Follow-up action added successfully",
                report
            });

        } catch (error) {
            console.error("Add follow-up action error:", error);
            res.status(500).json({
                success: false,
                message: "Server error adding follow-up action"
            });
        }
    },

    // Complete follow-up action
    completeFollowUpAction: async (req, res) => {
        try {
            const { reportId } = req.params;
            const { actionIndex } = req.body;

            const report = await Report.findById(reportId);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found"
                });
            }

            await report.completeFollowUpAction(actionIndex);

            res.json({
                success: true,
                message: "Follow-up action completed successfully",
                report
            });

        } catch (error) {
            console.error("Complete follow-up action error:", error);
            res.status(500).json({
                success: false,
                message: "Server error completing follow-up action"
            });
        }
    },

    // Update report priority
    updateReportPriority: async (req, res) => {
        try {
            const { reportId } = req.params;
            const { priority } = req.body;

            const report = await Report.findByIdAndUpdate(
                reportId,
                { priority },
                { new: true }
            ).populate('reporterId reportedUserId');

            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found"
                });
            }

            res.json({
                success: true,
                message: "Report priority updated successfully",
                report
            });

        } catch (error) {
            console.error("Update report priority error:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating report priority"
            });
        }
    },

    // Get urgent reports
    getUrgentReports: async (req, res) => {
        try {
            const reports = await Report.find({
                $or: [
                    { priority: 'urgent' },
                    { 
                        priority: 'high', 
                        createdAt: { 
                            $lte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) 
                        } 
                    }
                ],
                status: { $in: ['open', 'under_review'] }
            })
            .populate('reporterId', 'name email')
            .populate('reportedUserId', 'name email')
            .sort({ priority: -1, createdAt: -1 })
            .limit(20);

            res.json({
                success: true,
                reports,
                totalUrgent: reports.length
            });

        } catch (error) {
            console.error("Get urgent reports error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching urgent reports"
            });
        }
    },

    // Get report statistics
    getReportStats: async (req, res) => {
        try {
            const { period = '30d' } = req.query;
            let days = 30;
            if (period === '7d') days = 7;
            if (period === '90d') days = 90;

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const statusStats = await Report.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const categoryStats = await Report.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        highPriority: {
                            $sum: { $cond: [{ $in: ['$priority', ['high', 'urgent']] }, 1, 0] }
                        }
                    }
                }
            ]);

            const priorityStats = await Report.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: '$priority',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const resolutionTimeStats = await Report.aggregate([
                {
                    $match: {
                        status: 'resolved',
                        resolvedAt: { $gte: startDate }
                    }
                },
                {
                    $project: {
                        resolutionTime: {
                            $divide: [
                                { $subtract: ['$resolvedAt', '$createdAt'] },
                                1000 * 60 * 60 * 24 // Convert to days
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgResolutionTime: { $avg: '$resolutionTime' },
                        maxResolutionTime: { $max: '$resolutionTime' },
                        minResolutionTime: { $min: '$resolutionTime' }
                    }
                }
            ]);

            const totalReports = await Report.countDocuments({ createdAt: { $gte: startDate } });
            const openReports = await Report.countDocuments({ 
                status: { $in: ['open', 'under_review'] },
                createdAt: { $gte: startDate }
            });

            res.json({
                success: true,
                stats: {
                    statusStats,
                    categoryStats,
                    priorityStats,
                    resolutionTime: resolutionTimeStats[0] || {},
                    totalReports,
                    openReports,
                    period
                }
            });

        } catch (error) {
            console.error("Get report stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching report statistics"
            });
        }
    },

    // Get reports by admin
    getMyAssignedReports: async (req, res) => {
        try {
            const { page = 1, limit = 10, status } = req.query;
            
            let query = { 'adminResolution.assignedAdmin': req.userId };
            if (status && status !== 'all') query.status = status;

            const reports = await Report.find(query)
                .populate('reporterId', 'name email')
                .populate('reportedUserId', 'name email')
                .sort({ priority: -1, createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalReports = await Report.countDocuments(query);

            res.json({
                success: true,
                reports,
                totalPages: Math.ceil(totalReports / limit),
                currentPage: parseInt(page),
                totalReports
            });

        } catch (error) {
            console.error("Get my assigned reports error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching assigned reports"
            });
        }
    }
};

module.exports = adminReportController;