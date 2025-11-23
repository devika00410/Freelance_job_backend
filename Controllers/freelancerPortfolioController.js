const Portfolio = require('../Models/Portfolio');
const User = require('../Models/User');

const freelancerPortfolioController = {
    getPortfolio: async (req, res) => {
        try {
            const freelancerId = req.userId;

            let portfolio = await Portfolio.findOne({ freelancerId })
                .populate('completedProjects.projectId', 'title description budget category');

            if (!portfolio) {
                portfolio = new Portfolio({
                    freelancerId,
                    services: [],
                    skills: [],
                    bio: '',
                    projects: [],
                    documents: [],
                    gallery: [],
                    rating: 0,
                    completedProjects: 0,
                    successRate: 0
                });
                await portfolio.save();
            }

            const freelancer = await User.findById(freelancerId)
                .select('name profilePicture email phone location');

            const portfolioData = {
                ...portfolio.toObject(),
                freelancerInfo: freelancer
            };

            res.json({
                success: true,
                portfolio: portfolioData
            });

        } catch (error) {
            console.error("Get portfolio error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching portfolio"
            });
        }
    },

    updatePortfolio: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const updateData = req.body;

            let portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                portfolio = new Portfolio({
                    freelancerId,
                    ...updateData
                });
            } else {
                delete updateData.freelancerId;
                delete updateData._id;
                delete updateData.rating;
                delete updateData.completedProjects;
                delete updateData.successRate;
                delete updateData.documents;
                delete updateData.gallery;

                Object.assign(portfolio, updateData);
            }

            await portfolio.save();

            res.json({
                success: true,
                message: "Portfolio updated successfully",
                portfolio
            });
        } catch (error) {
            console.error("Update portfolio error:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating portfolio"
            });
        }
    },

    // Add project to portfolio
    addProject: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { title, description, serviceType, budget, technologies, projectUrl, images, startDate, endDate, clientName } = req.body;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            const newProject = {
                title,
                description,
                serviceType,
                budget,
                technologies: technologies || [],
                projectUrl: projectUrl || '',
                images: images || [],
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
                clientName: clientName || '',
                addedAt: new Date()
            };

            portfolio.projects.push(newProject);
            
            // Add service type to services array if not already present
            if (serviceType && !portfolio.services.includes(serviceType)) {
                portfolio.services.push(serviceType);
            }

            await portfolio.save();

            const addedProject = portfolio.projects[portfolio.projects.length - 1];

            res.status(201).json({
                success: true,
                message: "Project added to portfolio successfully",
                project: addedProject
            });
        } catch (error) {
            console.error("Add project error:", error);
            res.status(500).json({
                success: false,
                message: "Server error adding project to portfolio"
            });
        }
    },

    // Update project in portfolio
    updateProject: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { projectId } = req.params;
            const updateData = req.body;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            const projectIndex = portfolio.projects.findIndex(
                project => project._id.toString() === projectId
            );

            if (projectIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found in portfolio"
                });
            }

            // Update project data
            portfolio.projects[projectIndex] = {
                ...portfolio.projects[projectIndex].toObject(),
                ...updateData,
                updatedAt: new Date()
            };

            // Update services array if serviceType changed
            if (updateData.serviceType && !portfolio.services.includes(updateData.serviceType)) {
                portfolio.services.push(updateData.serviceType);
            }

            await portfolio.save();

            res.json({
                success: true,
                message: "Project updated successfully",
                project: portfolio.projects[projectIndex]
            });
        } catch (error) {
            console.error("Update project error:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating project"
            });
        }
    },

    // Remove project from portfolio
    removeProject: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { projectId } = req.params;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            const projectToRemove = portfolio.projects.find(
                project => project._id.toString() === projectId
            );

            portfolio.projects = portfolio.projects.filter(
                project => project._id.toString() !== projectId
            );

            await portfolio.save();

            res.json({
                success: true,
                message: "Project removed from portfolio successfully",
                removedProject: projectToRemove
            });
        } catch (error) {
            console.error("Remove project error:", error);
            res.status(500).json({
                success: false,
                message: "Server error removing project from portfolio"
            });
        }
    },

    // Add skill to portfolio
    addSkill: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { name, proficiency, category, yearsOfExperience } = req.body;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            // Check if skill already exists
            const existingSkillIndex = portfolio.skills.findIndex(
                s => s.name.toLowerCase() === name.toLowerCase()
            );

            if (existingSkillIndex !== -1) {
                // Update existing skill
                portfolio.skills[existingSkillIndex] = {
                    ...portfolio.skills[existingSkillIndex].toObject(),
                    proficiency: proficiency || portfolio.skills[existingSkillIndex].proficiency,
                    category: category || portfolio.skills[existingSkillIndex].category,
                    yearsOfExperience: yearsOfExperience || portfolio.skills[existingSkillIndex].yearsOfExperience,
                    updatedAt: new Date()
                };
            } else {
                // Add new skill
                portfolio.skills.push({
                    name,
                    proficiency: proficiency || 'intermediate',
                    category: category || 'technical',
                    yearsOfExperience: yearsOfExperience || 1,
                    addedAt: new Date()
                });
            }

            await portfolio.save();

            // Also update user skills
            await User.findByIdAndUpdate(freelancerId, {
                $addToSet: { skills: name }
            });

            res.json({
                success: true,
                message: "Skill added successfully",
                skills: portfolio.skills
            });
        } catch (error) {
            console.error("Add skill error:", error);
            res.status(500).json({
                success: false,
                message: "Server error adding skill"
            });
        }
    },

    // Remove skill from portfolio
    removeSkill: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { skillName } = req.params;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            const skillToRemove = portfolio.skills.find(
                skill => skill.name.toLowerCase() === skillName.toLowerCase()
            );

            portfolio.skills = portfolio.skills.filter(
                skill => skill.name.toLowerCase() !== skillName.toLowerCase()
            );

            await portfolio.save();

            res.json({
                success: true,
                message: "Skill removed successfully",
                removedSkill: skillToRemove,
                skills: portfolio.skills
            });
        } catch (error) {
            console.error("Remove skill error:", error);
            res.status(500).json({
                success: false,
                message: "Server error removing skill"
            });
        }
    },

    // Upload document (PDF, PPT, DOC, etc.)
    uploadDocument: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { name, fileType, fileUrl, fileSize, description } = req.body;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            const document = {
                name,
                fileType: fileType.toLowerCase(),
                fileUrl,
                fileSize,
                description: description || '',
                uploadedAt: new Date()
            };

            portfolio.documents.push(document);
            await portfolio.save();

            res.status(201).json({
                success: true,
                message: "Document uploaded successfully",
                document
            });
        } catch (error) {
            console.error("Upload document error:", error);
            res.status(500).json({
                success: false,
                message: "Server error uploading document"
            });
        }
    },

    // Remove document
    removeDocument: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { documentId } = req.params;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            const documentToRemove = portfolio.documents.find(
                doc => doc._id.toString() === documentId
            );

            portfolio.documents = portfolio.documents.filter(
                doc => doc._id.toString() !== documentId
            );

            await portfolio.save();

            res.json({
                success: true,
                message: "Document removed successfully",
                removedDocument: documentToRemove
            });
        } catch (error) {
            console.error("Remove document error:", error);
            res.status(500).json({
                success: false,
                message: "Server error removing document"
            });
        }
    },

    // Upload to gallery (images/videos)
    uploadToGallery: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { name, imageUrl, description } = req.body;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            const galleryItem = {
                name,
                imageUrl,
                description: description || '',
                uploadedAt: new Date()
            };

            portfolio.gallery.push(galleryItem);
            await portfolio.save();

            res.status(201).json({
                success: true,
                message: "Image added to gallery successfully",
                galleryItem
            });
        } catch (error) {
            console.error("Upload to gallery error:", error);
            res.status(500).json({
                success: false,
                message: "Server error adding to gallery"
            });
        }
    },

    // Remove from gallery
    removeFromGallery: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { galleryItemId } = req.params;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            const galleryItemToRemove = portfolio.gallery.find(
                item => item._id.toString() === galleryItemId
            );

            portfolio.gallery = portfolio.gallery.filter(
                item => item._id.toString() !== galleryItemId
            );

            await portfolio.save();

            res.json({
                success: true,
                message: "Gallery item removed successfully",
                removedGalleryItem: galleryItemToRemove
            });
        } catch (error) {
            console.error("Remove from gallery error:", error);
            res.status(500).json({
                success: false,
                message: "Server error removing gallery item"
            });
        }
    },

    // Update profile/cover images
    uploadPortfolioImage: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { type, imageUrl } = req.body;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            if (type === 'profile') {
                portfolio.profileImage = imageUrl;
            } else if (type === 'cover') {
                portfolio.coverImage = imageUrl;
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid image type"
                });
            }

            await portfolio.save();

            res.json({
                success: true,
                message: "Image uploaded successfully",
                portfolio
            });
        } catch (error) {
            console.error("Upload portfolio image error:", error);
            res.status(500).json({
                success: false,
                message: "Server error uploading image"
            });
        }
    },

    // Update portfolio bio
    updateBio: async (req, res) => {
        try {
            const freelancerId = req.userId;
            const { bio } = req.body;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            portfolio.bio = bio;
            await portfolio.save();

            res.json({
                success: true,
                message: "Bio updated successfully",
                bio: portfolio.bio
            });
        } catch (error) {
            console.error("Update bio error:", error);
            res.status(500).json({
                success: false,
                message: "Server error updating bio"
            });
        }
    },

    // Get portfolio statistics
    getPortfolioStats: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const portfolio = await Portfolio.findOne({ freelancerId });

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            const totalProjects = portfolio.projects.length;
            const completedProjects = portfolio.completedProjects;
            const successRate = portfolio.successRate;

            const skillDistribution = portfolio.skills.reduce((acc, skill) => {
                acc[skill.proficiency] = (acc[skill.proficiency] || 0) + 1;
                return acc;
            }, {});

            const serviceDistribution = portfolio.services.reduce((acc, service) => {
                acc[service] = (acc[service] || 0) + 1;
                return acc;
            }, {});

            const totalDocuments = portfolio.documents.length;
            const totalGalleryItems = portfolio.gallery.length;

            res.json({
                success: true,
                stats: {
                    totalProjects,
                    completedProjects,
                    successRate,
                    skillDistribution,
                    serviceDistribution,
                    rating: portfolio.rating,
                    totalSkills: portfolio.skills.length,
                    totalServices: portfolio.services.length,
                    totalDocuments,
                    totalGalleryItems
                }
            });
        } catch (error) {
            console.error("Get portfolio stats error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching portfolio stats"
            });
        }
    },

    // Get portfolio documents
    getDocuments: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const portfolio = await Portfolio.findOne({ freelancerId })
                .select('documents');

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            res.json({
                success: true,
                documents: portfolio.documents
            });
        } catch (error) {
            console.error("Get documents error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching documents"
            });
        }
    },

    // Get portfolio gallery
    getGallery: async (req, res) => {
        try {
            const freelancerId = req.userId;

            const portfolio = await Portfolio.findOne({ freelancerId })
                .select('gallery');

            if (!portfolio) {
                return res.status(404).json({
                    success: false,
                    message: "Portfolio not found"
                });
            }

            res.json({
                success: true,
                gallery: portfolio.gallery
            });
        } catch (error) {
            console.error("Get gallery error:", error);
            res.status(500).json({
                success: false,
                message: "Server error fetching gallery"
            });
        }
    }
};

module.exports = freelancerPortfolioController;