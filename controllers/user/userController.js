const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");

const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const bcrypt = require("bcrypt");

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'Verify your account',
            text: `Your OTP is ${otp}`,
            html: `<p style="font-size: 1.1rem;">Hello,</p><p style="font-size: 1.1rem;">Your OTP for registration is <strong>${otp}</strong></p>`
        });

        return info.accepted.length > 0;

    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

function buildQueryString(params, existingQuery = {}) {
    const query = { ...existingQuery };

    // Update with new parameters
    Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
            delete query[key];
        } else {
            query[key] = value;
        }
    });

    // Convert to query string
    return Object.entries(query)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
}

// const loadHomepage = async (req, res) => {
//     try {
//         let user;

//         if (req.session.user) {
//             user = await User.findById({ _id: req.session.user });
//         } else if (req.user) {
//             user = req.user;
//             req.session.user = user._id;
//         }

//         if (user) {
//             return res.render("home", { user });
//         } else {
//             return res.render("home")
//         }

//     } catch (error) {
//         console.error("Error loading homepage", error);
//         res.status(500).send("Internal server error");
//     }
// }

// const loadHomePage = async (req, res) => {
//     try {
//         const user = req.session.user;
//         const categories = await Category.find({ isDeleted: false, isListed: true });

//         let productData = await Product.find({
//             isDeleted: false,
//             isListed: true,
//             category: { $in: categories.map(category => category._id) },
//             totalQuantity: { $gt: 0 }
//         });

//         productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//         productData = productData.slice(0, 4);

//         if (user) {
//             const userData = await User.findById(user);
//             if (userData.isBlock) {
//                 req.session.user = null;
//                 return res.redirect('/login');
//             } else {
//                 res.render('home', { user: userData, products: productData });
//             }
//         } else {
//             return res.render('home', { products: productData });
//         }

//     } catch (error) {
//         console.error('Error loading home page:', error);
//         res.status(500).send('Internal Server Error');
//     }
// }


const loadHomePage = async (req, res) => {
  try {
    const user = req.session.user;

    // Fetch categories that are listed and not deleted
    const categories = await Category.find({ isDeleted: false, isListed: true }).lean();

    // If no valid categories, redirect to /pageNotFound
    if (!categories || categories.length === 0) {
      return res.redirect('/pageNotFound');
    }

    // Fetch products with valid categories and brands
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

    // Filter out products where brand is null (i.e., brand is not listed or deleted)
    productData = productData.filter(product => product.brand !== null);

    // If no valid products, redirect to /pageNotFound
    if (!productData || productData.length === 0) {
      return res.redirect('/pageNotFound');
    }

    // Sort products by createdAt (descending) and limit to 4
    productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    productData = productData.slice(0, 4);

    // Handle user session
    if (user) {
      const userData = await User.findById(user).lean();
      if (userData && userData.isBlock) {
        req.session.user = null;
        return res.redirect('/login');
      }
      return res.render('home', { user: userData, products: productData });
    }

    // Render home page for non-logged-in users
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


const loadSignup = async (req, res) => {
    try {
        return res.render("signup")

    } catch (error) {
        console.log("Signup page not found");
        res.status(500).send("Internal server error")
    }
}

const signup = async (req, res) => {
    try {
        const { firstName, lastName, phone, email, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render("signup", { message: "Password do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "User with this email already exists" });
        }
        const otp = generateOTP();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.json("Email-error");
        }

        req.session.userOtp = otp;
        req.session.userData = { firstName, lastName, phone, email, password };

        res.render("verify-otp");
        console.log("OTP sent successfully", otp);


    } catch (error) {
        console.error("Signup error", error);
        res.status(500).send("Internal server error")
    }

}


const loadLogin = async (req, res) => {
    try {
        if (!req.session.user) {
            const message = req.session.messages ? req.session.messages[0] : null;
            req.session.messages = [];
            return res.render("login", { message });
        } else {
            res.redirect("/");
        }

    } catch (error) {
        console.log("Login page not found", error);
        res.redirect("/pageNotFound");
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const findUser = await User.findOne({ email: email });
        if (!findUser) {
            return res.render("login", { message: "Invalid credentials, please try again" });
        }
        if (findUser.isBlock) {
            return res.render("login", { message: "User is blocked by admin" });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);
        if (!passwordMatch) {
            return res.render("login", { message: "Invalid credentials, please try again" });
        }

        req.session.user = findUser._id;
        res.redirect("/");

    } catch (error) {
        console.error("login error", error);
        return res.render("login", { message: "Login failed, please try again" });
    }
}


const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        console.log("Error bcrypt Password", error)
    }
}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log(otp);
        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                email: user.email,
                password: passwordHash
            })

            await saveUserData.save();
            req.session.user = saveUserData._id;
            res.json({ success: true, redirectUrl: "/" });
        } else {
            console.log("Invalid OTP entered");
            res.json({ success: false, message: "Invalid OTP, Please try again" });
        }
    } catch (error) {
        console.error("Error verify otp", error);
        res.status(500).send("Internal server error")

    }

}

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email id not found in session" })
        }
        const otp = generateOTP();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            console.log("Resend OTP sent: ", otp);
            res.status(200).json({ success: true, message: "OTP resend successfully" })
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP, Please try again." })
        }

    } catch (error) {
        console.error("Error resending OTP", error);
        res.status(500).send("Internal server error")
    }

}

const logout = async (req, res) => {
    try {
        req.logout((err) => {
            if (err) {
                console.error("Passport logout error:", err);
                return res.status(500).send("Logout failed");
            }
            req.session.destroy((err) => {
                if (err) {
                    console.error("Session destroy error:", err);
                    return res.status(500).send("Logout failed");
                }
                res.clearCookie("connect.sid");
                res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
                res.setHeader("Pragma", "no-cache");
                res.setHeader("Expires", "0");
                res.redirect("/login");
            });
        });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).send("Internal server error");
    }
};

// const loadShoppingPage = async (req, res) => {
//     try {
//         const user = req.session.user;
//         const userData = user ? await User.findOne({ _id: user }) : null;

//         const categories = await Category.find({ isListed: true });
//         const brands = await Brand.find({ isListed: true });

//         const page = parseInt(req.query.page) || 1;
//         const limit = 9;
//         const skip = (page - 1) * limit;

//         // Base query for available products
//         const query = {
//             isListed: true,
//             isDeleted: false,
//             totalQuantity: { $gt: 0 }
//         };

//         // Get products with pagination
//         const products = await Product.find(query)
//             .populate('brand')
//             .populate('category')
//             .sort({ createdAt: -1 })
//             .skip(skip)
//             .limit(limit);

//         const totalProducts = await Product.countDocuments(query);
//         const totalPages = Math.ceil(totalProducts / limit);

//         res.render("shop", {
//             user: userData,
//             products: products,
//             category: categories,
//             brand: brands,
//             currentPage: page,
//             totalPages: totalPages,
//             // Filter-related variables
//             searchQuery: req.query.search || '',
//             selectedCategory: req.query.category || null,
//             selectedBrand: req.query.brand || null,
//             selectedMinPrice: req.query.minPrice || null,
//             selectedMaxPrice: req.query.maxPrice || null,
//             selectedSort: req.query.sort || 'newest',
//             // Query builder function
//             buildQueryString: (params) => buildQueryString(params, req.query),
//             // Current query object
//             currentQuery: req.query
//         });

//     } catch (error) {
//         console.error("Error loading shopping page:", error);
//         res.redirect("/pageNotFound");
//     }
// };

const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;

        const categories = await Category.find({ isListed: true, isDeleted: false });
        const brands = await Brand.find({ isListed: true, isDeleted: false });

        const page = parseInt(req.query.page) || 1;
        const limit = 9;

        // Base query for available products
        const query = {
            isListed: true,
            isDeleted: false,
            totalQuantity: { $gt: 0 }
        };

        // Get all products first, then filter
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

        // Filter out products where brand or category is null
        const filteredProducts = allProducts.filter(product =>
            product.brand !== null && product.category !== null
        );

        // Apply pagination
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
            // Filter-related variables
            searchQuery: req.query.search || '',
            selectedCategory: req.query.category || null,
            selectedBrand: req.query.brand || null,
            selectedMinPrice: req.query.minPrice || null,
            selectedMaxPrice: req.query.maxPrice || null,
            selectedSort: req.query.sort || 'newest',
            // Query builder function
            buildQueryString: (params) => buildQueryString(params, req.query),
            // Current query object
            currentQuery: req.query
        });

    } catch (error) {
        console.error("Error loading shopping page:", error);
        res.redirect("/pageNotFound");
    }
};


// const filterProduct = async (req, res) => {
//     try {
//         const user = req.session.user;
//         const category = req.query.category;
//         const brand = req.query.brand;
//         const findCategory = category ? await Category.findOne({ _id: category }) : null;
//         const findBrand = brand ? await Brand.findOne({ _id: brand }) : null;
//         const brands = await Brand.find({}).lean();
//         const query = {
//             isListed: true,
//             isDeleted: false,
//             totalQuantity: { $gt: 0 }
//         };
//         if (findCategory) {
//             query.category = findCategory._id;
//         }
//         if (findBrand) {
//             query.brand = findBrand._id;
//         }

//         let findProducts = await Product.find(query)
//             .populate('brand')
//             .lean();
//         findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

//         const categories = await Category.find({ isListed: true, isDeleted: false });

//         let itemsPerPage = 9;
//         let currentPage = parseInt(req.query.page) || 1;
//         let startIndex = (currentPage - 1) * itemsPerPage;
//         let endIndex = startIndex + itemsPerPage;
//         let totalPages = Math.ceil(findProducts.length / itemsPerPage);

//         const currentProducts = findProducts.slice(startIndex, endIndex);

//         let userData = null;
//         if (user) {
//             userData = await User.findOne({ _id: user });
//             if (userData) {
//                 const searchEntry = {
//                     category: findCategory ? findCategory._id : null,
//                     brand: findBrand ? findBrand.brandName : null,
//                     searchedAt: new Date()
//                 }
//                 userData.searchHistory.push(searchEntry);
//                 await userData.save();
//             }
//         }

//         req.session.filteredProducts = currentProducts;

//         res.render("shop", {
//             user: userData,
//             products: currentProducts,
//             category: categories,
//             brand: brands,
//             currentPage: currentPage,
//             totalPages: totalPages,
//             selectedCategory: category || null,
//             selectedBrand: brand || null,

//         });

//     } catch (error) {
//         console.error("Error filtering products:", error);
//         res.redirect("/pageNotFound");
//     }
// }

const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const category = req.query.category;
        const brand = req.query.brand;

        const findCategory = category ? await Category.findOne({ _id: category, isListed: true, isDeleted: false }) : null;
        const findBrand = brand ? await Brand.findOne({ _id: brand, isListed: true, isDeleted: false }) : null;

        const brands = await Brand.find({ isListed: true, isDeleted: false }).lean();
        const categories = await Category.find({ isListed: true, isDeleted: false });

        // Base query
        const query = {
            isListed: true,
            isDeleted: false,
            totalQuantity: { $gt: 0 }
        };

        // Add category and brand filters if provided
        if (findCategory) {
            query.category = findCategory._id;
        }
        if (findBrand) {
            query.brand = findBrand._id;
        }

        // Get all products first, then filter
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

        // Filter out products where brand or category is null
        const findProducts = allProducts.filter(product =>
            product.brand !== null && product.category !== null
        );

        let itemsPerPage = 9;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);

        const currentProducts = findProducts.slice(startIndex, endIndex);

        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
            if (userData) {
                const searchEntry = {
                    category: findCategory ? findCategory._id : null,
                    brand: findBrand ? findBrand.brandName : null,
                    searchedAt: new Date()
                }
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }

        req.session.filteredProducts = currentProducts;

        res.render("shop", {
            user: userData,
            products: currentProducts,
            category: categories,
            brand: brands,
            currentPage: currentPage,
            totalPages: totalPages,
            selectedCategory: category || null,
            selectedBrand: brand || null,
            searchQuery: req.query.search || '',
            selectedMinPrice: req.query.minPrice || null,
            selectedMaxPrice: req.query.maxPrice || null,
            selectedSort: req.query.sort || 'newest',
            buildQueryString: (params) => buildQueryString(params, req.query),
            currentQuery: req.query
        });

    } catch (error) {
        console.error("Error filtering products:", error);
        res.redirect("/pageNotFound");
    }
}


// const filterByPrice = async (req, res) => {
//     try {

//         const user = req.session.user;
//         const userData = await User.findOne({ _id: user });
//         const brands = await Brand.find({}).lean();
//         const categories = await Category.find({ isListed: true, isDeleted: false }).lean();

//         let findProducts = await Product.find({
//             salePrice: { $gte: req.query.gt, $lte: req.query.lt },
//             isListed: true,
//             isDeleted: false,
//             totalQuantity: { $gt: 0 }
//         }).populate('brand').lean();

//         findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

//         let itemsPerPage = 9;
//         let currentPage = parseInt(req.query.page) || 1;
//         let startIndex = (currentPage - 1) * itemsPerPage;
//         let endIndex = startIndex + itemsPerPage;
//         let totalPages = Math.ceil(findProducts.length / itemsPerPage);        
//         const currentProducts = findProducts.slice(startIndex, endIndex);

//         req.session.filteredProducts = currentProducts;
//         res.render("shop", {
//             user: userData,
//             products: currentProducts,
//             category: categories,
//             brand: brands,
//             currentPage: currentPage,
//             totalPages: totalPages,

//         });
//     } catch (error) {
//         console.error("Error filtering products by price:", error);
//         res.redirect("/pageNotFound");
//     }
// }

const filterByPrice = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;
        const brands = await Brand.find({ isListed: true, isDeleted: false }).lean();
        const categories = await Category.find({ isListed: true, isDeleted: false }).lean();

        // Base query
        const query = {
            salePrice: { $gte: parseFloat(req.query.gt), $lte: parseFloat(req.query.lt) },
            isListed: true,
            isDeleted: false,
            totalQuantity: { $gt: 0 }
        };

        // Get all products first, then filter
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

        // Filter out products where brand or category is null
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

        // Validate search term
        if (!search || search === "") {
            return res.redirect('/shop');
        }

        // Search in both session filtered products and database
        let searchResult = [];
        const searchRegex = new RegExp(search, 'i'); // Case-insensitive regex

        if (req.session.filteredProducts?.length > 0) {
            searchResult = req.session.filteredProducts.filter((product) => {
                // Check if brand and category are listed (assuming they're populated in session)
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

        // Sort and paginate results
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
            searchQuery: search // Pass search term back to view
        });
    } catch (error) {
        console.error("Error searching products:", error);
        res.redirect("/pageNotFound");
    }
}




// const filterProducts = async (req, res) => {
//     try {
//         const { 
//             search, 
//             category, 
//             brand, 
//             minPrice, 
//             maxPrice, 
//             sort, 
//             page = 1, 
//             limit = 9 
//         } = req.query;

//         const user = req.session.user;
//         const userData = user ? await User.findOne({ _id: user }) : null;

//         // Base query
//         const query = {
//             isListed: true,
//             isDeleted: false,
//             totalQuantity: { $gt: 0 }
//         };

//         // Apply filters
//         if (search) {
//             const searchRegex = new RegExp(search, 'i');
//             query.$or = [
//                 { productName: searchRegex },
//                 { description: searchRegex },
//                 { 'brand.brandName': searchRegex }
//             ];
//         }

//         if (category) query.category = category;
//         if (brand) query.brand = brand;

//         if (minPrice || maxPrice) {
//             query.salePrice = {};
//             if (minPrice) query.salePrice.$gte = Number(minPrice);
//             if (maxPrice) query.salePrice.$lte = Number(maxPrice);
//         }

//         // Sorting
//         let sortOption = { createdAt: -1 };
//         if (sort === 'price-asc') sortOption = { salePrice: 1 };
//         if (sort === 'price-desc') sortOption = { salePrice: -1 };
//         if (sort === 'name-asc') sortOption = { productName: 1 };
//         if (sort === 'name-desc') sortOption = { productName: -1 };

//         // Pagination
//         const skip = (page - 1) * limit;

//         const [products, totalProducts, categories, brands] = await Promise.all([
//             Product.find(query)
//                 .populate('brand')
//                 .populate('category')
//                 .sort(sortOption)
//                 .skip(skip)
//                 .limit(limit)
//                 .lean(),

//             Product.countDocuments(query),

//             Category.find({ isListed: true, isDeleted: false }).lean(),

//             Brand.find({ isListed: true }).lean()
//         ]);

//         const totalPages = Math.ceil(totalProducts / limit);

//         res.render("shop", {
//             user: userData,
//             products,
//             category: categories,
//             brand: brands,
//             currentPage: Number(page),
//             totalPages,
//             count: totalProducts,
//             // Filter-related variables
//             searchQuery: search || '',
//             selectedCategory: category || null,
//             selectedBrand: brand || null,
//             selectedMinPrice: minPrice || null,
//             selectedMaxPrice: maxPrice || null,
//             selectedSort: sort || 'newest',
//             // Query builder function
//             buildQueryString: (params) => buildQueryString(params, req.query),
//             // Current query object
//             currentQuery: req.query
//         });

//     } catch (error) {
//         console.error("Error filtering products:", error);
//         res.redirect("/pageNotFound");
//     }
// };

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

        // Base query
        const query = {
            isListed: true,
            isDeleted: false,
            totalQuantity: { $gt: 0 }
        };

        // Apply filters
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

        // Sorting
        let sortOption = { createdAt: -1 };
        if (sort === 'price-asc') sortOption = { salePrice: 1 };
        if (sort === 'price-desc') sortOption = { salePrice: -1 };
        if (sort === 'name-asc') sortOption = { productName: 1 };
        if (sort === 'name-desc') sortOption = { productName: -1 };

        // Get all products first, then filter by brand/category listing status
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

        // Filter out products where brand or category is null
        const filteredProducts = allProducts.filter(product =>
            product.brand !== null && product.category !== null
        );

        // Apply pagination
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

const demoLogin = async (req, res) => {
    try {
        // Check if a demo user exists
        let demoUser = await User.findOne({ email: 'demo@123.com' });

        // If no demo user exists, create one
        if (!demoUser) {
            const demoPassword = 'Demo1234'; // Default password
            const passwordHash = await securePassword(demoPassword);
            demoUser = new User({
                firstName: 'Demo',
                lastName: 'User',
                email: 'demo@123.com',
                phone: 'demo@123.com',
                password: passwordHash,
                isBlock: false,
            });
            await demoUser.save();
        }

        // Check if the demo user is blocked
        if (demoUser.isBlock) {
            req.flash('error', 'Demo account is blocked. Please contact support.');
            return res.redirect('/login');
        }

        // Set the user session
        req.session.user = demoUser._id;
        return res.redirect('/');

    } catch (error) {
        console.error('Demo login error:', error);
        req.flash('error', 'An error occurred during demo login. Please try again.');
        return res.redirect('/login');
    }
};


module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    loadLogin,
    login,
    signup,
    verifyOtp,
    resendOtp,
    logout,
    loadShoppingPage,
    filterProduct,
    filterByPrice,
    searchProducts,
    filterProducts,
    demoLogin
}






