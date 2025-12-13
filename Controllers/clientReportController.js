const Report = require('../Models/Report');
const User = require('../Models/User');
const Project = require('../Models/Project');
const Workspace = require('../Models/Workspace');

const clientReportController = {
    submitReport: async (req, res) => {
        try {
            const clientId = req.userId;
            const { reportedUserId, projectId, workspaceId, category, title, description, attachments } = req.body;

            const reportedUser = await User.findOne({ 
                _id: reportedUserId, 
                role: 'freelancer' 
            });

            if (!reportedUser) {
                return res.status(404).json({
                    success: false,
                    message: "Reported user not found or not a freelancer"
                });
            }

            if (projectId) {
                const project = await Project.findOne({
                    _id: projectId,
                    clientId: clientId,
                    freelancerId: reportedUserId
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
                    clientId: clientId,
                    freelancerId: reportedUserId
                });

                if (!workspace) {
                    return res.status(404).json({
                        success: false,
                        message: "Workspace not found or access denied"
                    });
                }
            }

            const reportData = {
                reporterId: clientId,
                reporterRole: 'client',
                reportedUserId,
                reportedUserRole: 'freelancer',
                projectId: projectId || null,
                workspaceId: workspaceId || null,
                category,
                title,
                description,
                priority: category === 'payment_dispute' || category === 'fraud' ? 'high' : 'medium',
                attachments: attachments || [],
                status: 'open'
            };

            if (!reportData._id) {
                reportData._id = `report_${Date.now()}`;
            }

            const newReport = new Report(reportData);
            await newReport.save();

            await newReport.populate('reportedUserId', 'name profilePicture rating');
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

    getClientReports: async (req, res) => {
        try {
            const clientId = req.userId;
            const { status, page = 1, limit = 10 } = req.query;

            let query = { reporterId: clientId, reporterRole: 'client' };
            if (status && status !== 'all') {
                query.status = status;
            }

            const reports = await Report.find(query)
                .populate('reportedUserId', 'name profilePicture rating skills')
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

    getReportDetails: async (req, res) => {
        try {
            const clientId = req.userId;
            const { reportId } = req.params;

            const report = await Report.findOne({
                _id: reportId,
                reporterId: clientId,
                reporterRole: 'client'
            })
                .populate('reportedUserId', 'name profilePicture rating email skills completedProjects')
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

    updateReport: async (req, res) => {
        try {
            const clientId = req.userId;
            const { reportId } = req.params;
            const { additionalInfo, newAttachments } = req.body;

            const report = await Report.findOne({
                _id: reportId,
                reporterId: clientId,
                reporterRole: 'client',
                status: 'open'
            });

            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found or cannot be updated"
                });
            }

            if (additionalInfo) {
                report.additionalInfo = report.additionalInfo 
                    ? `${report.additionalInfo}\n\n${additionalInfo}`
                    : additionalInfo;
            }

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

    withdrawReport: async (req, res) => {
        try {
            const clientId = req.userId;
            const { reportId } = req.params;
            const { withdrawalReason } = req.body;

            const report = await Report.findOne({
                _id: reportId,
                reporterId: clientId,
                reporterRole: 'client',
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

    getReportStats: async (req, res) => {
        try {
            const clientId = req.userId;

            const stats = await Report.aggregate([
                {
                    $match: {
                        reporterId: clientId,
                        reporterRole: 'client'
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
                        reporterId: clientId,
                        reporterRole: 'client'
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
                        reporterId: clientId,
                        reporterRole: 'client'
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

            const recentReports = await Report.find({
                reporterId: clientId,
                reporterRole: 'client'
            })
                .populate('reportedUserId', 'name profilePicture')
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

    getReportCategories: async (req, res) => {
        try {
            const categories = [
                {
                    value: 'payment_dispute',
                    label: 'Payment Dispute',
                    description: 'Issues with freelancer payments or refund requests'
                },
                {
                    value: 'quality_issues',
                    label: 'Poor Quality Work',
                    description: 'Work delivered does not meet quality standards'
                },
                {
                    value: 'missed_deadlines',
                    label: 'Missed Deadlines',
                    description: 'Freelancer consistently missing project deadlines'
                },
                {
                    value: 'unprofessional_behavior',
                    label: 'Unprofessional Behavior',
                    description: 'Rude, disrespectful, or unprofessional conduct'
                },
                {
                    value: 'communication_issues',
                    label: 'Communication Issues',
                    description: 'Poor communication or lack of responsiveness'
                },
                {
                    value: 'scope_violation',
                    label: 'Scope Violation',
                    description: 'Freelancer not following project requirements'
                },
                {
                    value: 'fraud',
                    label: 'Fraud/Scam',
                    description: 'Suspicious or fraudulent activities'
                },
                {
                    value: 'intellectual_property',
                    label: 'Intellectual Property Theft',
                    description: 'Unauthorized use of project assets or IP'
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

module.exports = clientReportController;