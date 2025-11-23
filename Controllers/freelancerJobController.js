const Job = require('../Models/Job');
const Proposal = require('../Models/Proposal');
const User = require('../Models/User');

const freelancerJobController = {
    // Browse all active jobs (with filters)
    browseJobs: async (req, res) => {
        try {
            console.log('1. Starting browseJobs function');
            const freelancerId = req.userId;
            const {
                page = 1,
                limit = 10,
                category,
                skills,
                minBudget,
                maxBudget,
                experienceLevel,
                projectType,
                search,
                sortBy = 'createdAt'
            } = req.query;

            console.log('2. Filters:', { category, skills, minBudget, maxBudget, search });

            // Base query for active jobs
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
                    { description: { $regex: search, $options: 'i' } },
                    { category: { $regex: search, $options: 'i' } }
                ];
            }

            // Sort options
            let sortOptions = {};
            switch (sortBy) {
                case 'budget_high':
                    sortOptions = { budget: -1 };
                    break;
                case 'budget_low':
                    sortOptions = { budget: 1 };
                    break;
                case 'deadline':
                    sortOptions = { deadline: 1 };
                    break;
                default:
                    sortOptions = { createdAt: -1 };
            }

            console.log('3. Final query:', query);

            const jobs = await Job.find(query)
                .populate('clientId', 'name companyName rating profilePicture createdAt')
                .sort(sortOptions)
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .select('title description budget currency category skillsRequired experienceLevel duration projectType proposalCount viewCount createdAt deadline clientId location');

            const totalJobs = await Job.countDocuments(query);

            // Check which jobs freelancer has already applied to
            const jobIds = jobs.map(job => job._id);
            const existingProposals = await Proposal.find({
                freelancerId: freelancerId,
                projectId: { $in: jobIds }
            }).select('projectId status');

            const proposalsMap = {};
            existingProposals.forEach(proposal => {
                proposalsMap[proposal.projectId] = proposal.status;
            });

            // Add application status to each job
            const jobsWithStatus = jobs.map(job => {
                const jobObj = job.toObject();
                jobObj.hasApplied = !!proposalsMap[job._id];
                jobObj.applicationStatus = proposalsMap[job._id] || 'not_applied';
                return jobObj;
            });

            console.log('4. Jobs found:', jobs.length);

            res.json({
                success: true,
                jobs: jobsWithStatus,
                totalPages: Math.ceil(totalJobs / limit),
                currentPage: parseInt(page),
                totalJobs,
                hasNextPage: page * limit < totalJobs,
                hasPrevPage: page > 1
            });

        } catch (error) {
            console.error('Browse jobs error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error fetching jobs',
                error: error.message
            });
        }
    },

    // Get single job details
    getJobDetails: async (req, res) => {
        try {
            console.log('1. Starting getJobDetails function');
            const freelancerId = req.userId;
            const { jobId } = req.params;

            console.log('2. Job ID:', jobId, 'Freelancer ID:', freelancerId);

            const job = await Job.findById(jobId)
                .populate('clientId', 'name companyName rating profilePicture createdAt totalProjects companySize')
                .populate('hiredFreelancer', 'name profilePicture rating');

            if (!job) {
                return res.status(404).json({
                    success: false,
                    message: 'Job not found'
                });
            }

            // Increment view count
            job.viewCount += 1;
            await job.save();

            // Check if freelancer has already applied
            const existingProposal = await Proposal.findOne({
                projectId: jobId,
                freelancerId: freelancerId
            });

            const jobWithStatus = job.toObject();
            jobWithStatus.hasApplied = !!existingProposal;
            jobWithStatus.applicationStatus = existingProposal ? existingProposal.status : 'not_applied';
            jobWithStatus.existingProposalId = existingProposal ? existingProposal._id : null;

            // Get similar jobs (same category)
            const similarJobs = await Job.find({
                category: job.category,
                _id: { $ne: jobId },
                status: 'active',
                hiringStatus: 'accepting_proposals'
            })
                .populate('clientId', 'name companyName rating')
                .limit(4)
                .select('title budget category skillsRequired duration proposalCount createdAt');

            console.log('3. Job details fetched successfully');

            res.json({
                success: true,
                job: jobWithStatus,
                similarJobs
            });

        } catch (error) {
            console.error('Get job details error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error fetching job details',
                error: error.message
            });
        }
    },

    // Search jobs with advanced filters
    searchJobs: async (req, res) => {
        try {
            console.log('1. Starting searchJobs function');
            const {
                query,
                category,
                skills,
                minBudget,
                maxBudget,
                experienceLevel,
                projectType,
                location,
                page = 1,
                limit = 10
            } = req.body;

            let searchQuery = {
                status: 'active',
                hiringStatus: 'accepting_proposals',
                deadline: { $gt: new Date() }
            };

            // Text search
            if (query) {
                searchQuery.$or = [
                    { title: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } },
                    { category: { $regex: query, $options: 'i' } }
                ];
            }

            // Filter by category
            if (category) searchQuery.category = category;

            // Filter by skills
            if (skills && skills.length > 0) {
                searchQuery.skillsRequired = { $in: skills };
            }

            // Filter by budget
            if (minBudget || maxBudget) {
                searchQuery.budget = {};
                if (minBudget) searchQuery.budget.$gte = parseInt(minBudget);
                if (maxBudget) searchQuery.budget.$lte = parseInt(maxBudget);
            }

            // Filter by experience level
            if (experienceLevel) searchQuery.experienceLevel = experienceLevel;

            // Filter by project type
            if (projectType) searchQuery.projectType = projectType;

            // Filter by location
            if (location) {
                searchQuery.$or = [
                    { location: { $regex: location, $options: 'i' } },
                    { 'clientId.location': { $regex: location, $options: 'i' } }
                ];
            }

            console.log('2. Search query:', searchQuery);

            const jobs = await Job.find(searchQuery)
                .populate('clientId', 'name companyName rating profilePicture location')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .select('title description budget currency category skillsRequired experienceLevel duration projectType proposalCount viewCount createdAt deadline clientId location');

            const totalJobs = await Job.countDocuments(searchQuery);

            console.log('3. Search results:', jobs.length);

            res.json({
                success: true,
                jobs,
                totalPages: Math.ceil(totalJobs / limit),
                currentPage: parseInt(page),
                totalJobs,
                filters: {
                    query,
                    category,
                    skills,
                    minBudget,
                    maxBudget,
                    experienceLevel,
                    projectType,
                    location
                }
            });

        } catch (error) {
            console.error('Search jobs error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error searching jobs',
                error: error.message
            });
        }
    },

    // Get job categories and filters
    getJobFilters: async (req, res) => {
        try {
            console.log('1. Starting getJobFilters function');

            // Get distinct categories
            const categories = await Job.distinct('category', {
                status: 'active',
                hiringStatus: 'accepting_proposals'
            });

            // Get distinct skills
            const allSkills = await Job.distinct('skillsRequired', {
                status: 'active',
                hiringStatus: 'accepting_proposals'
            });

            // Get budget ranges
            const budgetStats = await Job.aggregate([
                {
                    $match: {
                        status: 'active',
                        hiringStatus: 'accepting_proposals'
                    }
                },
                {
                    $group: {
                        _id: null,
                        minBudget: { $min: '$budget' },
                        maxBudget: { $max: '$budget' },
                        avgBudget: { $avg: '$budget' }
                    }
                }
            ]);

            // Get experience levels
            const experienceLevels = await Job.distinct('experienceLevel', {
                status: 'active',
                hiringStatus: 'accepting_proposals'
            });

            // Get project types
            const projectTypes = await Job.distinct('projectType', {
                status: 'active',
                hiringStatus: 'accepting_proposals'
            });

            console.log('2. Filters fetched successfully');

            res.json({
                success: true,
                filters: {
                    categories: categories.filter(cat => cat), 
                    skills: allSkills.filter(skill => skill), 
                    budgetRange: budgetStats[0] || { minBudget: 0, maxBudget: 100000, avgBudget: 25000 },
                    experienceLevels: experienceLevels.filter(level => level),
                    projectTypes: projectTypes.filter(type => type)
                }
            });

        } catch (error) {
            console.error('Get job filters error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error fetching job filters',
                error: error.message
            });
        }
    },

    // Get recommended jobs for freelancer
    getRecommendedJobs: async (req, res) => {
        try {
            console.log('1. Starting getRecommendedJobs function');
            const freelancerId = req.userId;

            // Get freelancer's skills from profile
            const freelancer = await User.findById(freelancerId).select('skills');
            const freelancerSkills = freelancer?.skills || [];

            let recommendedQuery = {
                status: 'active',
                hiringStatus: 'accepting_proposals',
                deadline: { $gt: new Date() }
            };

            // If freelancer has skills, recommend jobs matching their skills

            if (freelancerSkills.length > 0) {
                recommendedQuery.skillsRequired = { $in: freelancerSkills };
            }

            const recommendedJobs = await Job.find(recommendedQuery)
                .populate('clientId', 'name companyName rating profilePicture')
                .sort({ proposalCount: 1, createdAt: -1 }) 
                .limit(6)
                .select('title description budget category skillsRequired duration proposalCount createdAt');

            // If no skill-based recommendations, get latest jobs
            
            if (recommendedJobs.length === 0) {
                const latestJobs = await Job.find({
                    status: 'active',
                    hiringStatus: 'accepting_proposals',
                    deadline: { $gt: new Date() }
                })
                    .populate('clientId', 'name companyName rating profilePicture')
                    .sort({ createdAt: -1 })
                    .limit(6)
                    .select('title description budget category skillsRequired duration proposalCount createdAt');

                console.log('2. Using latest jobs as recommendations');
                return res.json({
                    success: true,
                    jobs: latestJobs,
                    recommendationType: 'latest'
                });
            }

            console.log('2. Skill-based recommendations found:', recommendedJobs.length);

            res.json({
                success: true,
                jobs: recommendedJobs,
                recommendationType: 'skill_based'
            });

        } catch (error) {
            console.error(' Get recommended jobs error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error fetching recommended jobs',
                error: error.message
            });
        }
    }
};

module.exports = freelancerJobController;