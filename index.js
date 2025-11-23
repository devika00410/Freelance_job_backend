const express = require('express');
require('dotenv').config();

const connectDB = require('./Config/db');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:5173', 
  credentials: true
}));

connectDB().then(() => {
    console.log('Database connected successfully');
}).catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
});

const { globalErrorHandler } = require('./Middlewares/validationMiddleware');

app.use('/api/auth', require('./Routes/authRoute')); 
app.use('/api/jobs', require('./Routes/jobRoutes')); 
app.use('/api/client', require('./Routes/clientRoute'));
app.use('/api/match', require('./Routes/matchRoute'));

app.use('/api/workspace', require('./Routes/workspaceRoutes'));
app.use('/api/chat', require('./Routes/chatRoutes'));
app.use('/api/milestones', require('./Routes/milestoneRoutes'));
app.use('/api/video-calls', require('./Routes/videoCallRoutes'));
app.use('/api/notifications', require('./Routes/notificationRoutes'));
app.use('/api/files', require('./Routes/fileRoutes'));
app.use('/api/reports', require('./Routes/reportRoutes'));

app.use('/api/freelancer', require('./Routes/freelancerRoutes'));
app.use('/api/proposals', require('./Routes/proposalRoute'));


// Change these lines:
const clientAnalyticsRoutes = require('./Routes/clientAnalyticsFixed');        
const freelancerAnalyticsRoutes = require('./Routes/freelancerAnalyticsFixed'); 

app.use('/api/client/analytics', clientAnalyticsRoutes);
app.use('/api/freelancer/analytics', freelancerAnalyticsRoutes);


const previousFreelancersRoutes = require('./Routes/previousFreelancersRoutes');

app.use('/api/previous-freelancers', previousFreelancersRoutes);


// Admin routes
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Basic test working', 
        time: new Date()
    });
});

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "Freelance job platform API is running!",
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is healthy",
        timestamp: new Date().toISOString(),
        database: "Connected", 
        environment: process.env.NODE_ENV || 'development'
    });
});

app.use('*all', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

app.use(globalErrorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database: Freelumo_platform`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});