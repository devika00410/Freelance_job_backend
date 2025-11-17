const roleAuth = (role) => {
    console.log(`🔐 RoleAuth checking: ${role}`);
    
    const rolePermissions = {
        // client features
        'client_dashboard': ['client'],
        'post_jobs': ['client'],
        'manage_jobs': ['client'],
        'view_proposals': ['client'],
        'accept_proposals': ['client'],

        // freelancer features
        'freelancer_dashboard': ['freelancer'],
        'browse_jobs': ['freelancer'],
        'submit_proposals': ['freelancer'],
        'manage_proposals': ['freelancer'],

        // common features
        'send_messages': ['client', 'freelancer'],
        'view_profile': ['client', 'freelancer', 'admin'],
        'edit_profile': ['client', 'freelancer'],

        // admin features
        'admin_panel': ['admin'],
        'manage_users': ['admin'],
        'view_reports': ['admin']
    };

    return (req, res, next) => {
        try {
            console.log('🔐 RoleAuth - User ID:', req.userId, 'Role:', req.userRole);
            
            // Check authentication
            if (!req.userId || !req.userRole) {
                console.log('❌ Authentication failed');
                return res.status(401).json({ message: 'Authentication required' });
            }

            // Check if role exists
            if (!rolePermissions[role]) {
                console.log('❌ Feature not configured:', role);
                return res.status(500).json({ message: "Feature configuration error" });
            }

            // Check permission
            const allowedRoles = rolePermissions[role];
            if (!allowedRoles.includes(req.userRole)) {
                console.log('❌ Access denied for role:', req.userRole);
                return res.status(403).json({
                    message: `Access denied. Your role (${req.userRole}) cannot access ${role.replace('_', ' ')}`,
                    yourRole: req.userRole,
                    requiredRoles: allowedRoles
                });
            }

            console.log('✅ RoleAuth passed for:', role);
            next();
        } catch (error) {
            console.error('🚨 RoleAuth error:', error);
            return res.status(500).json({ message: 'Role authentication failed', error: error.message });
        }
    };
};

module.exports = roleAuth;