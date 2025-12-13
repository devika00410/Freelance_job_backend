const Contact = require('../Models/Contact');
const User = require('../Models/User');

// User submits contact form
exports.submitContact = async (req, res) => {
    try {
        const { name, email, subject, message, userType } = req.body;
        
        const contact = new Contact({
            name,
            email,
            subject,
            message,
            userType: userType || 'visitor'
        });

        await contact.save();
        
        res.status(201).json({
            success: true,
            message: 'Contact message submitted successfully. Our support team will get back to you soon.',
            data: contact
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error submitting contact form',
            error: error.message
        });
    }
};

// Support admin gets all contact messages
exports.getAllContacts = async (req, res) => {
    try {
        const { status, priority, page = 1, limit = 20 } = req.query;
        const query = {};
        
        if (status) query.status = status;
        if (priority) query.priority = priority;
        
        const contacts = await Contact.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('assignedTo', 'name email');
            
        const total = await Contact.countDocuments(query);
        
        res.status(200).json({
            success: true,
            data: contacts,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching contacts',
            error: error.message
        });
    }
};

// Get single contact message
exports.getContactById = async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id)
            .populate('assignedTo', 'name email')
            .populate('adminNotes.addedBy', 'name email')
            .populate('response.respondedBy', 'name email');
            
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact message not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: contact
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching contact',
            error: error.message
        });
    }
};

// Update contact status
exports.updateContactStatus = async (req, res) => {
    try {
        const { status, priority, assignedTo } = req.body;
        const updateData = {};
        
        if (status) updateData.status = status;
        if (priority) updateData.priority = priority;
        if (assignedTo) updateData.assignedTo = assignedTo;
        
        const contact = await Contact.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact message not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Contact updated successfully',
            data: contact
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating contact',
            error: error.message
        });
    }
};

// Add admin note to contact
exports.addAdminNote = async (req, res) => {
    try {
        const { note } = req.body;
        const userId = req.user.id;
        
        const contact = await Contact.findById(req.params.id);
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact message not found'
            });
        }
        
        contact.adminNotes.push({
            note,
            addedBy: userId
        });
        
        await contact.save();
        
        res.status(200).json({
            success: true,
            message: 'Note added successfully',
            data: contact
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding note',
            error: error.message
        });
    }
};

// Send response to user
exports.sendResponse = async (req, res) => {
    try {
        const { responseMessage } = req.body;
        const userId = req.user.id;
        
        const contact = await Contact.findById(req.params.id);
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact message not found'
            });
        }
        
        contact.response = {
            message: responseMessage,
            respondedBy: userId,
            respondedAt: new Date()
        };
        
        contact.status = 'resolved';
        
        await contact.save();
        
        // TODO: Send email to user with response
        // await sendEmail(contact.email, 'Response to your contact message', responseMessage);
        
        res.status(200).json({
            success: true,
            message: 'Response sent successfully',
            data: contact
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error sending response',
            error: error.message
        });
    }
};

// Get statistics for dashboard
exports.getContactStats = async (req, res) => {
    try {
        const stats = await Contact.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$count' },
                    statuses: { $push: { status: '$_id', count: '$count' } }
                }
            },
            {
                $project: {
                    _id: 0,
                    total: 1,
                    statuses: {
                        $arrayToObject: {
                            $map: {
                                input: '$statuses',
                                as: 's',
                                in: { k: '$$s.status', v: '$$s.count' }
                            }
                        }
                    }
                }
            }
        ]);
        
        const priorityStats = await Contact.aggregate([
            {
                $group: {
                    _id: '$priority',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                ...stats[0],
                priorityStats
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics',
            error: error.message
        });
    }
};