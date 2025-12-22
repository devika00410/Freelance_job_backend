require('dotenv').config();
const connectDB = require('./Config/db');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- CORS - SIMPLIFIED FOR SINGLE PORT ----------
app.use(cors({
    origin: [
        'https://freelance-job-frontend.onrender.com', // Your production frontend
        'http://localhost:5173', // Single dev port
        'http://localhost:3000'  // Backend port
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ---------- Connect to MongoDB ----------
connectDB().then(() => {
    console.log('✅ Database connected successfully');
}).catch(err => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
});

// ---------- Routes ----------
app.use('/api/auth', require('./Routes/authRoute'));
app.use('/api/jobs', require('./Routes/jobRoutes'));
app.use('/api/client', require('./Routes/clientRoute'));
app.use('/api/match', require('./Routes/matchRoute'));
app.use('/api/contracts', require('./Routes/contractRoutes'));
app.use('/api/workspaces', require('./Routes/workspaceRoutes'));
app.use('/api/chat', require('./Routes/chatRoutes'));
app.use('/api/milestones', require('./Routes/milestoneRoutes'));
app.use('/api/video-calls', require('./Routes/videoCallRoutes'));
app.use('/api/notifications', require('./Routes/notificationRoutes'));
app.use('/api/files', require('./Routes/fileRoutes'));
app.use('/api/reports', require('./Routes/reportRoutes'));
app.use('/api/freelancer', require('./Routes/freelancerRoutes'));
app.use('/api/proposals', require('./Routes/proposalRoute'));
app.use('/api/payments', require('./Routes/paymentRoutes'));
app.use('/api/transactions', require('./Routes/transactionRoutes'));
app.use('/uploads', express.static('uploads'));
app.use('/api/upload', require('./Routes/uploadRoutes'));
app.use('/api/subscriptions', require('./Routes/subscriptionRoutes'));
app.use('/api/public', require('./Routes/publicProfileRoutes'));
app.use('/api/admin', require('./Routes/adminRoutes'));
app.use('/api/contacts', require('./Routes/contactRoutes'));

// Add remaining routes as needed...
const { globalErrorHandler } = require('./Middlewares/validationMiddleware');
app.use(globalErrorHandler);

// ---------- Health Check Endpoint ----------
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// ---------- Render-safe Server + Socket.IO ----------
const startServer = () => {
    const PORT = process.env.PORT || 3000;

    // 1. Create HTTP server
    const server = http.createServer(app);

    // 2. Initialize Socket.IO - SIMPLIFIED CORS
    const io = socketIo(server, {
        cors: {
            origin: [
                'https://freelance-job-frontend.onrender.com',
                'http://localhost:5173',
                'http://localhost:3000'
            ],
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization']
        }
    });

    // 3. Socket.IO connection events
    io.on('connection', (socket) => {
        console.log('✅ New client connected:', socket.id);

        // Authentication middleware for sockets
        socket.use(async (packet, next) => {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }
            
            try {
                // You need to implement verifyToken function
                // const user = await verifyToken(token);
                // socket.user = user;
                next();
            } catch (error) {
                next(new Error('Authentication failed'));
            }
        });

        // Join user's personal room
        socket.on('join_user_room', (userId) => {
            socket.join(`user_${userId}`);
            console.log(`👤 User ${userId} joined their room`);
        });

        // Join workspace
        socket.on('join_workspace', (workspaceId) => {
            socket.join(`workspace_${workspaceId}`);
            console.log(`🏢 User joined workspace ${workspaceId}`);
        });

        // Contract signed notification
        socket.on('contract_signed', (data) => {
            const otherUserId = data.otherUserId;
            if (otherUserId) {
                io.to(`user_${otherUserId}`).emit('contract_signed_update', data);
            }
        });

        // Workspace created notification
        socket.on('workspace_created', (data) => {
            if (data.clientId) {
                io.to(`user_${data.clientId}`).emit('workspace_ready', data);
            }
            if (data.freelancerId) {
                io.to(`user_${data.freelancerId}`).emit('workspace_ready', data);
            }
        });

        // Messaging
        socket.on('send_message', (messageData) => {
            const roomName = `workspace_${messageData.workspaceId}`;
            const messageWithId = {
                ...messageData,
                _id: Date.now().toString(),
                timestamp: new Date().toISOString()
            };
            
            io.to(roomName).emit('new_message', messageWithId);
        });

        // Typing indicator
        socket.on('typing', (data) => {
            const roomName = `workspace_${data.workspaceId}`;
            socket.to(roomName).emit('typing_indicator', data);
        });

        // Milestones
        socket.on('submit_milestone', (data) => {
            const roomName = `workspace_${data.workspaceId}`;
            io.to(roomName).emit('milestone_submitted', data);
        });

        socket.on('approve_milestone', (data) => {
            const roomName = `workspace_${data.workspaceId}`;
            io.to(roomName).emit('milestone_approved', data);
        });

        socket.on('request_milestone_changes', (data) => {
            const roomName = `workspace_${data.workspaceId}`;
            io.to(roomName).emit('milestone_changes_requested', data);
        });

        // Files
        socket.on('upload_file', (fileData) => {
            const roomName = `workspace_${fileData.workspaceId}`;
            io.to(roomName).emit('new_file', fileData);
        });

        // Payments
        socket.on('make_payment', (paymentData) => {
            const roomName = `workspace_${paymentData.workspaceId}`;
            io.to(roomName).emit('payment_made', paymentData);
            
            if (paymentData.milestoneId) {
                io.to(roomName).emit('milestone_paid', paymentData);
            }
        });

        // Meetings
        socket.on('schedule_meeting', (meetingData) => {
            const roomName = `workspace_${meetingData.workspaceId}`;
            io.to(roomName).emit('meeting_scheduled', meetingData);
        });

        socket.on('call_invitation', (callData) => {
            socket.to(`user_${callData.toUserId}`).emit('call_invitation', callData);
        });

        // Leave workspace
        socket.on('leave_workspace', ({ workspaceId, userId }) => {
            const roomName = `workspace_${workspaceId}`;
            socket.leave(roomName);
            
            socket.to(roomName).emit('user_offline', {
                userId: userId,
                timestamp: new Date().toISOString()
            });
        });

        // Disconnect
        socket.on('disconnect', () => {
            console.log('❌ Client disconnected:', socket.id);
        });
    });

    // 4. Make Socket.IO available in routes
    app.set('io', io);

    // 5. Start server
    server.listen(PORT, () => {
        console.log(`\n🎉 SERVER STARTED 🎉`);
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`📁 Database: Connected`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔌 Socket.IO ready on same port`);
        console.log(`🌐 Frontend should run on: http://localhost:5173`);
        console.log(`🔗 API available at: http://localhost:${PORT}/api`);
        console.log(`========================================\n`);

        // Save port to file (optional)
        fs.writeFileSync('.current-port', PORT.toString());
    });
};

startServer();