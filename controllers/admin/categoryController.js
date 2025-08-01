const Category = require('../../models/categorySchema');

const categoryInfo = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        const query = {
            isDeleted: false,
            ...(search ? { categoryName: { $regex: new RegExp(search, "i") } } : {})
        };

        const categoryData = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages,
            totalCategories,
            search
        });
    } catch (error) {
        console.error("Error loading category info:", error);
        res.redirect("/pageerror");
    }
}

const addCategory = async (req, res) => {
    const { categoryName, description, attributes } = req.body;
    try {
        const existingCategory = await Category.findOne({ categoryName });

        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        // Validate unique attribute names
        const attributeNames = new Set();
        if (attributes) {
            for (const attr of attributes) {
                if (!attr.name) {
                    return res.status(400).json({ error: "Attribute name is required" });
                }
                const nameLower = attr.name.toLowerCase();
                if (attributeNames.has(nameLower)) {
                    return res.status(400).json({ error: `Duplicate attribute name: ${attr.name}` });
                }
                attributeNames.add(nameLower);
            }
        }

        const newCategory = new Category({
            categoryName: categoryName.trim(),
            description: description.trim(),
            isListed: true,
            attributes: attributes || []
        });

        await newCategory.save();
        res.status(200).json({ message: "Category added successfully" });
    } catch (error) {
        console.error("Error adding category:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

const getListCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.redirect("/admin/category");
    } catch (error) {
        console.error('Error listing category:', error);
        res.redirect("/pageerror");
    }
}

const getUnlistCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.redirect("/admin/category");
    } catch (error) {
        console.error('Error unlisting category:', error);
        res.redirect("/pageerror");
    }
}

const getEditCategory = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.redirect('/admin/category');

        res.render("edit-category", { category });
    } catch (error) {
        console.error("Error fetching category:", error);
        res.redirect("/pageerror");
    }
}

const editCategory = async (req, res) => {
    try {
        const { categoryName, description, attributes } = req.body;
        const id = req.params.id;

        // Check for duplicate category name
        const existing = await Category.findOne({ categoryName, _id: { $ne: id } });
        if (existing) {
            return res.status(400).json({ error: "Category name already exists" });
        }

        // Validate unique attribute names
        const attributeNames = new Set();
        if (attributes) {
            for (const attr of attributes) {
                if (!attr.name) {
                    return res.status(400).json({ error: "Attribute name is required" });
                }
                const nameLower = attr.name.toLowerCase();
                if (attributeNames.has(nameLower)) {
                    return res.status(400).json({ error: `Duplicate attribute name: ${attr.name}` });
                }
                attributeNames.add(nameLower);
            }
        }

        // Update category, overwriting attributes array
        const updateCategory = await Category.findByIdAndUpdate(
            id,
            {
                categoryName: categoryName.trim(),
                description: description.trim(),
                attributes: attributes || []
            },
            { new: true, runValidators: true }
        );

        if (updateCategory) {
            res.json({ message: "Category updated successfully" });
        } else {
            res.status(404).json({ error: "Category not found" });
        }
    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
}

const softDeleteCategory = async (req, res) => {
    try {
        const id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isDeleted: true } });
        res.redirect('/admin/category');
    } catch (error) {
        console.error('Error soft deleting category:', error);
        res.redirect('/pageerror');
    }
}

const getCategoryAttributes = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id, 'attributes');
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }
        res.json({ attributes: category.attributes || [] });
    } catch (error) {
        console.error('Error fetching category attributes:', error);
        res.status(500).json({ error: "Internal server error" });
    }
}

module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    softDeleteCategory,
    getCategoryAttributes
}