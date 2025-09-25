const mongoose = require("mongoose");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const { cloudinaryRemoveImage, cloudinaryRemoveMultipleImage } = require('../../helpers/uploadMiddleware');
const sanitizeHtml = require('sanitize-html');

const handleError = (res, error, redirectPath = "/pageerror") => {
    console.error(error);
    res.redirect(redirectPath);
};

const getProductAddPage = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true, isDeleted: false });
        const brands = await Brand.find({ isListed: true, isDeleted: false });
        res.render("product-add", {
            categories,
            brands
        });
    } catch (error) {
        handleError(res, error);
    }
};

const addProducts = async (req, res) => {
    try {
        const {
            productName,
            description,
            brand,
            category,
            regularPrice,
            salePrice,
            variants
        } = req.body;

        // console.log('Request body:', req.body);
        // console.log('Cloudinary results:', req.cloudinaryResults);
        // console.log('Files:', req.files);

        const sanitizedProductName = sanitizeHtml(productName.trim().toLowerCase());
        const sanitizedDescription = sanitizeHtml(description);

        const existing = await Product.findOne({
            productName: sanitizedProductName,
            isDeleted: false
        });

        if (existing) {
            return res.status(400).json({ success: false, message: 'Product already exists.' });
        }

        if (regularPrice <= 0 || salePrice <= 0) {
            return res.status(400).json({ success: false, message: "Prices must be positive values." });
        }
        if (parseFloat(salePrice) > parseFloat(regularPrice)) {
            return res.status(400).json({ success: false, message: "Sale price must be ≤ regular price." });
        }

        const categoryDoc = await Category.findById(category);
        if (!categoryDoc || categoryDoc.isDeleted || !categoryDoc.isListed) {
            return res.status(400).json({ success: false, message: "Invalid or unlisted category." });
        }

        // Parse variants data
        let parsedVariants;
        try {
            if (typeof variants === 'string') {
                parsedVariants = JSON.parse(variants);
            } else {
                parsedVariants = Array.isArray(variants) ? variants : [variants];
            }
        } catch (error) {
            console.error('Error parsing variants:', error);
            return res.status(400).json({ success: false, message: "Invalid variant data format" });
        }

        parsedVariants = parsedVariants.map(variant => {
            // Handle different variant data structures
            const specs = Array.isArray(variant.specs) ? variant.specs : 
                         (variant.specs && typeof variant.specs === 'object') ? [variant.specs] : [];
            
            const quantity = parseInt(variant.quantity) || 0;
            if (quantity < 0) {
                throw new Error("Quantity cannot be negative");
            }
            
            return {
                specs: specs.filter(spec => spec && spec.name && spec.value && spec.name.trim() && spec.value.trim()).map(spec => ({
                    name: sanitizeHtml(spec.name.trim()),
                    value: sanitizeHtml(spec.value.trim())
                })),
                quantity
            };
        });

        if (parsedVariants.length === 0 || parsedVariants.some(v => v.specs.length === 0)) {
            return res.status(400).json({ success: false, message: "At least one variant with valid specifications is required" });
        }

        for (const variant of parsedVariants) {
            const specNames = new Set();
            for (const spec of variant.specs) {
                const nameLower = spec.name.toLowerCase();
                if (specNames.has(nameLower)) {
                    return res.status(400).json({ success: false, message: `Duplicate specification name: ${spec.name}` });
                }
                specNames.add(nameLower);
            }
        }

        // Cloudinary images data - FIXED: Use req.cloudinaryResults instead of req.files
        const images = req.cloudinaryResults ? req.cloudinaryResults.map(img => ({
            public_id: img.public_id,
            url: img.url
        })) : [];

        // console.log('Processed images:', images);

        if (images.length === 0) {
            return res.status(400).json({ success: false, message: "Product must have at least one image" });
        }

        if (images.length > 4) {
            return res.status(400).json({ success: false, message: "Product cannot have more than 4 images" });
        }

        const newProduct = new Product({
            productName: sanitizedProductName,
            description: sanitizedDescription,
            brand,
            category: categoryDoc._id,
            regularPrice,
            salePrice,
            variants: parsedVariants,
            productImage: images,
            totalQuantity: parsedVariants.reduce((sum, variant) => sum + (variant.quantity || 0), 0)
        });

        await newProduct.save();
        // console.log('Product saved successfully with ID:', newProduct._id);

        res.status(200).json({
            success: true,
            message: 'Product added successfully!',
            redirectUrl: '/admin/products'
        });
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error adding product'
        });
    }
};

const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 5;

        const filter = {
            isDeleted: false,
            productName: { $regex: new RegExp(search, "i") }
        };

        const products = await Product.find(filter)
            .populate({
                path: 'brand',
                select: 'brandName isListed',
                match: { isListed: true, isDeleted: false }
            })
            .populate({
                path: 'category',
                select: 'categoryName isListed',
                match: { isListed: true, isDeleted: false }
            })
            .sort({ createdAt: -1 })
            .lean();

        const filteredProducts = products.filter(product => 
            product.brand !== null && product.category !== null
        );
        
        const paginatedProducts = filteredProducts.slice((page - 1) * limit, page * limit);

        const total = filteredProducts.length;
        const categories = await Category.find({ isListed: true, isDeleted: false });
        const brands = await Brand.find({ isListed: true, isDeleted: false });

        res.render("products", {
            data: paginatedProducts,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            cat: categories,
            brand: brands,
            search
        });
    } catch (error) {
        handleError(res, error);
    }
}

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts
}