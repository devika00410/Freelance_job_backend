require('dotenv').config();
const connectDB = require('./Config/db');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- CORS ----------
app.use(cors({
    origin: [
        'https://freelance-job-frontend.onrender.com',
        'http://localhost:5173', 
        'http://localhost:5174',
        'http://localhost:3000',  
        'http://localhost:10000'  
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

// Add remaining routes as needed...
const { globalErrorHandler } = require('./Middlewares/validationMiddleware');
app.use(globalErrorHandler);

// ---------- Render-safe Server + Socket.IO ----------
const startServer = () => {
    const PORT = process.env.PORT || 3000;

    const server = http.createServer(app);

    const io = socketIo(server, {
        cors: {
            origin: [
                'https://freelance-job-frontend.onrender.com',
                'http://localhost:5173', 
                'http://localhost:5174',
                'http://localhost:3000',
                'http://localhost:10000'
            ],
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization']
        }
    });

    io.on('connection', (socket) => {
        console.log('✅ New client connected:', socket.id);

        socket.on('join_user_room', (userId) => {
            socket.join(userId);
            console.log(`👤 User ${userId} joined their room`);
        });

        socket.on('join_workspace', (workspaceId) => {
            socket.join(workspaceId);
            console.log(`🏢 User joined workspace ${workspaceId}`);
        });

        socket.on('contract_signed', (data) => {
            const otherUserId = data.otherUserId;
            if (otherUserId) io.to(otherUserId).emit('contract_signed_update', data);
        });

        socket.on('workspace_created', (data) => {
            if (data.clientId) io.to(data.clientId).emit('workspace_ready', data);
            if (data.freelancerId) io.to(data.freelancerId).emit('workspace_ready', data);
        });

        socket.on('disconnect', () => {
            console.log('❌ Client disconnected:', socket.id);
        });
    });

    app.set('io', io);

    server.listen(PORT, () => {
        console.log(`\n🎉 SERVER STARTED 🎉`);
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`📁 Database: Connected`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔌 Socket.IO ready on same port`);
        console.log(`========================================\n`);

        fs.writeFileSync('.current-port', PORT.toString());
    });
};

startServer();