const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");


function buildQueryString(params, existingQuery = {}) {
    const query = { ...existingQuery };

    Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
            delete query[key];
        } else {
            query[key] = value;
        }
    });

    return Object.entries(query)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
}

const filterByPrice = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;
        const brands = await Brand.find({ isListed: true, isDeleted: false }).lean();
        const categories = await Category.find({ isListed: true, isDeleted: false }).lean();

        const query = {
            salePrice: { $gte: parseFloat(req.query.gt), $lte: parseFloat(req.query.lt) },
            isListed: true,
            isDeleted: false,
            totalQuantity: { $gt: 0 }
        };

        const allProducts = await Product.find(query)
            .populate({
                path: 'brand',
                match: { isListed: true, isDeleted: false }
            })
            .populate({
                path: 'category',
                match: { isListed: true, isDeleted: false }
            })
            .sort({ createdAt: -1 })
            .lean();

        const findProducts = allProducts.filter(product =>
            product.brand !== null && product.category !== null
        );

        let itemsPerPage = 9;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProducts = findProducts.slice(startIndex, endIndex);

        req.session.filteredProducts = currentProducts;

        res.render("shop", {
            user: userData,
            products: currentProducts,
            category: categories,
            brand: brands,
            currentPage: currentPage,
            totalPages: totalPages,
            searchQuery: req.query.search || '',
            selectedCategory: req.query.category || null,
            selectedBrand: req.query.brand || null,
            selectedMinPrice: req.query.gt || null,
            selectedMaxPrice: req.query.lt || null,
            selectedSort: req.query.sort || 'newest',
            buildQueryString: (params) => buildQueryString(params, req.query),
            currentQuery: req.query
        });
    } catch (error) {
        console.error("Error filtering products by price:", error);
        res.redirect("/pageNotFound");
    }
}


const searchProducts = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;
        const search = req.body.search?.trim();
        const categories = await Category.find({ isListed: true, isDeleted: false }).lean();
        const brands = await Brand.find({}).lean();
        const categoryIds = categories.map((category) => category._id);

        if (!search || search === "") {
            return res.redirect('/shop');
        }

        let searchResult = [];
        const searchRegex = new RegExp(search, 'i'); 

        if (req.session.filteredProducts?.length > 0) {
            searchResult = req.session.filteredProducts.filter((product) => {
                const isBrandListed = product.brand?.isListed !== false;
                const isCategoryListed = product.category?.isListed !== false;

                return (
                    isBrandListed &&
                    isCategoryListed &&
                    (
                        searchRegex.test(product.productName) ||
                        (product.brand?.brandName && searchRegex.test(product.brand.brandName)) ||
                        searchRegex.test(product.description || '')
                    )
                );
            });
        } else {
            searchResult = await Product.find({
                $or: [
                    { productName: { $regex: search, $options: 'i' } },
                    { 'brand.brandName': { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ],
                isDeleted: false,
                isListed: true,
                category: { $in: categoryIds },
                totalQuantity: { $gt: 0 }
            })
                .populate('brand')
                .lean();
        }

        searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const itemsPerPage = 9;
        const currentPage = parseInt(req.query.page) || 1;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const totalPages = Math.ceil(searchResult.length / itemsPerPage);
        const currentProducts = searchResult.slice(startIndex, endIndex);

        res.render("shop", {
            user: userData,
            products: currentProducts,
            category: categories,
            brand: brands,
            currentPage: currentPage,
            totalPages: totalPages,
            count: searchResult.length,
            searchQuery: search
        });
    } catch (error) {
        console.error("Error searching products:", error);
        res.redirect("/pageNotFound");
    }
}



const filterProducts = async (req, res) => {
    try {
        const {
            search,
            category,
            brand,
            minPrice,
            maxPrice,
            sort,
            page = 1,
            limit = 9
        } = req.query;

        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;

        const query = {
            isListed: true,
            isDeleted: false,
            totalQuantity: { $gt: 0 }
        };

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { productName: searchRegex },
                { description: searchRegex }
            ];
        }

        if (category) query.category = category;
        if (brand) query.brand = brand;

        if (minPrice || maxPrice) {
            query.salePrice = {};
            if (minPrice) query.salePrice.$gte = Number(minPrice);
            if (maxPrice) query.salePrice.$lte = Number(maxPrice);
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'price-asc') sortOption = { salePrice: 1 };
        if (sort === 'price-desc') sortOption = { salePrice: -1 };
        if (sort === 'name-asc') sortOption = { productName: 1 };
        if (sort === 'name-desc') sortOption = { productName: -1 };

        const allProducts = await Product.find(query)
            .populate({
                path: 'brand',
                match: { isListed: true, isDeleted: false }
            })
            .populate({
                path: 'category',
                match: { isListed: true, isDeleted: false }
            })
            .sort(sortOption)
            .lean();

        const filteredProducts = allProducts.filter(product =>
            product.brand !== null && product.category !== null
        );

        const skip = (page - 1) * limit;
        const products = filteredProducts.slice(skip, skip + Number(limit));
        const totalProducts = filteredProducts.length;
        const totalPages = Math.ceil(totalProducts / limit);

        const [categories, brands] = await Promise.all([
            Category.find({ isListed: true, isDeleted: false }).lean(),
            Brand.find({ isListed: true, isDeleted: false }).lean()
        ]);

        res.render("shop", {
            user: userData,
            products,
            category: categories,
            brand: brands,
            currentPage: Number(page),
            totalPages,
            count: totalProducts,
            searchQuery: search || '',
            selectedCategory: category || null,
            selectedBrand: brand || null,
            selectedMinPrice: minPrice || null,
            selectedMaxPrice: maxPrice || null,
            selectedSort: sort || 'newest',
            buildQueryString: (params) => buildQueryString(params, req.query),
            currentQuery: req.query
        });

    } catch (error) {
        console.error("Error filtering products:", error);
        res.redirect("/pageNotFound");
    }
};



module.exports = {
    filterByPrice,
    searchProducts,
    filterProducts
}






