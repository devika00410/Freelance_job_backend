// testRoute.js
const express = require('express');
const app = express();
const { authenticate } = require('./Middlewares/authMiddleware');

// Mock req and res objects
const mockReq = {
  params: { workspaceId: '6933a39a2ceb431598fd0f96' },
  userId: '676f1c5a9b1d8a3f4c2e1b2c', // Replace with actual user ID
  userRole: 'client'
};

const mockRes = {
  status: function(code) {
    console.log('Response Status:', code);
    return this;
  },
  json: function(data) {
    console.log('Response JSON:', JSON.stringify(data, null, 2));
    return this;
  }
};

// Test the controller function directly
async function testController() {
  console.log('🧪 Testing workspaceController.getRoleBasedWorkspace');
  console.log('===================================================');
  
  const workspaceController = require('./Controllers/workspaceController');
  
  try {
    console.log('Mock Request:', mockReq);
    await workspaceController.getRoleBasedWorkspace(mockReq, mockRes);
  } catch (error) {
    console.error('❌ Controller Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testController();