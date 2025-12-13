// quickCheck.js
require('dotenv').config();
const mongoose = require('mongoose');

async function quickCheck() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    
    // Direct MongoDB query (no Mongoose models)
    const workspace = await db.collection('workspaces').findOne({
      $or: [
        { _id: new mongoose.Types.ObjectId('6933a39a2ceb431598fd0f96') },
        { workspaceId: '6933a39a2ceb431598fd0f96' }
      ]
    });
    
    console.log('Direct MongoDB query result:', workspace);
    
    if (workspace) {
      console.log('\n✅ Workspace exists!');
      console.log('Fields:', Object.keys(workspace));
      console.log('clientId type:', typeof workspace.clientId);
      console.log('clientId value:', workspace.clientId);
    } else {
      console.log('❌ No workspace found with that ID');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

quickCheck();