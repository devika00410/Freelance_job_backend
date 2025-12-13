const simpleWorkspaceController = {
  getRoleBasedWorkspace: async (req, res) => {
    try {
      console.log('✅ SIMPLE CONTROLLER CALLED');
      console.log('📌 Workspace ID:', req.params.workspaceId);
      console.log('👤 User ID:', req.userId);
      console.log('👑 User Role:', req.userRole);
      
      // Just return simple success
      res.json({
        success: true,
        message: 'SIMPLE CONTROLLER IS WORKING!',
        workspaceId: req.params.workspaceId,
        userId: req.userId,
        userRole: req.userRole,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ SIMPLE CONTROLLER ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Simple controller error',
        error: error.message
      });
    }
  }
};

module.exports = simpleWorkspaceController;