const User = require('../Models/User');

const adminVerificationController = {
    // Get users needing verification (score < 60)
    getVerificationQueue: async (req, res) => {
        try {
            const { page = 1, limit = 20, role } = req.query;
            
            let query = { 
                isVerified: false,
                verifiedBy: 'pending'
            };
            
            if (role && role !== 'all') {
                query.role = role;
            }
            
            // Get all unverified users first
            const allUsers = await User.find(query)
                .select('name email role profile phone createdAt emailVerified skills paymentMethod profilePicture')
                .sort({ createdAt: -1 });
            
            // Calculate scores for each user
            const queue = allUsers.map(user => {
                const verification = calculateVerificationScore(user);
                return {
                    ...user.toObject(),
                    verificationScore: verification.score,
                    verificationChecks: verification.checks,
                    canAutoVerify: verification.isAutoVerified
                };
            }).filter(user => user.verificationScore < 60); // Only show users with score < 60
            
            // Paginate manually
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;
            const paginatedQueue = queue.slice(startIndex, endIndex);
            
            res.json({
                success: true,
                queue: paginatedQueue,
                totalUsers: queue.length,
                totalPages: Math.ceil(queue.length / limit),
                currentPage: parseInt(page)
            });
            
        } catch (error) {
            console.error("Get verification queue error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching verification queue"
            });
        }
    },
    
    // Auto-verify eligible users (score >= 60)
    autoVerifyUsers: async (req, res) => {
        try {
            const users = await User.find({ 
                isVerified: false,
                verifiedBy: 'pending'
            });
            
            let verifiedCount = 0;
            const results = [];
            
            for (const user of users) {
                const verification = calculateVerificationScore(user);
                
                if (verification.isAutoVerified) {
                    user.isVerified = true;
                    user.verificationScore = verification.score;
                    user.verificationChecks = verification.checks;
                    user.verificationDate = new Date();
                    user.verifiedBy = 'auto';
                    
                    await user.save();
                    verifiedCount++;
                    
                    results.push({
                        userId: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        score: verification.score,
                        checks: verification.checks
                    });
                }
            }
            
            res.json({
                success: true,
                message: `Auto-verified ${verifiedCount} users`,
                verifiedCount,
                results
            });
            
        } catch (error) {
            console.error("Auto verify users error:", error);
            res.status(500).json({
                success: false,
                message: "Server error auto-verifying users"
            });
        }
    },
    
    // Manually verify a user
    manualVerifyUser: async (req, res) => {
        try {
             const adminId = req.userId || req.user?._id;
            const { userId } = req.params;
            const { adminNotes } = req.body;
            
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }
            
            // Calculate score for record
            const verification = calculateVerificationScore(user);
            
            user.isVerified = true;
            user.verificationScore = verification.score;
            user.verificationChecks = verification.checks;
            user.verificationDate = new Date();
            user.verifiedBy = 'manual';
            user.adminNotes = adminNotes;
            
            await user.save();
            
            res.json({
                success: true,
                message: "User manually verified",
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    verificationScore: user.verificationScore,
                    verificationChecks: user.verificationChecks,
                    verifiedBy: user.verifiedBy
                }
            });
            
        } catch (error) {
            console.error("Manual verify user error:", error);
            res.status(500).json({
                success: false,
                message: "Server error manually verifying user"
            });
        }
        console.log(`Admin ${adminId} performed action: ${actionName}`);
    },
    
    // Bulk verify users
    bulkVerifyUsers: async (req, res) => {
        try {
            const { userIds } = req.body; // Array of user IDs
            
            if (!userIds || !Array.isArray(userIds)) {
                return res.status(400).json({
                    success: false,
                    message: "userIds array is required"
                });
            }
            
            const results = {
                successful: 0,
                failed: 0,
                errors: []
            };
            
            for (const userId of userIds) {
                try {
                    const user = await User.findById(userId);
                    if (user) {
                        user.isVerified = true;
                        user.verificationDate = new Date();
                        user.verifiedBy = 'manual';
                        await user.save();
                        results.successful++;
                    } else {
                        results.failed++;
                        results.errors.push(`User ${userId} not found`);
                    }
                } catch (error) {
                    results.failed++;
                    results.errors.push(`User ${userId}: ${error.message}`);
                }
            }
            
            res.json({
                success: true,
                message: `Verified ${results.successful} users, ${results.failed} failed`,
                results
            });
            
        } catch (error) {
            console.error("Bulk verify users error:", error);
            res.status(500).json({
                success: false,
                message: "Server error bulk verifying users"
            });
        }
    },
    
    // Get verification statistics
    getVerificationStats: async (req, res) => {
        try {
            // Total counts
            const totalUsers = await User.countDocuments();
            const verifiedUsers = await User.countDocuments({ isVerified: true });
            
            // Verification method breakdown
            const autoVerified = await User.countDocuments({ verifiedBy: 'auto' });
            const manualVerified = await User.countDocuments({ verifiedBy: 'manual' });
            const pendingVerification = await User.countDocuments({ 
                isVerified: false,
                verifiedBy: 'pending'
            });
            
            // Recent verifications (last 7 days)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const recentVerifications = await User.countDocuments({
                verificationDate: { $gte: sevenDaysAgo }
            });
            
            // Role-based verification stats
            const roleStats = await User.aggregate([
                {
                    $group: {
                        _id: '$role',
                        total: { $sum: 1 },
                        verified: {
                            $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
                        },
                        autoVerified: {
                            $sum: { $cond: [{ $eq: ['$verifiedBy', 'auto'] }, 1, 0] }
                        },
                        manualVerified: {
                            $sum: { $cond: [{ $eq: ['$verifiedBy', 'manual'] }, 1, 0] }
                        }
                    }
                }
            ]);
            
            // Daily verification trend (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const dailyTrend = await User.aggregate([
                {
                    $match: {
                        verificationDate: { $gte: thirtyDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$verificationDate" }
                        },
                        count: { $sum: 1 },
                        autoCount: {
                            $sum: { $cond: [{ $eq: ['$verifiedBy', 'auto'] }, 1, 0] }
                        },
                        manualCount: {
                            $sum: { $cond: [{ $eq: ['$verifiedBy', 'manual'] }, 1, 0] }
                        }
                    }
                },
                { $sort: { _id: 1 } },
                { $limit: 30 }
            ]);
            
            res.json({
                success: true,
                stats: {
                    totalUsers,
                    verifiedUsers,
                    pendingVerification,
                    verificationRate: totalUsers > 0 ? 
                        Math.round((verifiedUsers / totalUsers) * 100) : 0,
                    autoVerified,
                    manualVerified,
                    recentVerifications,
                    roleStats,
                    dailyTrend
                }
            });
            
        } catch (error) {
            console.error("Get verification stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching verification statistics"
            });
        }
    },
    
    // Get user verification details
    getUserVerificationDetails: async (req, res) => {
        try {
            const { userId } = req.params;
            
            const user = await User.findById(userId)
                .select('name email role profile phone createdAt emailVerified skills paymentMethod profilePicture isVerified verificationScore verificationChecks verificationDate verifiedBy');
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }
            
            const verification = calculateVerificationScore(user);
            
            res.json({
                success: true,
                user: {
                    ...user.toObject(),
                    verificationScore: verification.score,
                    verificationChecks: verification.checks,
                    isAutoVerified: verification.isAutoVerified,
                    missingChecks: getMissingChecks(verification.checks, user.role)
                }
            });
            
        } catch (error) {
            console.error("Get user verification details error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching user verification details"
            });
        }
    }
};

// Helper function: Calculate verification score
const calculateVerificationScore = (user) => {
    let score = 0;
    const checks = [];
    
    // BASIC CHECKS (for both)
    if (user.emailVerified) { 
        score += 30; 
        checks.push('email_verified'); 
    }
    
    if (user.phone && user.phone.length >= 10) { 
        score += 20; 
        checks.push('has_phone'); 
    }
    
    if (user.profile?.name) { 
        score += 10; 
        checks.push('has_name'); 
    }
    
    // ROLE-SPECIFIC CHECKS
    if (user.role === 'client') {
        if (user.paymentMethod) { 
            score += 30; 
            checks.push('payment_method'); 
        }
        if (user.companyName) { 
            score += 10; 
            checks.push('has_company'); 
        }
    }
    
    if (user.role === 'freelancer') {
        if (user.skills?.length > 0) { 
            score += 25; 
            checks.push('has_skills'); 
        }
        if (user.profile?.description?.length > 50) { 
            score += 15; 
            checks.push('has_description'); 
        }
        if (user.profilePicture) { 
            score += 20; 
            checks.push('has_photo'); 
        }
    }
    
    return {
        score,
        checks,
        isAutoVerified: score >= 60,
        userRole: user.role
    };
};

// Helper function: Get missing checks for verification
const getMissingChecks = (currentChecks, role) => {
    const allChecks = {
        common: ['email_verified', 'has_phone', 'has_name'],
        client: ['payment_method', 'has_company'],
        freelancer: ['has_skills', 'has_description', 'has_photo']
    };
    
    const requiredChecks = [...allChecks.common];
    if (role === 'client') requiredChecks.push(...allChecks.client);
    if (role === 'freelancer') requiredChecks.push(...allChecks.freelancer);
    
    return requiredChecks.filter(check => !currentChecks.includes(check));
};

module.exports = adminVerificationController;