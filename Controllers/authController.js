const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../Models/User')

// Regular User Registration (Client/Freelancer Only)
exports.register = async (req, res) => {
    try {
        const { email, password, name, role = 'client' } = req.body;

        // Basic validation
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Only allow client/freelancer roles
        if (!['client', 'freelancer'].includes(role)) {
            return res.status(400).json({ error: "Invalid role selection" });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        const user = new User({
            email,
            password: hashedPassword,
            role,
            profile: { name }
        });

        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                name: user.profile.name
            },
            token
        });

    } catch (error) {
        console.error("User registration error:", error);
        res.status(500).json({
            success: false,
            error: "Registration failed"
        });
    }
};

// Regular Login (Client/Freelancer) - STRICTLY NO ADMIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // Find user - EXCLUDE ADMIN
        const user = await User.findOne({ email, role: { $ne: 'admin' } });
        
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                name: user.profile?.name,
                profile: user.profile
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: "Login failed. Please try again"
        });
    }
};

// Admin Login - STRICTLY ADMIN ONLY
exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }

        // Only allow admin role
        const admin = await User.findOne({ email, role: "admin" });
        
        if (!admin) {
            return res.status(401).json({ error: "Admin access only. Please use admin login page." });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        // Admin token with longer expiry
        const token = jwt.sign(
            {
                userId: admin._id,
                role: "admin"
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            user: {
                id: admin._id,
                email: admin.email,
                role: admin.role,
                name: admin.profile?.name,
                profile: admin.profile,
                isAdmin: true
            },
            token,
            isAdmin: true // Add flag for frontend
        });

    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({
            success: false,
            error: "Admin login failed"
        });
    }
};

// Admin Register - STRICTLY WITH SECRET KEY
exports.adminRegister = async (req, res) => {
    try {
        const { email, password, name, secretKey } = req.body;

        // Verify admin secret key
        if (!secretKey || secretKey !== process.env.ADMIN_SECRET_KEY) {
            console.log("❌ Admin registration attempt without valid secret key");
            return res.status(401).json({
                success: false,
                error: "Unauthorized admin registration"
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const admin = new User({
            email,
            password: hashedPassword,
            role: "admin",
            profile: { name },
            isActive: true
        });

        await admin.save();

        const token = jwt.sign(
            {
                userId: admin._id,
                role: "admin"
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            success: true,
            user: {
                id: admin._id,
                email: admin.email,
                role: 'admin',
                name: admin.profile.name,
                isAdmin: true
            },
            token,
            isAdmin: true
        });

    } catch (error) {
        console.error("Admin registration error:", error);
        res.status(500).json({
            success: false,
            error: "Admin registration failed"
        });
    }
};

// Get current user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                name: user.profile?.name,
                profile: user.profile,
                isAdmin: user.role === 'admin'
            }
        });
    } catch (error) {
        console.error("Get user error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get user data"
        });
    }
};

// Logout
exports.logout = (req, res) => {
    res.json({
        success: true,
        message: "Logged out successfully"
    });
};

// Check if email is admin (for frontend detection)
exports.checkAdminEmail = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const user = await User.findOne({ email });
        const isAdmin = user && user.role === 'admin';

        res.json({
            success: true,
            isAdmin,
            exists: !!user
        });
    } catch (error) {
        console.error("Check admin email error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to check email"
        });
    }
};