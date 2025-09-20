const mongoose = require("mongoose");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
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

        // console.log('Edit product request body:', { productName, deletedImages, files: req.files?.map(f => f.filename) });

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

        const allNewImages = [];
        if (req.files?.length > 0) {
            for (let file of req.files) {
                const resizedPath = path.join("public", "uploads", "product-images", file.filename);
                await sharp(file.path)
                    .resize(440, 440, {
                        fit: sharp.fit.inside,
                        withoutEnlargement: true
                    })
                    .toFile(resizedPath);
                allNewImages.push(file.filename);
                // console.log(`Saved new image: ${resizedPath}`);
            }
        }

        const product = await Product.findById(id);
        let deletedImageArray = [];
        if (typeof deletedImages === 'string') {
            deletedImageArray = deletedImages.split(',');
        } else if (Array.isArray(deletedImages)) {
            deletedImageArray = deletedImages;
        }

        const remainingImages = product.productImage.filter(img => !deletedImageArray.includes(img));
        const totalImages = remainingImages.length + allNewImages.length;

        if (totalImages === 0) {
            return res.status(400).json({ success: false, message: "Product must have 1 to 4 images" });
        }
        if (totalImages > 4) {
            return res.status(400).json({ success: false, message: `Product cannot have more than 4 images. You have ${remainingImages.length} existing and tried to add ${allNewImages.length}.` });
        }

        if (allNewImages.length > 0) {
            updateFields.productImage = [...remainingImages, ...allNewImages];
        } else {
            updateFields.productImage = remainingImages;
        }

        if (deletedImageArray.length > 0) {
            for (const imageName of deletedImageArray) {
                const imagePath = path.join("public", "uploads", "product-images", imageName);
                try {
                    if (fs.existsSync(imagePath)) {
                        fs.unlinkSync(imagePath);
                        // console.log(`Deleted image: ${imagePath}`);
                    }
                } catch (err) {
                    console.error(`Failed to delete image ${imagePath}:`, err);
                }
            }
        }

        await Product.findByIdAndUpdate(id, updateFields, { new: true });
        // console.log(`Updated product ${id} with images: ${updateFields.productImage}`);

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
        const { imageNameToServer, productIdToServer } = req.body;
        const product = await Product.findById(productIdToServer);
        if (product.productImage.length <= 1) {
            return res.status(400).json({ status: false, message: "Product must have at least one image" });
        }
        await Product.findByIdAndUpdate(
            productIdToServer,
            { $pull: { productImage: imageNameToServer } }
        );
        const imagePath = path.join(
            __dirname,
            "..",
            "..",
            "public",
            "uploads",
            "product-images",
            imageNameToServer
        );
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            // console.log(`Deleted image: ${imagePath}`);
        }
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