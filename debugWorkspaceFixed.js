// debugWorkspace-fixed.js
require('dotenv').config();
const mongoose = require('mongoose');

// Load ALL models BEFORE using them
require('./Models/User'); // Make sure this file exists and exports properly
require('./Models/Workspace');
require('./Models/Milestone');
// Add other models as needed

const Workspace = mongoose.model('Workspace');

const workspaceId = '6933a39a2ceb431598fd0f96';
const userId = 'your_user_id_here'; // Replace with actual user ID

async function debugWorkspace() {
  try {
    console.log('🔍 DEBUGGING WORKSPACE ISSUE');
    console.log('=============================');
    
    // 1. Connect to MongoDB
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/freelance-platform');
    console.log('✅ MongoDB connected');
    
    // 2. Check if collection exists
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📊 Available collections:');
    collections.forEach(col => console.log('  -', col.name));
    
    // 3. Try to find workspace WITHOUT populate first
    console.log('\n🔎 Looking for workspace (without populate):', workspaceId);
    
    let workspace = await Workspace.findById(workspaceId).lean();
    
    if (!workspace) {
      console.log('⚠️ Not found by _id, trying workspaceId field...');
      workspace = await Workspace.findOne({ workspaceId: workspaceId }).lean();
    }
    
    if (!workspace) {
      console.log('❌ Workspace not found');
      console.log('\n📋 Checking first 5 workspaces:');
      const allWorkspaces = await Workspace.find({}).limit(5).lean();
      allWorkspaces.forEach((w, i) => {
        console.log(`${i + 1}. _id: ${w._id}, workspaceId: ${w.workspaceId}, title: ${w.title || w.projectTitle}`);
        console.log(`   clientId: ${w.clientId}, freelancerId: ${w.freelancerId}`);
      });
      return;
    }
    
    // 4. Show workspace details
    console.log('\n✅ WORKSPACE FOUND:');
    console.log('-------------------');
    console.log('_id:', workspace._id);
    console.log('workspaceId:', workspace.workspaceId);
    console.log('Title:', workspace.title || workspace.projectTitle);
    console.log('Status:', workspace.status);
    console.log('clientId:', workspace.clientId);
    console.log('freelancerId:', workspace.freelancerId);
    
    // 5. Check the actual bug
    console.log('\n🐛 CHECKING THE BUG:');
    console.log('--------------------');
    console.log('workspace.client exists?', 'client' in workspace ? 'YES' : 'NO');
    console.log('workspace.clientId exists?', 'clientId' in workspace ? 'YES' : 'NO');
    
    // This is what's causing your error
    console.log('\n🧪 Testing the problematic code:');
    if (!workspace.client) {
      console.log('❌ workspace.client is undefined');
    }
    
    // This is what you SHOULD use
    if (workspace.clientId) {
      console.log('✅ workspace.clientId exists:', workspace.clientId);
    } else {
      console.log('❌ workspace.clientId is also undefined or null');
    }
    
  } catch (error) {
    console.error('🔥 DEBUG ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 MongoDB disconnected');
    }
    console.log('=====================');
  }
}

debugWorkspace();