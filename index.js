const express = require('express');
require('dotenv').config();

const connectDB = require('./Config/db');
const app = express();


app.use(express.json());

app.use(express.json())




app.get('/api/test', (req, res) => {
    console.log('✅ Basic test route hit!')
    res.json({ message: 'Basic test working', time: new Date() })
})

const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:5173', 
  credentials: true
}));

// Routes
const authRoute = require('./Routes/authRoute');
app.use('/api/auth', authRoute);

const clientRoute = require('./Routes/clientRoute')
app.use('/api/client', clientRoute);


const jobRoutes=require('./Routes/jobRoutes')
const proposalRoute = require('./Routes/proposalRoute')

app.use('/api/jobs', jobRoutes)
app.use('/api/proposals', proposalRoute)


// Basic route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "Freelance job platform API is running!",
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is healthy",
        timestamp: new Date().toISOString()
    });
});

// Handle undefined routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

app.use((error, req, res, next) => {
    console.error('🚨 Global Error Handler:', error);
    res.status(500).json({ 
        message: 'Internal server error',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
});


app.get('/test-models', async (req, res) => {
    try {
        const User = require('./Models/User');
        const Job = require('./Models/Job'); 
        const Proposal = require('./Models/Proposal');
        
        res.json({ 
            success: true, 
            message: 'All models loaded successfully',
            models: ['User', 'Job', 'Proposal']
        });
    } catch (error) {
        console.error('Model loading error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            message: 'Model loading failed'
        });
    }
});

const PORT = process.env.PORT || 5000;

// Connect to database and start server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🗄️ Database: Freelumo_platform`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`❤️ Health check: http://localhost:${PORT}/health`);
    });
}).catch(err => {
    console.error('❌ Failed to connect to database:', err);
    process.exit(1);
});