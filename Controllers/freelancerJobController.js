const Job = require('../Models/Job');
const Proposal = require('../Models/Proposal');
const User = require('../Models/User');


const freelancerJobController = {
    // In freelancerJobController.js
    browseJobs: async (req, res) => {
        try {
            console.log('🚀 === BROWSEJOBS FUNCTION START ===');
            console.log('👤 User ID:', req.userId);
            console.log('👤 User Role:', req.userRole);

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
                sortBy = 'createdAt',
                matchSkills = 'true'
            } = req.query;

            console.log('📋 Query parameters received:', {
                page, limit, category, skills, minBudget, maxBudget,
                experienceLevel, projectType, search, sortBy, matchSkills
            });

            // Test database connection first
            console.log('🗄️ Testing database connection...');
            try {
                const totalJobCount = await Job.countDocuments({});
                console.log('🗄️ Total jobs in database:', totalJobCount);

                const activeJobCount = await Job.countDocuments({ status: 'active' });
                console.log('🗄️ Active jobs in database:', activeJobCount);
            } catch (dbError) {
                console.error('❌ Database connection error:', dbError);
                throw new Error('Database connection failed: ' + dbError.message);
            }

            // Base query for active jobs
            let query = {
                status: 'active',
                deadline: { $gt: new Date() }
            };

            console.log('🔍 Base query created:', query);

            // Apply search filter
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { category: { $regex: search, $options: 'i' } },
                    { skillsRequired: { $regex: search, $options: 'i' } }
                ];
                console.log('🔍 Search filter applied for:', search);
            }

            // Apply category filter
            if (category) {
                query.category = category;
                console.log('🔍 Category filter applied:', category);
            }

            // Apply skills filter
            if (skills) {
                const skillsArray = skills.split(',');
                query.skillsRequired = { $in: skillsArray };
                console.log('🔍 Skills filter applied:', skillsArray);
            }

            // Apply budget filter
            if (minBudget || maxBudget) {
                query.budget = {};
                if (minBudget) {
                    query.budget.$gte = parseInt(minBudget);
                    console.log('🔍 Min budget filter:', minBudget);
                }
                if (maxBudget) {
                    query.budget.$lte = parseInt(maxBudget);
                    console.log('🔍 Max budget filter:', maxBudget);
                }
            }

            // Apply experience level filter
            if (experienceLevel) {
                query.experienceLevel = experienceLevel;
                console.log('🔍 Experience level filter:', experienceLevel);
            }

            // Apply project type filter
            if (projectType) {
                query.projectType = projectType;
                console.log('🔍 Project type filter:', projectType);
            }

            console.log('🎯 Final query before execution:', JSON.stringify(query, null, 2));

            // Build the database query
            console.log('📥 Building database query...');
            let dbQuery = Job.find(query);

            // Apply population
            console.log('👥 Applying client population...');
            dbQuery = dbQuery.populate('clientId', 'name companyName rating profilePicture createdAt totalProjects');

            // Apply sorting
            console.log('📊 Applying sorting...');
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
            dbQuery = dbQuery.sort(sortOptions);

            // Apply pagination
            console.log('📄 Applying pagination...');
            const skip = (page - 1) * limit;
            dbQuery = dbQuery.limit(limit * 1).skip(skip);

            // Select specific fields
            console.log('🎯 Selecting fields...');
            dbQuery = dbQuery.select('title description budget currency category skillsRequired experienceLevel duration projectType proposalCount viewCount createdAt deadline clientId location attachments');

            // Execute the query
            console.log('⚡ Executing database query...');
            // In browseJobs() function, update the job query:
            const jobs = await Job.find(query)
                .populate('clientId', 'name companyName profilePicture rating') // ADD THIS LINE
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            console.log('✅ Database query successful');
            console.log('📊 Jobs found:', jobs.length);

            if (jobs.length > 0) {
                console.log('📝 Job titles:', jobs.map(job => job.title));
                console.log('🏷️ Job categories:', jobs.map(job => job.category));
            } else {
                console.log('📝 No jobs found with current filters');
            }

            // Get total count for pagination
            console.log('🔢 Counting total jobs...');
            const totalJobs = await Job.countDocuments(query);
            console.log('🔢 Total jobs matching query:', totalJobs);

            // Check if freelancer has applied to any jobs
            console.log('📋 Checking existing proposals...');
            const jobIds = jobs.map(job => job._id);
            const existingProposals = await Proposal.find({
                freelancerId: freelancerId,
                projectId: { $in: jobIds }
            }).select('projectId status');

            console.log('📋 Existing proposals found:', existingProposals.length);

            const proposalsMap = {};
            existingProposals.forEach(proposal => {
                proposalsMap[proposal.projectId.toString()] = proposal.status;
            });

            // Add application status to each job
            console.log('🎨 Adding application status to jobs...');
            const jobsWithStatus = jobs.map(job => {
                const jobObj = job.toObject();
                jobObj.hasApplied = !!proposalsMap[job._id.toString()];
                jobObj.applicationStatus = proposalsMap[job._id.toString()] || 'not_applied';
                return jobObj;
            });

            console.log('✅ Final jobs with status:', jobsWithStatus.length);

            // Send successful response
            console.log('🚀 === BROWSEJOBS FUNCTION SUCCESS ===');
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
            console.error('❌ === BROWSEJOBS FUNCTION ERROR ===');
            console.error('❌ Error name:', error.name);
            console.error('❌ Error message:', error.message);
            console.error('❌ Error stack:', error.stack);

            // Log specific database errors
            if (error.name === 'CastError') {
                console.error('❌ Database CastError - Invalid ID format');
            }
            if (error.name === 'ValidationError') {
                console.error('❌ Database ValidationError:', error.errors);
            }
            if (error.name === 'MongoNetworkError') {
                console.error('❌ MongoDB Network Error - Connection issue');
            }

            res.status(500).json({
                success: false,
                message: 'Server error fetching jobs: ' + error.message,
                errorType: error.name
            });
        }
    }, 
    
    // Add this method to your freelancerJobController object, right before the closing brace
getJobMatchScore: async (req, res) => {
    try {
        console.log('1. Starting getJobMatchScore function');
        const freelancerId = req.userId || req.user.id;
        const { jobId } = req.params;

        console.log('2. Job ID:', jobId, 'Freelancer ID:', freelancerId);

        // Get the job
        const job = await Job.findById(jobId)
            .select('title category skillsRequired experienceLevel proposalCount createdAt');

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Get freelancer's profile
        const freelancer = await User.findById(freelancerId)
            .select('skills category experienceLevel');

        const freelancerSkills = freelancer?.skills || [];
        const freelancerCategory = freelancer?.category;
        const freelancerExperience = freelancer?.experienceLevel;

        console.log('3. Freelancer profile loaded:', {
            skillsCount: freelancerSkills.length,
            category: freelancerCategory,
            experience: freelancerExperience
        });

        // Calculate match score using the existing helper function
        const matchResult = calculateJobMatchScore(
            job,
            freelancerSkills,
            freelancerCategory,
            freelancerExperience
        );

        console.log('4. Match calculation complete:', {
            score: matchResult.score,
            skillMatchPercentage: matchResult.skillMatchPercentage,
            matchedSkillsCount: matchResult.matchedSkills.length
        });

        res.json({
            success: true,
            matchScore: {
                overallScore: matchResult.score,
                skillMatch: {
                    percentage: matchResult.skillMatchPercentage,
                    matchedSkills: matchResult.matchedSkills,
                    totalRequiredSkills: job.skillsRequired.length,
                    yourSkills: freelancerSkills
                },
                categoryMatch: freelancerCategory === job.category,
                experienceMatch: freelancerExperience === job.experienceLevel,
                breakdown: matchResult.breakdown,
                reasons: matchResult.reasons,
                recommendations: generateMatchRecommendations(matchResult, job, freelancerSkills)
            },
            job: {
                title: job.title,
                category: job.category,
                skillsRequired: job.skillsRequired,
                experienceLevel: job.experienceLevel,
                proposalCount: job.proposalCount,
                daysOld: Math.floor((new Date() - new Date(job.createdAt)) / (1000 * 60 * 60 * 24))
            }
        });

    } catch (error) {
        console.error('Get job match score error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error calculating match score',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
},
    // Get single job details with enhanced match information
    getJobDetails: async (req, res) => {
        try {
            console.log('1. Starting getJobDetails function');
            const freelancerId = req.userId;
            const { jobId } = req.params;

            console.log('2. Job ID:', jobId, 'Freelancer ID:', freelancerId);

            const job = await Job.findById(jobId)
                .populate('clientId', 'name companyName rating profilePicture createdAt totalProjects companySize location')
                .populate('hiredFreelancer', 'name profilePicture rating');

            if (!job) {
                return res.status(404).json({
                    success: false,
                    message: 'Job not found'
                });
            }

            // Get freelancer profile for match calculation
            const freelancer = await User.findById(freelancerId).select('skills category experienceLevel');
            const freelancerSkills = freelancer?.skills || [];
            const freelancerCategory = freelancer?.category;
            const freelancerExperience = freelancer?.experienceLevel;

            // Increment view count
            job.viewCount += 1;
            await job.save();

            // Check if freelancer has already applied
            const existingProposal = await Proposal.findOne({
                jobId: jobId,
                freelancerId: freelancerId
            });

            const jobWithStatus = job.toObject();
            jobWithStatus.hasApplied = !!existingProposal;
            jobWithStatus.applicationStatus = existingProposal ? existingProposal.status : 'not_applied';
            jobWithStatus.existingProposalId = existingProposal ? existingProposal._id : null;

            // Calculate detailed match information
            const matchResult = calculateJobMatchScore(job, freelancerSkills, freelancerCategory, freelancerExperience);
            jobWithStatus.matchDetails = matchResult;

            // Get similar jobs (same category with skill matching)
            const similarJobs = await Job.find({
                category: job.category,
                _id: { $ne: jobId },
                status: 'active',
                deadline: { $gt: new Date() }
            })
                .populate('clientId', 'name companyName rating')
                .limit(4)
                .select('title budget category skillsRequired duration proposalCount createdAt');

            // Add match scores to similar jobs
            const similarJobsWithMatches = similarJobs.map(similarJob => {
                const jobObj = similarJob.toObject();
                const similarMatch = calculateJobMatchScore(similarJob, freelancerSkills, freelancerCategory, freelancerExperience);
                jobObj.matchScore = similarMatch.score;
                jobObj.skillMatchPercentage = similarMatch.skillMatchPercentage;
                return jobObj;
            });

            console.log('3. Job details fetched successfully with match analysis');

            res.json({
                success: true,
                job: jobWithStatus,
                similarJobs: similarJobsWithMatches,
                freelancerProfile: {
                    skills: freelancerSkills,
                    category: freelancerCategory,
                    experienceLevel: freelancerExperience
                }
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

    // Search jobs with advanced filters and skill matching
    searchJobs: async (req, res) => {
        try {
            console.log('1. Starting searchJobs function');
            const freelancerId = req.userId;
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
                limit = 10,
                matchSkills = true
            } = req.body;

            // Get freelancer profile for matching
            const freelancer = await User.findById(freelancerId).select('skills category experienceLevel');
            const freelancerSkills = freelancer?.skills || [];

            let searchQuery = {
                status: 'active',
                deadline: { $gt: new Date() }
            };

            // Text search
            if (query) {
                searchQuery.$or = [
                    { title: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } },
                    { category: { $regex: query, $options: 'i' } },
                    { skillsRequired: { $regex: query, $options: 'i' } }
                ];
            }

            // Filter by category
            if (category) searchQuery.category = category;

            // Filter by skills - with matching if enabled
            if (matchSkills && freelancerSkills.length > 0) {
                const skillRegexPatterns = freelancerSkills.map(skill =>
                    new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                );
                searchQuery.skillsRequired = { $in: skillRegexPatterns };
            } else if (skills && skills.length > 0) {
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

            console.log('2. Search query:', JSON.stringify(searchQuery, null, 2));

            const jobs = await Job.find(searchQuery)
                .populate('clientId', 'name companyName rating profilePicture location totalProjects')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .select('title description budget currency category skillsRequired experienceLevel duration projectType proposalCount viewCount createdAt deadline clientId location attachments');

            const totalJobs = await Job.countDocuments(searchQuery);

            // Add match scores to search results
            const jobsWithMatches = jobs.map(job => {
                const jobObj = job.toObject();
                const matchResult = calculateJobMatchScore(job, freelancerSkills, freelancer.category, freelancer.experienceLevel);
                jobObj.matchScore = matchResult.score;
                jobObj.skillMatchPercentage = matchResult.skillMatchPercentage;
                jobObj.matchedSkills = matchResult.matchedSkills;
                jobObj.isGoodMatch = matchResult.score >= 70;
                return jobObj;
            });

            // Sort by match score if skill matching is enabled
            if (matchSkills) {
                jobsWithMatches.sort((a, b) => b.matchScore - a.matchScore);
            }

            console.log('3. Search results:', jobsWithMatches.length);

            res.json({
                success: true,
                jobs: jobsWithMatches,
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
                    location,
                    matchSkills
                },
                matchStatistics: {
                    totalMatches: jobsWithMatches.filter(j => j.matchScore > 0).length,
                    goodMatches: jobsWithMatches.filter(j => j.isGoodMatch).length
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

    // Get job categories and filters - UPDATED with skill-based statistics
    getJobFilters: async (req, res) => {
        try {
            console.log('1. Starting getJobFilters function');
            const freelancerId = req.userId;

            // Get freelancer skills for personalized filters
            const freelancer = await User.findById(freelancerId).select('skills category');
            const freelancerSkills = freelancer?.skills || [];

            // Get distinct categories
            const categories = await Job.distinct('category', {
                status: 'active',
                deadline: { $gt: new Date() }
            });

            // Get distinct skills
            const allSkills = await Job.distinct('skillsRequired', {
                status: 'active',
                deadline: { $gt: new Date() }
            });

            // Get budget ranges
            const budgetStats = await Job.aggregate([
                {
                    $match: {
                        status: 'active',
                        deadline: { $gt: new Date() }
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
                deadline: { $gt: new Date() }
            });

            // Get project types
            const projectTypes = await Job.distinct('projectType', {
                status: 'active',
                deadline: { $gt: new Date() }
            });

            // Get skill match statistics
            let skillMatchStats = {};
            if (freelancerSkills.length > 0) {
                const skillRegexPatterns = freelancerSkills.map(skill =>
                    new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                );

                const matchingJobsCount = await Job.countDocuments({
                    status: 'active',
                    deadline: { $gt: new Date() },
                    skillsRequired: { $in: skillRegexPatterns }
                });

                const totalJobsCount = await Job.countDocuments({
                    status: 'active',
                    deadline: { $gt: new Date() }
                });

                skillMatchStats = {
                    matchingJobs: matchingJobsCount,
                    totalJobs: totalJobsCount,
                    matchPercentage: totalJobsCount > 0 ? Math.round((matchingJobsCount / totalJobsCount) * 100) : 0
                };
            }

            console.log('2. Filters fetched successfully');

            res.json({
                success: true,
                filters: {
                    categories: categories.filter(cat => cat),
                    skills: allSkills.filter(skill => skill),
                    budgetRange: budgetStats[0] || { minBudget: 0, maxBudget: 100000, avgBudget: 25000 },
                    experienceLevels: experienceLevels.filter(level => level),
                    projectTypes: projectTypes.filter(type => type),
                    skillMatchStats: skillMatchStats
                },
                freelancerProfile: {
                    skills: freelancerSkills,
                    category: freelancer?.category
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

    // Get recommended jobs for freelancer - ENHANCED with multi-level matching
    getRecommendedJobs: async (req, res) => {
        try {
            console.log('1. Starting getRecommendedJobs function');
            const freelancerId = req.userId;

            // Get freelancer's complete profile
            const freelancer = await User.findById(freelancerId).select('skills category experienceLevel');
            const freelancerSkills = freelancer?.skills || [];
            const freelancerCategory = freelancer?.category;
            const freelancerExperience = freelancer?.experienceLevel;

            console.log('1.1 Freelancer profile:', {
                skills: freelancerSkills,
                category: freelancerCategory,
                experience: freelancerExperience
            });

            let recommendedQuery = {
                status: 'active',
                deadline: { $gt: new Date() }
            };

            // Multi-level matching strategy
            let matchingStrategy = 'fallback';

            // STRATEGY 1: Perfect match - skills + category + experience
            if (freelancerSkills.length > 0 && freelancerCategory && freelancerExperience) {
                const skillRegexPatterns = freelancerSkills.map(skill =>
                    new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                );

                recommendedQuery.$and = [
                    { skillsRequired: { $in: skillRegexPatterns } },
                    { category: freelancerCategory },
                    { experienceLevel: freelancerExperience }
                ];
                matchingStrategy = 'perfect_match';
                console.log('1.2 Using perfect match strategy');
            }
            // STRATEGY 2: Skills + category match
            else if (freelancerSkills.length > 0 && freelancerCategory) {
                const skillRegexPatterns = freelancerSkills.map(skill =>
                    new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                );

                recommendedQuery.$and = [
                    { skillsRequired: { $in: skillRegexPatterns } },
                    { category: freelancerCategory }
                ];
                matchingStrategy = 'skills_category_match';
                console.log('1.3 Using skills + category match strategy');
            }
            // STRATEGY 3: Skills match only
            else if (freelancerSkills.length > 0) {
                const skillRegexPatterns = freelancerSkills.map(skill =>
                    new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                );
                recommendedQuery.skillsRequired = { $in: skillRegexPatterns };
                matchingStrategy = 'skills_match';
                console.log('1.4 Using skills match strategy');
            }
            // STRATEGY 4: Category match only
            else if (freelancerCategory) {
                recommendedQuery.category = freelancerCategory;
                matchingStrategy = 'category_match';
                console.log('1.5 Using category match strategy');
            }

            const recommendedJobs = await Job.find(recommendedQuery)
                .populate('clientId', 'name companyName rating profilePicture totalProjects')
                .sort({
                    proposalCount: 1, // Fewer proposals = better chance
                    createdAt: -1
                })
                .limit(8) // Increased limit for better recommendations
                .select('title description budget category skillsRequired duration proposalCount createdAt experienceLevel clientId location');

            // Calculate detailed match scores
            const jobsWithMatchScores = recommendedJobs.map(job => {
                const jobObj = job.toObject();
                const matchResult = calculateJobMatchScore(job, freelancerSkills, freelancerCategory, freelancerExperience);

                jobObj.matchScore = matchResult.score;
                jobObj.skillMatchPercentage = matchResult.skillMatchPercentage;
                jobObj.matchedSkills = matchResult.matchedSkills;
                jobObj.matchReasons = matchResult.reasons;
                jobObj.matchingStrategy = matchingStrategy;

                return jobObj;
            });

            // Sort by match score (highest first)
            jobsWithMatchScores.sort((a, b) => b.matchScore - a.matchScore);

            // If no recommendations found, use fallback strategy
            if (jobsWithMatchScores.length === 0) {
                console.log('1.6 No matches found, using fallback strategy');
                const fallbackJobs = await Job.find({
                    status: 'active',
                    deadline: { $gt: new Date() }
                })
                    .populate('clientId', 'name companyName rating profilePicture')
                    .sort({
                        createdAt: -1,
                        proposalCount: 1
                    })
                    .limit(6)
                    .select('title description budget category skillsRequired duration proposalCount createdAt');

                const fallbackWithScores = fallbackJobs.map(job => {
                    const jobObj = job.toObject();
                    const matchResult = calculateJobMatchScore(job, freelancerSkills, freelancerCategory, freelancerExperience);

                    jobObj.matchScore = matchResult.score;
                    jobObj.skillMatchPercentage = matchResult.skillMatchPercentage;
                    jobObj.matchedSkills = matchResult.matchedSkills;
                    jobObj.matchReasons = ['latest_jobs_fallback'];
                    jobObj.matchingStrategy = 'fallback';

                    return jobObj;
                });

                return res.json({
                    success: true,
                    jobs: fallbackWithScores,
                    recommendationType: 'fallback',
                    matchingStrategy: 'fallback',
                    message: 'Showing latest available jobs'
                });
            }

            console.log('2. Recommendations found:', jobsWithMatchScores.length);

            res.json({
                success: true,
                jobs: jobsWithMatchScores,
                recommendationType: 'skill_based',
                matchingStrategy: matchingStrategy,
                matchDetails: {
                    totalSkills: freelancerSkills.length,
                    primaryCategory: freelancerCategory,
                    experienceLevel: freelancerExperience,
                    perfectMatches: jobsWithMatchScores.filter(j => j.matchScore >= 90).length,
                    goodMatches: jobsWithMatchScores.filter(j => j.matchScore >= 70).length
                }
            });

        } catch (error) {
            console.error('Get recommended jobs error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error fetching recommended jobs',
                error: error.message
            });
        }
    }
};

// Helper function to calculate job match score
function calculateJobMatchScore(job, freelancerSkills, freelancerCategory, freelancerExperience) {
    let score = 0;
    let reasons = [];
    let matchedSkills = [];

    // Skill matching (50% of total score)
    if (freelancerSkills.length > 0 && job.skillsRequired.length > 0) {
        matchedSkills = job.skillsRequired.filter(jobSkill =>
            freelancerSkills.some(freelancerSkill =>
                freelancerSkill.toLowerCase().includes(jobSkill.toLowerCase()) ||
                jobSkill.toLowerCase().includes(freelancerSkill.toLowerCase())
            )
        );

        const skillMatchPercentage = (matchedSkills.length / job.skillsRequired.length) * 100;
        score += (skillMatchPercentage * 0.5);

        if (matchedSkills.length > 0) {
            reasons.push(`Matches ${matchedSkills.length} of ${job.skillsRequired.length} required skills`);
        }
    }

    // Category matching (20% of total score)
    if (freelancerCategory && job.category === freelancerCategory) {
        score += 20;
        reasons.push('Matches your preferred category');
    } else if (freelancerCategory) {
        score += 5; // Small bonus for any category match
    }

    // Experience level matching (15% of total score)
    if (freelancerExperience && job.experienceLevel === freelancerExperience) {
        score += 15;
        reasons.push('Matches your experience level');
    }

    // Project popularity adjustment (10% of total score)
    // Fewer proposals = higher score (better chance of getting hired)
    const proposalScore = Math.max(0, 10 - (job.proposalCount / 10));
    score += proposalScore;
    if (job.proposalCount < 5) {
        reasons.push('Low competition - few proposals');
    }

    // Recency bonus (5% of total score)
    const daysOld = (new Date() - new Date(job.createdAt)) / (1000 * 60 * 60 * 24);
    if (daysOld < 1) {
        score += 5;
        reasons.push('Brand new job posting');
    } else if (daysOld < 3) {
        score += 3;
        reasons.push('Recently posted');
    }

    // Ensure score doesn't exceed 100
    score = Math.min(100, Math.round(score));

    return {
        score: score,
        skillMatchPercentage: matchedSkills.length > 0 ? Math.round((matchedSkills.length / job.skillsRequired.length) * 100) : 0,
        matchedSkills: matchedSkills,
        reasons: reasons,
        breakdown: {
            skills: (matchedSkills.length / job.skillsRequired.length) * 50,
            category: freelancerCategory && job.category === freelancerCategory ? 20 : 5,
            experience: freelancerExperience && job.experienceLevel === freelancerExperience ? 15 : 0,
            popularity: proposalScore,
            recency: daysOld < 1 ? 5 : daysOld < 3 ? 3 : 0
        }
    };
};
// Helper function to generate match recommendations
function generateMatchRecommendations(matchResult, job, freelancerSkills) {
    const recommendations = [];

    // Skill-based recommendations
    if (matchResult.skillMatchPercentage < 50) {
        const missingSkills = job.skillsRequired.filter(
            skill => !matchResult.matchedSkills.includes(skill)
        );
        if (missingSkills.length > 0) {
            recommendations.push({
                type: 'skill_improvement',
                message: `Learn these skills to increase your match: ${missingSkills.slice(0, 3).join(', ')}`,
                priority: 'high'
            });
        }
    }

    // Experience recommendations
    if (!matchResult.breakdown.experience) {
        recommendations.push({
            type: 'experience',
            message: `This job requires ${job.experienceLevel} level experience`,
            priority: 'medium'
        });
    }

    // Competition recommendations
    if (job.proposalCount > 20) {
        recommendations.push({
            type: 'competition',
            message: 'High competition - consider highlighting unique skills in your proposal',
            priority: 'medium'
        });
    }

    // Profile completion recommendations
    if (freelancerSkills.length < 3) {
        recommendations.push({
            type: 'profile',
            message: 'Add more skills to your profile for better job matches',
            priority: 'low'
        });
    }

    // Positive reinforcement
    if (matchResult.score >= 80) {
        recommendations.push({
            type: 'encouragement',
            message: 'Excellent match! You have a high chance of getting this job',
            priority: 'positive'
        });
    }

    return recommendations;
};

module.exports = freelancerJobController;