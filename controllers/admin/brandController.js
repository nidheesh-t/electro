// controllers/admin/brandController.js
const Brand = require('../../models/brandSchema');
const Product = require('../../models/productSchema');
const { cloudinaryRemoveImage } = require('../../helpers/uploadMiddleware');

const getBrandPage = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const brandData = await Brand.find({ isDeleted: false })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);

        const successMsg = req.query.success;
        const errorMsg = req.query.error;

        res.render("brands", {
            data: brandData.reverse(),
            currentPage: page,
            totalPages,
            totalBrands,
            successMsg,
            errorMsg,
        });
    } catch (error) {
        console.error("Error fetching brand data:", error);
        res.status(500).send("Internal Server Error");
    }
}

const addBrand = async (req, res) => {
    try {
        const brandName = req.body.brandName.trim();

        const existingBrand = await Brand.findOne({
            brandName: { $regex: new RegExp(`^${brandName}$`, "i") },
            isDeleted: false
        });

        if (existingBrand) {
            return res.redirect("/admin/brands?error=Brand+already+exists");
        }

        // Cloudinary data is now in req.cloudinaryResult
        const brandLogo = req.cloudinaryResult ? {
            public_id: req.cloudinaryResult.public_id,
            url: req.cloudinaryResult.url
        } : null;

        const newBrand = new Brand({
            brandName,
            brandLogo,
            isListed: true,
        });

        await newBrand.save();
        res.redirect("/admin/brands?success=Brand+added+successfully");
    } catch (error) {
        console.error("Error adding brand:", error);
        res.redirect("/admin/brands?error=Failed+to+add+brand");
    }
}

const unlistBrand = async (req, res) => {
    try {
        const brandId = req.query.id;
        await Brand.findByIdAndUpdate(brandId, { isListed: false });
        res.redirect("/admin/brands?success=Brand+unlisted+successfully");
    } catch (error) {
        console.error("Error unlisting brand:", error);
        res.redirect("/admin/brands?error=Failed+to+unlist+brand");
    }
}

const listBrand = async (req, res) => {
    try {
        const brandId = req.query.id;
        await Brand.findByIdAndUpdate(brandId, { isListed: true });
        res.redirect("/admin/brands?success=Brand+listed+successfully");
    } catch (error) {
        console.error("Error listing brand:", error);
        res.redirect("/admin/brands?error=Failed+to+list+brand");
    }
}

const deleteBrand = async (req, res) => {
    try {
        const brandId = req.query.id;
        const brand = await Brand.findById(brandId);
        
        if (brand && brand.brandLogo && brand.brandLogo.public_id) {
            // Delete image from Cloudinary
            await cloudinaryRemoveImage(brand.brandLogo.public_id);
        }
        
        await Brand.updateOne({ _id: brandId }, { $set: { isDeleted: true } });
        res.redirect("/admin/brands?success=Brand+deleted+successfully");
    } catch (error) {
        console.error("Error deleting brand:", error);
        res.redirect("/admin/brands?error=Failed+to+delete+brand");
    }
}

const getEditBrand = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }
    const brandId = req.query.id;
    const brand = await Brand.findById(brandId);
    if (!brand) {
        return res.redirect("/admin/brands?error=Brand not found");
    }
    res.render("editBrand", { brand });
};

const postEditBrand = async (req, res) => {
    const { id, brandName } = req.body;
    try {
        const brand = await Brand.findById(id);
        if (!brand) {
            return res.redirect("/admin/brands?error=Brand not found");
        }

        const updateData = { brandName };

        // If new image is uploaded, update image and delete old one from Cloudinary
        if (req.cloudinaryResult) {
            // Delete old image from Cloudinary if exists
            if (brand.brandLogo && brand.brandLogo.public_id) {
                await cloudinaryRemoveImage(brand.brandLogo.public_id);
            }
            
            updateData.brandLogo = {
                public_id: req.cloudinaryResult.public_id,
                url: req.cloudinaryResult.url
            };
        }

        await Brand.findByIdAndUpdate(id, updateData);
        res.redirect("/admin/brands?success=Brand updated successfully");
    } catch (err) {
        console.error("Error updating brand:", err);
        res.redirect("/admin/brands?error=Something went wrong");
    }
};

module.exports = {
    getBrandPage,
    addBrand,
    listBrand,
    unlistBrand,
    deleteBrand,
    getEditBrand,
    postEditBrand
}