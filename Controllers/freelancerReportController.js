const Report = require('../Models/Report');
const User = require('../Models/User');
const Project = require('../Models/Project');
const Workspace = require('../Models/Workspace');

const freelancerReportController = {
    // Submit a report
    submitReport: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { reportedUserId, projectId, workspaceId, category, title, description, attachments } = req.body;

            // Verify the reported user exists and is a client
            const reportedUser = await User.findOne({ 
                _id: reportedUserId, 
                role: 'client' 
            });

            if (!reportedUser) {
                return res.status(404).json({
                    success: false,
                    message: "Reported user not found or not a client"
                });
            }

            // Verify project and workspace access if provided
            if (projectId) {
                const project = await Project.findOne({
                    _id: projectId,
                    $or: [
                        { clientId: reportedUserId },
                        { freelancerId: freelancerId }
                    ]
                });

                if (!project) {
                    return res.status(404).json({
                        success: false,
                        message: "Project not found or access denied"
                    });
                }
            }

            if (workspaceId) {
                const workspace = await Workspace.findOne({
                    _id: workspaceId,
                    freelancerId: freelancerId,
                    clientId: reportedUserId
                });

                if (!workspace) {
                    return res.status(404).json({
                        success: false,
                        message: "Workspace not found or access denied"
                    });
                }
            }

            const reportData = {
                reporterId: freelancerId,
                reporterRole: 'freelancer',
                reportedUserId,
                reportedUserRole: 'client',
                projectId: projectId || null,
                workspaceId: workspaceId || null,
                category,
                title,
                description,
                priority: category === 'payment_dispute' || category === 'harassment' ? 'high' : 'medium',
                attachments: attachments || [],
                status: 'open'
            };

            if (!reportData._id) {
                reportData._id = `report_${Date.now()}`;
            }

            const newReport = new Report(reportData);
            await newReport.save();

            // Populate for response
            await newReport.populate('reportedUserId', 'name companyName profilePicture');
            if (projectId) {
                await newReport.populate('projectId', 'title');
            }

            res.status(201).json({
                success: true,
                message: "Report submitted successfully",
                report: newReport
            });

        } catch (error) {
            console.error("Submit report error:", error);
            res.status(500).json({
                success: false,
                message: "Server error submitting report"
            });
        }
    },

    // Get freelancer's reports
    getFreelancerReports: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { reporterId: freelancerId, reporterRole: 'freelancer' };
            if (status && status !== 'all') {
                query.status = status;
            }

            const reports = await Report.find(query)
                .populate('reportedUserId', 'name companyName profilePicture rating')
                .populate('projectId', 'title budget')
                .populate('workspaceId', 'projectTitle')
                .sort({ createdAt: -1 })
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
            const freelancerId = req.userId;
            const { reportId } = req.params;

            const report = await Report.findOne({
                _id: reportId,
                reporterId: freelancerId,
                reporterRole: 'freelancer'
            })
                .populate('reportedUserId', 'name companyName profilePicture rating email phone')
                .populate('projectId', 'title description budget category')
                .populate('workspaceId', 'projectTitle currentPhase overallProgress');

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

    // Update report (add more information)
    updateReport: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { reportId } = req.params;
            const { additionalInfo, newAttachments } = req.body;

            const report = await Report.findOne({
                _id: reportId,
                reporterId: freelancerId,
                reporterRole: 'freelancer',
                status: 'open'
            });

            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found or cannot be updated"
                });
            }

            // Add additional information
            if (additionalInfo) {
                report.additionalInfo = report.additionalInfo 
                    ? `${report.additionalInfo}\n\n${additionalInfo}`
                    : additionalInfo;
            }

            // Add new attachments
            if (newAttachments && newAttachments.length > 0) {
                report.attachments = [...report.attachments, ...newAttachments];
            }

            report.updatedAt = new Date();
            await report.save();

            res.json({
                success: true,
                message: "Report updated successfully",
                report
            });

        } catch (error) {
            console.error("Update report error:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating report"
            });
        }
    },

    // Withdraw report
    withdrawReport: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { reportId } = req.params;
            const { withdrawalReason } = req.body;

            const report = await Report.findOne({
                _id: reportId,
                reporterId: freelancerId,
                reporterRole: 'freelancer',
                status: 'open'
            });

            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found or cannot be withdrawn"
                });
            }

            report.status = 'withdrawn';
            report.withdrawalReason = withdrawalReason || 'Resolved by reporter';
            report.withdrawnAt = new Date();
            report.updatedAt = new Date();

            await report.save();

            res.json({
                success: true,
                message: "Report withdrawn successfully",
                report
            });

        } catch (error) {
            console.error("Withdraw report error:", error);
            res.status(500).json({
                success: false,
                message: "Server error withdrawing report"
            });
        }
    },

    // Get report statistics
    getReportStats: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const stats = await Report.aggregate([
                {
                    $match: {
                        reporterId: freelancerId,
                        reporterRole: 'freelancer'
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
                        reporterId: freelancerId,
                        reporterRole: 'freelancer'
                    }
                },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        openCount: {
                            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
                        }
                    }
                }
            ]);

            const totalStats = await Report.aggregate([
                {
                    $match: {
                        reporterId: freelancerId,
                        reporterRole: 'freelancer'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalReports: { $sum: 1 },
                        openReports: {
                            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
                        },
                        resolvedReports: {
                            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
                        }
                    }
                }
            ]);

            // Recent report activity
            const recentReports = await Report.find({
                reporterId: freelancerId,
                reporterRole: 'freelancer'
            })
                .populate('reportedUserId', 'name companyName')
                .populate('projectId', 'title')
                .sort({ updatedAt: -1 })
                .limit(5)
                .select('category status title updatedAt reportedUserId projectId');

            res.json({
                success: true,
                statusDistribution: stats,
                categoryDistribution: categoryStats,
                overview: totalStats[0] || {
                    totalReports: 0,
                    openReports: 0,
                    resolvedReports: 0
                },
                recentReports
            });

        } catch (error) {
            console.error("Get report stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching report statistics"
            });
        }
    },

    // Get report categories (for dropdown)
    getReportCategories: async (req, res) => {
        try {
            const categories = [
                {
                    value: 'payment_dispute',
                    label: 'Payment Dispute',
                    description: 'Issues related to payments, refunds, or financial matters'
                },
                {
                    value: 'quality_issues',
                    label: 'Quality of Work Issues',
                    description: 'Problems with project requirements or work quality expectations'
                },
                {
                    value: 'scope_creep',
                    label: 'Scope Creep',
                    description: 'Client requesting work beyond agreed scope without compensation'
                },
                {
                    value: 'unprofessional_behavior',
                    label: 'Unprofessional Behavior',
                    description: 'Rude, disrespectful, or unprofessional conduct'
                },
                {
                    value: 'harassment',
                    label: 'Harassment',
                    description: 'Bullying, threats, or inappropriate behavior'
                },
                {
                    value: 'fraud',
                    label: 'Fraud/Scam',
                    description: 'Suspicious or fraudulent activities'
                },
                {
                    value: 'intellectual_property',
                    label: 'Intellectual Property Theft',
                    description: 'Unauthorized use of work or intellectual property'
                },
                {
                    value: 'communication_issues',
                    label: 'Communication Issues',
                    description: 'Lack of communication or responsiveness'
                },
                {
                    value: 'other',
                    label: 'Other Issues',
                    description: 'Any other problems not covered above'
                }
            ];

            res.json({
                success: true,
                categories
            });

        } catch (error) {
            console.error("Get report categories error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching report categories"
            });
        }
    }
};

module.exports = freelancerReportController;