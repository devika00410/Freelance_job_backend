const express= require('express')
require('dotenv').config();

const connectDB=require('./Config/db')
const app=express()

app.use(express.json)

// Basic route
app.get('/',(req,res)=>{
    res.json({
        success:true,
        message:"Freelance job platform API is running!",
        timestamp:new Date().toISOString()
    })
})

// Health check point

app.get('/health',(req,res)=>{
    res.status(200).json({
        success:true, message:"Server is healthy",
        timestamp:new Date().toISOString() 
    })
})

// Handles undefined routes
app.use((req,res,next)=>{
    res.status(404).json({
success:false,
message:`Route${req.originalUrl} not found`
    })
})

const PORT =process.env.PORT || 5000

// Connect to database and then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(` Server running on port ${PORT}`);
    console.log(` Database: Freelumo_platform`);
    console.log(` Environment: ${process.env.NODE_ENV}`);
    console.log(` Health check: http://localhost:${PORT}/health`);
  });
}).catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});