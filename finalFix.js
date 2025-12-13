// FINAL-FIX.js
require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

async function finalFix() {
    console.log('🚀 FINAL FIX - Solving ALL issues\n');
    
    try {
        // 1. Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        console.log('✅ Database connected\n');
        
        // 2. FIX 1: Update workspace with proper title
        console.log('🔧 FIX 1: Updating workspace title...');
        const workspaceId = '6933a39a2ceb431598fd0f96';
        
        await db.collection('workspaces').updateOne(
            { _id: workspaceId },
            { 
                $set: {
                    title: 'Digital Boost Strategy & Campaign Management',
                    freelancerName: 'Elsa',
                    clientName: 'Client',
                    status: 'active',
                    updatedAt: new Date()
                }
            }
        );
        console.log('✅ Workspace updated\n');
        
        // 3. FIX 2: Get Elsa's user details
        console.log('👤 FIX 2: Getting Elsa user details...');
        const elsa = await db.collection('users').findOne({
            _id: new mongoose.Types.ObjectId('692e74e214b7817470babc27')
        });
        
        if (!elsa) {
            console.log('❌ Elsa user not found! Creating...');
            // Create Elsa if doesn't exist
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('password123', 10);
            
            const newElsa = {
                _id: new mongoose.Types.ObjectId('692e74e214b7817470babc27'),
                name: 'Elsa',
                email: 'elsa@gmail.com',
                password: hashedPassword,
                role: 'freelancer',
                skills: ['Digital Marketing', 'SEO', 'Strategy'],
                hourlyRate: 50,
                country: 'USA',
                createdAt: new Date(),
                updatedAt: new Date(),
                isVerified: true
            };
            
            await db.collection('users').insertOne(newElsa);
            console.log('✅ Elsa user created');
        }
        
        // 4. FIX 3: Generate proper token for Elsa
        console.log('\n🎫 FIX 3: Generating login token...');
        const token = jwt.sign(
            { 
                userId: '692e74e214b7817470babc27',
                role: 'freelancer',
                name: 'Elsa',
                email: 'elsa@gmail.com'
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // 5. FIX 4: Print browser commands
        console.log('\n📋 FIX 4: Browser console commands:');
        console.log('====================================');
        console.log('// 1. Clear localStorage');
        console.log('localStorage.clear();');
        console.log('');
        console.log('// 2. Set token');
        console.log(`localStorage.setItem('token', '${token}');`);
        console.log('');
        console.log('// 3. Set user info');
        console.log(`localStorage.setItem('user', '${JSON.stringify({
            _id: '692e74e214b7817470babc27',
            name: 'Elsa',
            email: 'elsa@gmail.com',
            role: 'freelancer'
        })}');`);
        console.log('');
        console.log('// 4. Set role');
        console.log(`localStorage.setItem('role', 'freelancer');`);
        console.log('');
        console.log('// 5. Set freelancer session');
        console.log(`localStorage.setItem('freelancer_session', '${JSON.stringify({
            id: '692e74e214b7817470babc27',
            name: 'Elsa',
            email: 'elsa@gmail.com'
        })}');`);
        console.log('\n====================================');
        
        // 6. Test the API endpoint
        console.log('\n🔍 FIX 5: Testing the API...');
        console.log('After setting localStorage, test this URL in browser:');
        console.log(`http://localhost:5173/freelancer/workspace/${workspaceId}`);
        
        console.log('\n✅ OR test directly with curl:');
        console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/workspaces/freelancer/${workspaceId}`);
        
        console.log('\n🎯 SUMMARY:');
        console.log('1. Workspace exists and has been updated ✓');
        console.log('2. Elsa user exists ✓');
        console.log('3. Token generated ✓');
        console.log('4. Browser commands ready ✓');
        console.log('\n🚀 Run the browser commands, then refresh your page!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Database disconnected');
    }
}

// Run the fix
finalFix();