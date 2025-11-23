const { body, validationResult, param, query } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

const globalErrorHandler = (err, req, res, next) => {
    console.error('=== GLOBAL ERROR HANDLER TRIGGERED ===');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Request URL:', req.originalUrl);
    console.error('Request method:', req.method);
    console.error('Request body:', req.body);

    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(error => ({
            field: error.path,
            message: error.message
        }));
        return res.status(400).json({
            success: false,
            message: 'Database validation failed',
            errors: errors
        });
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            success: false,
            message: 'Duplicate entry',
            error: `${field} already exists`
        });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format',
            error: 'The provided ID is not valid'
        });
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
};

const commonValidations = {
    objectId: [
        param('id')
            .isMongoId()
            .withMessage('Invalid ID format'),
        handleValidationErrors
    ],
    
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        handleValidationErrors
    ]
};

const jobValidations = {
    createJob: [
        body('title')
            .trim()
            .notEmpty()
            .withMessage('Title is required')
            .isLength({ min: 5, max: 100 })
            .withMessage('Title must be between 5 and 100 characters'),
        
        body('description')
            .trim()
            .notEmpty()
            .withMessage('Description is required')
            .isLength({ min: 10, max: 2000 })
            .withMessage('Description must be between 10 and 2000 characters'),
        
        body('budget')
            .isNumeric()
            .withMessage('Budget must be a number')
            .custom((value) => {
                const numValue = Number(value);
                if (isNaN(numValue) || numValue < 1000) {
                    throw new Error('Budget must be at least 1000');
                }
                return true;
            }),
        
        body('category')
            .trim()
            .notEmpty()
            .withMessage('Category is required')
            .isIn([
                'Full Stack Web Development', 
                'Frontend Development', 
                'Backend Development', 
                'Mobile Development',
                'UI/UX Design',
                'DevOps',
                'Data Science',
                'Machine Learning',
                'Other'
            ])
            .withMessage('Invalid category'),
        
        body('skills')
            .optional()
            .isArray()
            .withMessage('Skills must be an array'),
        
        body('skills.*')
            .optional()
            .isString()
            .withMessage('Each skill must be a string'),
        
        body('duration')
            .optional()
            .isString()
            .withMessage('Duration must be a string'),
        
        body('experienceLevel')
            .optional()
            .isIn(['Beginner', 'Intermediate', 'Expert'])
            .withMessage('Experience level must be Beginner, Intermediate, or Expert'),
        
        handleValidationErrors
    ],

    updateJob: [
        body('title')
            .optional()
            .trim()
            .isLength({ min: 5, max: 100 })
            .withMessage('Title must be between 5 and 100 characters'),
        
        body('description')
            .optional()
            .trim()
            .isLength({ min: 10, max: 2000 })
            .withMessage('Description must be between 10 and 2000 characters'),
        
        body('budget')
            .optional()
            .isNumeric()
            .withMessage('Budget must be a number')
            .custom((value) => {
                const numValue = Number(value);
                if (isNaN(numValue) || numValue < 1000) {
                    throw new Error('Budget must be at least 1000');
                }
                return true;
            }),
        
        body('category')
            .optional()
            .trim()
            .isIn([
                'Full Stack Web Development', 
                'Frontend Development', 
                'Backend Development', 
                'Mobile Development',
                'UI/UX Design',
                'DevOps',
                'Data Science',
                'Machine Learning',
                'Other'
            ])
            .withMessage('Invalid category'),
        
        handleValidationErrors
    ],

    getJobs: [
        query('category')
            .optional()
            .trim()
            .isIn([
                'Full Stack Web Development', 
                'Frontend Development', 
                'Backend Development', 
                'Mobile Development',
                'UI/UX Design',
                'DevOps',
                'Data Science',
                'Machine Learning',
                'Other'
            ])
            .withMessage('Invalid category filter'),
        
        query('minBudget')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Min budget must be a positive number'),
        
        query('maxBudget')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Max budget must be a positive number'),
        
        query('experienceLevel')
            .optional()
            .isIn(['Beginner', 'Intermediate', 'Expert'])
            .withMessage('Invalid experience level'),
        
        handleValidationErrors
    ]
};

const proposalValidations = {
    submitProposal: [
        body('projectId')
            .isMongoId()
            .withMessage('Valid Project ID is required'),
        
        body('coverLetter')
            .trim()
            .notEmpty()
            .withMessage('Cover letter is required')
            .isLength({ min: 50, max: 2000 })
            .withMessage('Cover letter must be between 50 and 2000 characters'),
        
        body('proposalDetails.totalAmount')
            .isNumeric()
            .withMessage('Total amount must be a number')
            .custom((value) => {
                const numValue = Number(value);
                if (isNaN(numValue) || numValue < 1000) {
                    throw new Error('Total amount must be at least 1000');
                }
                return true;
            }),
        
        body('proposalDetails.timeline')
            .trim()
            .notEmpty()
            .withMessage('Timeline is required')
            .isLength({ min: 5, max: 100 })
            .withMessage('Timeline must be between 5 and 100 characters'),
        
        body('proposalDetails.milestones')
            .optional()
            .isArray()
            .withMessage('Milestones must be an array'),
        
        body('proposalDetails.milestones.*.title')
            .optional()
            .trim()
            .isLength({ min: 5, max: 50 })
            .withMessage('Milestone title must be between 5 and 50 characters'),
        
        body('proposalDetails.milestones.*.amount')
            .optional()
            .isNumeric()
            .withMessage('Milestone amount must be a number'),
        
        handleValidationErrors
    ],

    updateProposal: [
        body('coverLetter')
            .optional()
            .trim()
            .isLength({ min: 50, max: 2000 })
            .withMessage('Cover letter must be between 50 and 2000 characters'),
        
        body('proposalDetails.totalAmount')
            .optional()
            .isNumeric()
            .withMessage('Total amount must be a number')
            .custom((value) => {
                const numValue = Number(value);
                if (isNaN(numValue) || numValue < 1000) {
                    throw new Error('Total amount must be at least 1000');
                }
                return true;
            }),
        
        body('proposalDetails.timeline')
            .optional()
            .trim()
            .isLength({ min: 5, max: 100 })
            .withMessage('Timeline must be between 5 and 100 characters'),
        
        handleValidationErrors
    ]
};

const userValidations = {
    updateProfile: [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters'),
        
        body('email')
            .optional()
            .isEmail()
            .withMessage('Valid email is required')
            .normalizeEmail(),
        
        body('phone')
            .optional()
            .isMobilePhone()
            .withMessage('Valid phone number is required'),
        
        body('bio')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Bio must be less than 500 characters'),
        
        body('skills')
            .optional()
            .isArray()
            .withMessage('Skills must be an array'),
        
        body('skills.*')
            .optional()
            .isString()
            .withMessage('Each skill must be a string'),
        
        body('hourlyRate')
            .optional()
            .isNumeric()
            .withMessage('Hourly rate must be a number')
            .custom((value) => {
                const numValue = Number(value);
                if (isNaN(numValue) || numValue < 0) {
                    throw new Error('Hourly rate must be a positive number');
                }
                return true;
            }),
        
        handleValidationErrors
    ],

    changePassword: [
        body('currentPassword')
            .notEmpty()
            .withMessage('Current password is required'),
        
        body('newPassword')
            .isLength({ min: 6 })
            .withMessage('New password must be at least 6 characters long')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
        
        handleValidationErrors
    ]
};

const authValidations = {
    register: [
        body('name')
            .trim()
            .notEmpty()
            .withMessage('Name is required')
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters'),
        
        body('email')
            .isEmail()
            .withMessage('Valid email is required')
            .normalizeEmail(),
        
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
        
        body('userType')
            .isIn(['client', 'freelancer'])
            .withMessage('User type must be either client or freelancer'),
        
        handleValidationErrors
    ],

    login: [
        body('email')
            .isEmail()
            .withMessage('Valid email is required')
            .normalizeEmail(),
        
        body('password')
            .notEmpty()
            .withMessage('Password is required'),
        
        handleValidationErrors
    ]
};

module.exports = {
    handleValidationErrors,
    globalErrorHandler,
    commonValidations,
    jobValidations,
    proposalValidations,
    userValidations,
    authValidations
};