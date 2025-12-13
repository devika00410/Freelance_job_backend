// backend-test.js - Run this in your backend directory
const axios = require('axios');

async function testWorkspaceBackend() {
  const API_BASE = 'http://localhost:3000';
  const workspaceId = '6933a39a2ceb431598fd0f96';
  const token = 'YOUR_VALID_TOKEN_HERE'; // Get from browser localStorage

  console.log('🔍 Testing Backend Workspace Endpoints');
  console.log('=======================================\n');

  const endpoints = [
    {
      name: 'GET /api/workspaces/:id (General)',
      url: `${API_BASE}/api/workspaces/${workspaceId}`,
      headers: { Authorization: `Bearer ${token}` }
    },
    {
      name: 'GET /api/workspaces/client/:id (Client-specific)',
      url: `${API_BASE}/api/workspaces/client/${workspaceId}`,
      headers: { Authorization: `Bearer ${token}` }
    },
    {
      name: 'GET /api/workspaces/freelancer/:id (Freelancer)',
      url: `${API_BASE}/api/workspaces/freelancer/${workspaceId}`,
      headers: { Authorization: `Bearer ${token}` }
    }
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing: ${endpoint.name}`);
    console.log(`   URL: ${endpoint.url}`);
    
    try {
      const response = await axios.get(endpoint.url, { headers: endpoint.headers });
      
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📦 Success: ${response.data?.success || 'No success field'}`);
      console.log(`   🔧 Has workspace: ${!!response.data?.workspace || !!response.data?.data}`);
      
      if (response.data?.workspace) {
        console.log(`   📝 Workspace ID: ${response.data.workspace._id}`);
        console.log(`   👥 Client ID: ${response.data.workspace.clientId}`);
        console.log(`   💼 Freelancer ID: ${response.data.workspace.freelancerId}`);
      }
      
      if (response.data?.error || response.data?.message) {
        console.log(`   ⚠️ Message: ${response.data.error || response.data.message}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.status || error.code}`);
      console.log(`   📄 Response: ${JSON.stringify(error.response?.data || error.message, null, 2)}`);
      
      if (error.response?.status === 401) {
        console.log('   🔐 Issue: Authentication failed - Token invalid/expired');
      } else if (error.response?.status === 403) {
        console.log('   🚫 Issue: Access forbidden - User not authorized');
      } else if (error.response?.status === 404) {
        console.log('   🔍 Issue: Not found - Workspace or endpoint doesn\'t exist');
      }
    }
  }

  console.log('\n🔧 Database Query Test (if you have MongoDB):');
  console.log('============================================');
  
  // If you have direct DB access, test the query
  const dbQuery = {
    collection: 'workspaces',
    query: { _id: workspaceId },
    projection: { _id: 1, title: 1, clientId: 1, freelancerId: 1, status: 1 }
  };
  
  console.log('Database Query:', JSON.stringify(dbQuery, null, 2));
}

// To get your token, run this in browser console:
console.log(`
📋 How to get your token:
1. Open browser console (F12)
2. Run: localStorage.getItem('token')
3. Copy the token value
4. Paste it in the script above
`);

// Run the test
testWorkspaceBackend();