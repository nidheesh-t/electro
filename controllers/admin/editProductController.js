// controllers/admin/editProductController.js
const mongoose = require("mongoose");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const { cloudinaryRemoveImage, cloudinaryRemoveMultipleImage } = require('../../helpers/uploadMiddleware');
const sanitizeHtml = require('sanitize-html');

const handleError = (res, error, redirectPath = "/pageerror") => {
    console.error(error);
    res.redirect(redirectPath);
}

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findById(id).lean();
        const brands = await Brand.find({ isListed: true, isDeleted: false });
        const categories = await Category.find({ isListed: true, isDeleted: false });
        res.render("edit-product", {
            product,
            brands,
            categories
        });
    } catch (error) {
        handleError(res, error, "/admin/pageerror");
    }
};

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const {
            productName,
            description,
            brand,
            category,
            regularPrice,
            salePrice,
            variants,
            deletedImages
        } = req.body;

        const sanitizedProductName = sanitizeHtml(productName.trim().toLowerCase());
        const sanitizedDescription = sanitizeHtml(description);

        let parsedVariants;
        try {
            if (typeof variants === 'string') {
                parsedVariants = JSON.parse(variants);
            } else {
                parsedVariants = Array.isArray(variants) ? variants : [variants].filter(v => v);
            }
        } catch (error) {
            console.error('Error parsing variants:', error);
            return res.status(400).json({ success: false, message: "Invalid variant data format" });
        }

        if (parseFloat(salePrice) > parseFloat(regularPrice)) {
            return res.status(400).json({ success: false, message: "Sale price must be less than regular price." });
        }

        const existingProduct = await Product.findOne({
            productName: sanitizedProductName,
            _id: { $ne: id },
            isDeleted: false
        });
        if (existingProduct) {
            return res.status(400).json({ success: false, message: "Product with this name already exists." });
        }

        const categoryDoc = await Category.findById(category);
        if (!categoryDoc || categoryDoc.isDeleted || !categoryDoc.isListed) {
            return res.status(400).json({ success: false, message: "Invalid or unlisted category." });
        }

        parsedVariants = parsedVariants.map(variant => {
            const specs = Array.isArray(variant.specs)
                ? variant.specs.filter(spec => spec && typeof spec === 'object' && spec.name && spec.value)
                : variant.specs && typeof variant.specs === 'object' && variant.specs.name && variant.specs.value
                    ? [variant.specs]
                    : [];
            const quantity = parseInt(variant.quantity) || 0;
            if (quantity < 0) {
                throw new Error("Quantity cannot be negative");
            }
            return {
                specs: specs.map(spec => ({
                    name: sanitizeHtml(spec.name.trim()),
                    value: sanitizeHtml(spec.value.trim())
                })),
                quantity
            };
        });

        if (parsedVariants.length === 0) {
            return res.status(400).json({ success: false, message: "At least one variant is required" });
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

        const updateFields = {
            productName: sanitizedProductName,
            description: sanitizedDescription,
            brand,
            category: categoryDoc._id,
            regularPrice,
            salePrice,
            variants: parsedVariants,
            totalQuantity: parsedVariants.reduce((sum, variant) => sum + (variant.quantity || 0), 0),
            updatedAt: new Date()
        };

        const product = await Product.findById(id);
        let deletedImageArray = [];
        if (typeof deletedImages === 'string') {
            deletedImageArray = deletedImages.split(',');
        } else if (Array.isArray(deletedImages)) {
            deletedImageArray = deletedImages;
        }

        // Delete images from Cloudinary
        if (deletedImageArray.length > 0) {
            const publicIdsToDelete = [];
            for (const publicId of deletedImageArray) {
                const imageToDelete = product.productImage.find(img => img.public_id === publicId);
                if (imageToDelete) {
                    publicIdsToDelete.push(publicId);
                }
            }
            
            if (publicIdsToDelete.length > 0) {
                await cloudinaryRemoveMultipleImage(publicIdsToDelete);
            }
        }

        const remainingImages = product.productImage.filter(img => !deletedImageArray.includes(img.public_id));

        // Add new images from Cloudinary
        if (req.cloudinaryResults && req.cloudinaryResults.length > 0) {
            updateFields.productImage = [...remainingImages, ...req.cloudinaryResults];
        } else {
            updateFields.productImage = remainingImages;
        }

        const totalImages = updateFields.productImage.length;
        if (totalImages === 0) {
            return res.status(400).json({ success: false, message: "Product must have at least one image" });
        }
        if (totalImages > 4) {
            return res.status(400).json({ success: false, message: "Product cannot have more than 4 images" });
        }

        await Product.findByIdAndUpdate(id, updateFields, { new: true });

        res.status(200).json({
            success: true,
            message: 'Product updated successfully!',
            redirectUrl: '/admin/products'
        });
    } catch (error) {
        console.error("Error editing product:", error);
        res.status(500).json({ success: false, message: error.message || "Error editing product" });
    }
};

const deleteSingleImage = async (req, res) => {
    try {
        const { imagePublicId, productId } = req.body;
        const product = await Product.findById(productId);
        
        if (product.productImage.length <= 1) {
            return res.status(400).json({ status: false, message: "Product must have at least one image" });
        }

        // Delete from Cloudinary
        await cloudinaryRemoveImage(imagePublicId);

        // Remove from database
        await Product.findByIdAndUpdate(
            productId,
            { $pull: { productImage: { public_id: imagePublicId } } }
        );

        res.json({ status: true, message: "Image deleted successfully" });
    } catch (error) {
        console.error("Error deleting image:", error);
        res.status(500).json({ status: false, message: "Error deleting image" });
    }
};

const listProduct = async (req, res) => {
    try {
        const id = req.query.id;
        await Product.updateOne({ _id: id }, { $set: { isListed: true } });
        res.status(200).json({ success: true, message: 'Product listed successfully' });
    } catch (error) {
        handleError(res, error);
    }
};

const unlistProduct = async (req, res) => {
    try {
        const id = req.query.id;
        await Product.updateOne({ _id: id }, { $set: { isListed: false } });
        res.status(200).json({ success: true, message: 'Product unlisted successfully' });
    } catch (error) {
        handleError(res, error);
    }
};

const deleteProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findById(id);
        
        if (product && product.productImage.length > 0) {
            // Delete all images from Cloudinary
            const publicIds = product.productImage.map(img => img.public_id);
            await cloudinaryRemoveMultipleImage(publicIds);
        }
        
        await Product.findByIdAndUpdate(id, { isDeleted: true });
        res.redirect("/admin/products");
    } catch (error) {
        handleError(res, error);
    }
};

module.exports = {
    getEditProduct,
    editProduct,
    deleteSingleImage,
    listProduct,
    unlistProduct,
    deleteProduct
};