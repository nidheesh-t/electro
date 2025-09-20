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


const loadHomePage = async (req, res) => {
  try {
    const user = req.session.user;

    const categories = await Category.find({ isDeleted: false, isListed: true }).lean();

    if (!categories || categories.length === 0) {
      return res.redirect('/pageNotFound');
    }

    let productData = await Product.find({
      isDeleted: false,
      isListed: true,
      category: { $in: categories.map(category => category._id) },
      totalQuantity: { $gt: 0 }
    })
      .populate({
        path: 'brand',
        match: { isListed: true, isDeleted: false }
      })
      .lean();

    productData = productData.filter(product => product.brand !== null);

    if (!productData || productData.length === 0) {
      return res.redirect('/pageNotFound');
    }

    productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    productData = productData.slice(0, 4);

    if (user) {
      const userData = await User.findById(user).lean();
      if (userData && userData.isBlock) {
        req.session.user = null;
        return res.redirect('/login');
      }
      return res.render('home', { user: userData, products: productData });
    }

    return res.render('home', { products: productData });

  } catch (error) {
    console.error('Error loading home page:', {
      error: error.message,
      stack: error.stack,
      userId: req.session.user
    });
    return res.redirect('/pageNotFound');
  }
}



const pageNotFound = async (req, res) => {
    try {
        res.render("page-404")
    } catch (error) {
        console.log("Page not found error");
        res.status(500).send("Internal server error")
    }
}


const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;

        const categories = await Category.find({ isListed: true, isDeleted: false });
        const brands = await Brand.find({ isListed: true, isDeleted: false });

        const page = parseInt(req.query.page) || 1;
        const limit = 9;

        const query = {
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

        const filteredProducts = allProducts.filter(product =>
            product.brand !== null && product.category !== null
        );

        const paginatedProducts = filteredProducts.slice((page - 1) * limit, page * limit);
        const totalProducts = filteredProducts.length;
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("shop", {
            user: userData,
            products: paginatedProducts,
            category: categories,
            brand: brands,
            currentPage: page,
            totalPages: totalPages,
            searchQuery: req.query.search || '',
            selectedCategory: req.query.category || null,
            selectedBrand: req.query.brand || null,
            selectedMinPrice: req.query.minPrice || null,
            selectedMaxPrice: req.query.maxPrice || null,
            selectedSort: req.query.sort || 'newest',
            buildQueryString: (params) => buildQueryString(params, req.query),
            currentQuery: req.query
        });

    } catch (error) {
        console.error("Error loading shopping page:", error);
        res.redirect("/pageNotFound");
    }
};




module.exports = {
    loadHomePage,
    pageNotFound,
    loadShoppingPage
}






