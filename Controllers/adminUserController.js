const User = require('../Models/User');
const Job = require('../Models/Job');
const Proposal = require('../Models/Proposal');
const Contract = require('../Models/Contract');

const adminUserController = {
    getAllUsers: async (req, res) => {
        try {
            const { role, status, page = 1, limit = 10, search } = req.query;

            let query = {};
            if (role && role !== 'all') query.role = role;
            if (status && status !== 'all') query.status = status;
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { 'companyName': { $regex: search, $options: 'i' } }
                ];
            }

            const users = await User.find(query)
                .select('-password')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalUsers = await User.countDocuments(query);

            res.json({
                success: true,
                users,
                totalPages: Math.ceil(totalUsers / limit),
                currentPage: parseInt(page),
                totalUsers
            });

        } catch (error) {
            console.error("Get all users error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching users"
            });
        }
    },

    getUserDetails: async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId).select('-password');
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            let userStats = {};
            if (user.role === 'client') {
                const [jobStats, contractStats] = await Promise.all([
                    Job.aggregate([
                        { $match: { clientId: userId } },
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                                totalBudget: { $sum: '$budget' }
                            }
                        }
                    ]),
                    Contract.aggregate([
                        { $match: { clientId: userId } },
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                                totalValue: { $sum: '$totalBudget' }
                            }
                        }
                    ])
                ]);
                userStats = { jobStats, contractStats };
            } else if (user.role === 'freelancer') {
                const [proposalStats, contractStats] = await Promise.all([
                    Proposal.aggregate([
                        { $match: { freelancerId: userId } },
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                                totalValue: { $sum: '$proposalDetails.totalAmount' }
                            }
                        }
                    ]),
                    Contract.aggregate([
                        { $match: { freelancerId: userId } },
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                                totalValue: { $sum: '$totalBudget' }
                            }
                        }
                    ])
                ]);
                userStats = { proposalStats, contractStats };
            }

            res.json({
                success: true,
                user: {
                    ...user.toObject(),
                    stats: userStats
                }
            });

        } catch (error) {
            console.error("Get user details error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching user details"
            });
        }
    },

    verifyUser: async (req, res) => {
        try {
            const { userId } = req.params;
            const { verificationStatus, adminNotes } = req.body;

            const user = await User.findByIdAndUpdate(
                userId,
                {
                    isVerified: verificationStatus === 'verified',
                    verificationStatus,
                    adminNotes,
                    verifiedAt: verificationStatus === 'verified' ? new Date() : null
                },
                { new: true }
            ).select('-password');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            res.json({
                success: true,
                message: `User ${verificationStatus} successfully`,
                user
            });

        } catch (error) {
            console.error("Verify user error:", error);
            res.status(500).json({
                success: false,
                message: "Server error verifying user"
            });
        }
    },

    suspendUser: async (req, res) => {
        try {
             const adminId = req.userId || req.user?._id;
            const { userId } = req.params;
            const { suspensionReason, suspensionDuration } = req.body;

            const suspensionEnd = new Date();
            suspensionEnd.setDate(suspensionEnd.getDate() + (suspensionDuration || 7));

            const user = await User.findByIdAndUpdate(
                userId,
                {
                    status: 'suspended',
                    suspensionReason,
                    suspensionEnd,
                    suspendedAt: new Date()
                },
                { new: true }
            ).select('-password');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            res.json({
                success: true,
                message: "User suspended successfully",
                user
            });

        } catch (error) {
            console.error("Suspend user error:", error);
            res.status(500).json({
                success: false,
                message: "Server error suspending user"
            });
        }
        console.log(`Admin ${adminId} performed action: ${actionName}`);
    },

    activateUser: async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await User.findByIdAndUpdate(
                userId,
                {
                    status: 'active',
                    suspensionReason: null,
                    suspensionEnd: null,
                    suspendedAt: null
                },
                { new: true }
            ).select('-password');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            res.json({
                success: true,
                message: "User activated successfully",
                user
            });

        } catch (error) {
            console.error("Activate user error:", error);
            res.status(500).json({
                success: false,
                message: "Server error activating user"
            });
        }
    },

    updateUserRole: async (req, res) => {
        try {
            const { userId } = req.params;
            const { role } = req.body;

            if (!['client', 'freelancer', 'admin'].includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid role"
                });
            }

            const user = await User.findByIdAndUpdate(
                userId,
                { role },
                { new: true }
            ).select('-password');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            res.json({
                success: true,
                message: "User role updated successfully",
                user
            });

        } catch (error) {
            console.error("Update user role error:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating user role"
            });
        }
    },

    deleteUser: async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Check if user has active projects/contracts
            if (user.role === 'client') {
                const activeJobs = await Job.countDocuments({ clientId: userId, status: 'active' });
                if (activeJobs > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot delete user with active jobs"
                    });
                }
            } else if (user.role === 'freelancer') {
                const activeContracts = await Contract.countDocuments({ freelancerId: userId, status: 'active' });
                if (activeContracts > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot delete user with active contracts"
                    });
                }
            }

            await User.findByIdAndDelete(userId);

            res.json({
                success: true,
                message: "User deleted successfully"
            });

        } catch (error) {
            console.error("Delete user error:", error);
            res.status(500).json({
                success: false,
                message: "Server error deleting user"
            });
        }
    },

    getUserStats: async (req, res) => {
        try {
            const userStats = await User.aggregate([
                {
                    $group: {
                        _id: '$role',
                        total: { $sum: 1 },
                        verified: {
                            $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
                        },
                        active: {
                            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                        },
                        suspended: {
                            $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] }
                        }
                    }
                }
            ]);

            const registrationStats = await User.aggregate([
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id.year': -1, '_id.month': -1 }
                },
                {
                    $limit: 12
                }
            ]);

            res.json({
                success: true,
                userStats,
                registrationStats: registrationStats.reverse()
            });

        } catch (error) {
            console.error("Get user stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching user statistics"
            });
        }
    }
};

module.exports = adminUserController;