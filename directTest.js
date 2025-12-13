// DIRECT-TEST.js
const axios = require('axios');

async function directTest() {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTJlNzRlMjE0Yjc4MTc0NzBiYWJjMjciLCJyb2xlIjoiZnJlZWxhbmNlciIsIm5hbWUiOiJFbHNhIiwiZW1haWwiOiJlbHNhQGdtYWlsLmNvbSIsImlhdCI6MTc2NTIwNTQ0MSwiZXhwIjoxNzY1MjkxODQxfQ.sc6xOXIfrUv2WSC6aPkc52pGBCwcLkReAM6l2l9AE78";
    const workspaceId = "6933a39a2ceb431598fd0f96";
    
    console.log('🔍 Testing API with correct token...\n');
    console.log(`Token: ${token.substring(0, 50)}...`);
    console.log(`Workspace ID: ${workspaceId}\n`);
    
    const endpoints = [
        `http://localhost:3000/api/workspaces/freelancer/${workspaceId}`,
        'http://localhost:3000/health',
        'http://localhost:3000/api/test'
    ];
    
    for (const endpoint of endpoints) {
        console.log(`📡 Testing: ${endpoint}`);
        
        try {
            const response = await axios.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 5000
            });
            
            console.log(`✅ SUCCESS: ${response.status}`);
            console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...\n`);
            
        } catch (error) {
            console.log(`❌ ERROR: ${error.message}`);
            
            if (error.response) {
                console.log(`   Status: ${error.response.status}`);
                
                if (error.response.data) {
                    console.log(`   Data: ${JSON.stringify(error.response.data)}`);
                }
                
                // If 404, check the actual route
                if (error.response.status === 404) {
                    console.log('\n🔍 404 means: The route DOES NOT EXIST on backend!');
                    console.log('Check if your backend has this route:');
                    console.log(`   GET /api/workspaces/freelancer/:workspaceId`);
                }
                
                // If 401, token issue
                if (error.response.status === 401) {
                    console.log('\n🔍 401 means: Token not accepted!');
                    console.log('The backend rejected the token. Check auth middleware.');
                }
            }
            console.log('');
        }
    }
}

directTest();