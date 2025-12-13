// debugWorkspace.js
require('dotenv').config();
const mongoose = require('mongoose');
const Workspace = require('./Models/Workspace');

const workspaceId = '6933a39a2ceb431598fd0f96';
const userId = 'your_user_id_here'; // Get this from your localStorage or database

async function debugWorkspace() {
  try {
    console.log('🔍 DEBUGGING WORKSPACE ISSUE');
    console.log('=============================');
    
    // 1. Connect to MongoDB
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/freelance-platform', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected');
    
    // 2. Try to find workspace by ID
    console.log('\n🔎 Looking for workspace by ID:', workspaceId);
    
    // Try findById first
    let workspace = await Workspace.findById(workspaceId)
      .populate('clientId', 'name email _id')
      .populate('freelancerId', 'name email _id');
    
    if (workspace) {
      console.log('✅ Workspace found using findById()');
    } else {
      // Try findOne with workspaceId field
      console.log('⚠️ Workspace not found by _id, trying workspaceId field...');
      workspace = await Workspace.findOne({ workspaceId: workspaceId })
        .populate('clientId', 'name email _id')
        .populate('freelancerId', 'name email _id');
      
      if (workspace) {
        console.log('✅ Workspace found using workspaceId field');
      } else {
        console.log('❌ Workspace not found in database');
        console.log('Checking all workspaces...');
        const allWorkspaces = await Workspace.find({}).limit(5);
        console.log('First 5 workspaces in DB:', allWorkspaces.map(w => ({
          _id: w._id,
          workspaceId: w.workspaceId,
          title: w.title || w.projectTitle,
          clientId: w.clientId,
          freelancerId: w.freelancerId
        })));
        return;
      }
    }
    
    // 3. Print workspace details
    console.log('\n📊 WORKSPACE DETAILS:');
    console.log('--------------------');
    console.log('Workspace ID:', workspace._id);
    console.log('Workspace ID (custom):', workspace.workspaceId);
    console.log('Title:', workspace.title || workspace.projectTitle);
    console.log('Status:', workspace.status);
    console.log('Client ID:', workspace.clientId?._id);
    console.log('Client Name:', workspace.clientId?.name);
    console.log('Freelancer ID:', workspace.freelancerId?._id);
    console.log('Freelancer Name:', workspace.freelancerId?.name);
    
    // 4. Check if user has access
    console.log('\n🔐 ACCESS CHECK:');
    console.log('----------------');
    console.log('User ID to check:', userId);
    
    const isClient = workspace.clientId && workspace.clientId._id.toString() === userId.toString();
    const isFreelancer = workspace.freelancerId && workspace.freelancerId._id.toString() === userId.toString();
    
    console.log('Is Client?', isClient);
    console.log('Is Freelancer?', isFreelancer);
    console.log('Has Access?', isClient || isFreelancer);
    
    // 5. Check the actual bug in your code
    console.log('\n🐛 BUG CHECK:');
    console.log('-------------');
    console.log('Checking workspace.client:', workspace.client);
    console.log('Checking workspace.clientId:', workspace.clientId);
    
    // This is the bug line from your code
    if (!workspace.client) {
      console.log('❌ workspace.client is undefined (THIS IS THE BUG!)');
      console.log('You should use workspace.clientId instead');
    }
    
    if (workspace.clientId) {
      console.log('✅ workspace.clientId exists');
      console.log('Type of workspace.clientId._id:', typeof workspace.clientId._id);
      console.log('workspace.clientId._id.toString():', workspace.clientId._id.toString());
    } else {
      console.log('❌ workspace.clientId is also undefined');
    }
    
    // 6. Test the actual condition from your code
    console.log('\n🧪 TESTING YOUR CODE CONDITION:');
    console.log('-------------------------------');
    
    const testUserId = userId || 'test-user-id';
    const buggyCondition = !workspace.client || workspace.client._id.toString() !== testUserId.toString();
    console.log('Buggy condition result:', buggyCondition);
    console.log('This will throw: Cannot read properties of undefined (reading "_id")');
    
    // 7. Show the correct condition
    console.log('\n✅ CORRECT CONDITION SHOULD BE:');
    console.log('--------------------------------');
    if (workspace.clientId) {
      const correctCondition = !workspace.clientId || workspace.clientId._id.toString() !== testUserId.toString();
      console.log('Correct condition:', correctCondition);
      console.log('Use: workspace.clientId (not workspace.client)');
    }
    
  } catch (error) {
    console.error('🔥 DEBUG ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB disconnected');
    console.log('=====================');
  }
}

// Run the debug function
debugWorkspace();