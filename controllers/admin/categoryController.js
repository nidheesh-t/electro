const Category = require('../../models/categorySchema');



const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        // Create Mongo query filter
        const query = {
            isDeleted: false, // exclude soft deleted categories
            ...(search ? { categoryName: { $regex: new RegExp(search, "i") } } : {})
        }

        // Fetch categories with pagination & search
        const categoryData = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Count total categories excluding deleted
        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages,
            totalCategories,
            search
        })
    } catch (error) {
        console.error("Error loading category info:", error);
        res.redirect("/pageerror");
    }

}

const addCategory = async (req, res) => {
    const { categoryName, description } = req.body;
    try {
        const existingCategory = await Category.findOne({ categoryName });

        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        const newCategory = new Category({
            categoryName: categoryName.trim(),
            description: description.trim(),
            isListed: true
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
        const { categoryName, description } = req.body;
        const id = req.params.id;

        const existing = await Category.findOne({ categoryName });

        if (existing) {
            return res.status(400).json({ error: "Category name already exists" });
        }

        const updateCategory = await Category.findByIdAndUpdate(id, {
            categoryName: categoryName.trim(),
            description: description.trim()
        }, { new: true });
        if (updateCategory) {
            res.json({ message: "Category updated successfully" });
        } else {
            res.json({ message: "Category not found" });
        }

    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

const softDeleteCategory = async (req, res) => {
  try {
    const id = req.query.id; // or req.body.id for POST
    await Category.updateOne({ _id: id }, { $set: { isDeleted: true } });
    res.redirect('/admin/category');
  } catch (error) {
    console.error('Error soft deleting category:', error);
    res.redirect('/pageerror');
  }
}



module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    softDeleteCategory

}