// helpers/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { cloudinaryUploadImage, cloudinaryRemoveImage, cloudinaryRemoveMultipleImage } = require('./cloudinary');

// Multer storage configuration (for temporary local storage)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../public/uploads/temp');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Middleware to handle single file upload to Cloudinary
const uploadToCloudinary = (fieldName) => {
    return async (req, res, next) => {
        try {
            // First, upload to local storage using multer
            upload.single(fieldName)(req, res, async (err) => {
                if (err) {
                    return res.status(400).json({ error: err.message });
                }

                if (!req.file) {
                    return next(); // No file to upload
                }

                try {
                    // Upload to Cloudinary
                    const result = await cloudinaryUploadImage(req.file.path);

                    // Add Cloudinary info to request object
                    req.cloudinaryResult = {
                        public_id: result.public_id,
                        url: result.secure_url
                    };

                    // Delete local file after Cloudinary upload
                    fs.unlinkSync(req.file.path);

                    next();
                } catch (cloudinaryError) {
                    // Clean up local file if Cloudinary upload fails
                    if (req.file && req.file.path) {
                        fs.unlinkSync(req.file.path);
                    }
                    console.error('Cloudinary upload error:', cloudinaryError);
                    return res.status(500).json({ error: 'Image upload failed' });
                }
            });
        } catch (error) {
            res.status(500).json({ error: 'Upload failed' });
        }
    };
};

// Middleware for multiple files upload to Cloudinary
const uploadMultipleToCloudinary = (fieldName, maxCount = 4) => {
    return async (req, res, next) => {
        try {
            upload.array(fieldName, maxCount)(req, res, async (err) => {
                if (err) {
                    return res.status(400).json({ error: err.message });
                }

                if (!req.files || req.files.length === 0) {
                    return next();
                }

                try {
                    const cloudinaryResults = [];

                    // Upload all files to Cloudinary
                    for (const file of req.files) {
                        const result = await cloudinaryUploadImage(file.path);
                        cloudinaryResults.push({
                            public_id: result.public_id,
                            url: result.secure_url
                        });

                        // Delete local file
                        fs.unlinkSync(file.path);
                    }

                    req.cloudinaryResults = cloudinaryResults;
                    next();
                } catch (cloudinaryError) {
                    // Clean up all local files
                    if (req.files) {
                        req.files.forEach(file => {
                            if (file.path) fs.unlinkSync(file.path);
                        });
                    }
                    console.error('Cloudinary upload error:', cloudinaryError);
                    return res.status(500).json({ error: 'Images upload failed' });
                }
            });
        } catch (error) {
            res.status(500).json({ error: 'Upload failed' });
        }
    };
};

module.exports = {
    upload,
    uploadToCloudinary,
    uploadMultipleToCloudinary,
    cloudinaryRemoveImage,
    cloudinaryRemoveMultipleImage
}