// checkMongo.js
require('dotenv').config();
const mongoose = require('mongoose');

async function checkDatabase() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const Workspace = mongoose.model('Workspace');
  
  // Check if workspace exists
  const workspace = await Workspace.findOne({ 
    $or: [
      { _id: '6933a39a2ceb431598fd0f96' },
      { workspaceId: '6933a39a2ceb431598fd0f96' }
    ]
  });
  
  console.log('Workspace found:', workspace);
  
  if (workspace) {
    console.log('\n📋 Workspace Schema:');
    console.log(Object.keys(workspace.toObject()));
    
    console.log('\n🔍 Checking clientId field:');
    console.log('clientId exists?', 'clientId' in workspace);
    console.log('clientId value:', workspace.clientId);
    console.log('Type of clientId:', typeof workspace.clientId);
  }
  
  await mongoose.disconnect();
}

checkDatabase().catch(console.error);