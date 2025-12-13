const Job =require('../Models/Job')
const Proposal=require('../Models/Proposal')
const User = require('../Models/User')

const jobController={
    // create new job
createJob: async (req, res) => {
    try {
        const clientId = req.userId;
        const jobData = req.body;
        
        // ✅ Get the client user's ACTUAL data
        const User = require('../Models/User');
        const clientUser = await User.findById(clientId);
        
        if (!clientUser) {
            return res.status(404).json({
                success: false,
                message: "Client user not found"
            });
        }
        
        // ✅ Add client information to job data
        const enhancedJobData = {
            ...jobData,
            clientId: clientId,
            // ✅ CRITICAL: Save client name and info
            clientName: clientUser.name || 'Client',
            clientEmail: clientUser.email || '',
            clientCompany: clientUser.companyName || '',
            clientRating: clientUser.rating || 0,
            // Ensure required fields
            status: 'active',
            hiringStatus: 'accepting_proposals',
            proposalCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        console.log('✅ Creating job with client info:', {
            clientName: enhancedJobData.clientName,
            clientId: enhancedJobData.clientId
        });
        
        const job = new Job(enhancedJobData);
        await job.save();
        
        res.status(201).json({
            success: true,
            message: "Job created successfully",
            job: {
                _id: job._id,
                title: job.title,
                budget: job.budget,
                clientName: job.clientName, 
                createdAt: job.createdAt
            }
        });
        
    } catch (error) {
        console.error("❌ Create job error:", error);
        res.status(500).json({
            success: false,
            message: "Server error creating job",
            error: error.message
        });
    }
},
    
    getAllJobs: async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            category,
            skills,
            minBudget,
            maxBudget,
            experienceLevel,
            projectType,
            search
        } = req.query;

        let query = {
            status: 'active',
            hiringStatus: 'accepting_proposals',
            deadline: { $gt: new Date() }
        };

        // Apply filters
        if (category) query.category = category;
        if (experienceLevel) query.experienceLevel = experienceLevel;
        if (projectType) query.projectType = projectType;

        if (skills) {
            const skillsArray = skills.split(',');
            query.skillsRequired = { $in: skillsArray };
        }
        if (minBudget || maxBudget) {
            query.budget = {};
            if (minBudget) query.budget.$gte = parseInt(minBudget);
            if (maxBudget) query.budget.$lte = parseInt(maxBudget);
        }
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const jobs = await Job.find(query)
            .populate('clientId', 'name companyName rating profilePicture') 
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
  
.select('title description budget category skillsRequired experienceLevel duration projectType proposalCount viewCount createdAt deadline clientId clientName clientRating location attachments')
            .lean(); 

        //  Debug: Check what data is actually being returned
        if (jobs.length > 0) {
            console.log('First job client data:', {
                clientId: jobs[0].clientId,
                clientName: jobs[0].clientName,
                hasClientIdName: jobs[0].clientId?.name,
                hasClientNameField: 'clientName' in jobs[0]
            });
        }

        const totalJobs = await Job.countDocuments(query);

        res.json({
            success: true, // ✅ Always include success flag
            jobs,
            totalPages: Math.ceil(totalJobs / limit),
            currentPage: parseInt(page),
            totalJobs
        });

    } catch (error) {
        console.error('Get jobs error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching jobs',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
},
    // get single job details
    getJobById:async(req,res)=>{
        try{
            const{jobId} =req.params;

            const job=await Job.findById(jobId)
            .populate('clientId','name companyName rating profilePicture createdAt')
        .populate('hiredFreelancer','name profilePicture rating');

        if(!job){
            return res.status(404).json({message:'Job not found'})
        }
        job.viewCount+=1;
        await job.save();

        res.json(job)
        } catch(error){
            res.status(500).json({message:'Server error fetching job details'})
        }
    },
    // Update job

    updateJob: async (req, res) => {
    try {
        console.log('1. Starting updateJob function');
        const clientId = req.userId;
        const { jobId } = req.params;
        const updateData = req.body;
        
        console.log('2. Client ID:', clientId);
        console.log('3. Job ID:', jobId);
        console.log('4. Update data:', updateData);

        // Find job and verify ownership
        console.log('5. Finding job...');
        const job = await Job.findOne({ _id: jobId, clientId });
        console.log('6. Job found:', job);

        if (!job) {
            return res.status(404).json({ message: 'Job not found or access denied' });
        }

        // prevent updating certain fields
        delete updateData.clientId;
        delete updateData._id;
        delete updateData.proposalCount;
        delete updateData.viewCount;

        console.log('7. Final update data:', updateData);

        const updatedJob = await Job.findByIdAndUpdate(
            jobId,
            updateData,
            { new: true, runValidators: true }
        ).populate('clientId', 'name companyName');

        console.log('8. Job updated successfully:', updatedJob);

        res.json({
            message: 'Job updated successfully',
            job: updatedJob
        });

    } catch (error) {
        console.error('❌ Update job error:', error);
        res.status(500).json({ 
            message: 'Server error updating job',
            error: error.message 
        });
    }
},
    // Delete Job

    deleteJob: async (req,res)=>{
        try{
            const clientId =req.user.id;
            const {jobId} =req.params;

            const job = await Job.findOne({_id:jobId,clientId});
            if(!job){
                return res.status(404).json({message:'Job not found or access denied'})
            }

            const hasAcceptedProposals = await Proposal.exists({
                projectId:jobId,
                status:'accepted'
            });

            if(hasAcceptedProposals){
                return res.status(400).json({
                    message:'Cannot delete job with accepted proposals'
                })
            }

            // Delete all proposals for this job

            await Proposal.deleteMany({projectId:jobId});

            // delete the job

            await Job.findByIdAndDelete(jobId);

            res.json({message:"Job deleted successfully"})
        } catch(error){
            res.status(500).json({message:'Server error deleting job'})
        }
    },

    // Get job proposals

    getJobProposals: async (req,res)=>{
        try{
            const clientId = req.user.id;
            const {jobId} =req.params;
            const {status,page=1,limit=10} =req.query;

            // verify job ownership
              const job = await Job.findOne({ _id: jobId, clientId });
      if (!job) {
        return res.status(404).json({ message: 'Job not found or access denied' });
      }

      let query = { projectId: jobId };
      if (status && status !== 'all') {
        query.status = status;
      }

      const proposals = await Proposal.find(query)
        .populate('freelancerId', 'name profilePicture rating skills bio completedProjects')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

        const totalProposals = await Proposal.countDocuments(query);
        res.json({
            proposals,
            totalProposals:Math.ceil(totalProposals/limit),
            currentPage:page,
            totalProposals

        });

        } catch(error){
            res.status(500).json({message:'Server error fetching job proposals'})
        }
    },

    // Update Job Status

    updateJobStatus: async (req,res)=>{
        try{
            const clientId = req.user.id;
            const {jobId} =req.params;
            const {status} =req.body;

            const job = await Job.findOne({_id:jobId,clientId});

            if(!job){
                return res.status(404).json({message:'Job not found or access denied'})
            }
            
            job.status = status;
            await job.save();

            res.json({
                message:"Job status updated successfully",
                job
            })
        } catch(error){
            res.status(500).json({message:"Server error updating job status"})
        }
    },

    // Close Job (Stop accepting proposals)

    closeJob:async (req,res)=>{
        try{
const clientId = req.user.id;
const{jobId} =req.params;

const job = await Job.findOne({_id:jobId,clientId});

if(!job){
    return res.json(404).json({message:"Job not found or access denied"})
}

job.hiringStatus = 'closed'
await job.save();

res.json({message:"Job closed successfully"})

        } catch(error){
            res.status(500).json({message:"Server error closing job"})
        }
    },

    // Get clients job status

    getClientJobStats: async (req,res)=>{
        try{
            const clientId =req.user.id;
           
      const stats = await Job.aggregate([
        { $match: { clientId } },
        {
          $group: {
            _id: null,
            totalJobs: { $sum: 1 },
            activeJobs: { 
              $sum: { 
                $cond: [{ $eq: ['$status', 'active'] }, 1, 0] 
              } 
            },
            completedJobs: { 
              $sum: { 
                $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] 
              } 
            },
            totalBudget: { $sum: '$budget' },
            totalProposals: { $sum: '$proposalCount' },
            totalViews: { $sum: '$viewCount' }
            }
        }
      ]);

      const statusDistribution = await Job.aggregate([
        { $match: { clientId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      res.json({
        overview: stats[0] || {
          totalJobs: 0,
          activeJobs: 0,
          completedJobs: 0,
          totalBudget: 0,
          totalProposals: 0,
          totalViews: 0
        },
        statusDistribution
      });
        }
         catch (error) {
      res.status(500).json({ message: 'Server error fetching job stats' });
    }
    }
}

module.exports = jobController;