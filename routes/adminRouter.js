// routes/adminRouter.js
const express = require("express");
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const brandController = require('../controllers/admin/brandController');
const productController = require('../controllers/admin/productController');
const editProductController = require("../controllers/admin/editProductController");

// Import the new upload middleware
const { 
    uploadToCloudinary, 
    uploadMultipleToCloudinary 
} = require('../helpers/uploadMiddleware');

router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);

router.get('/', adminController.loadDashboard);
router.get('/dashboard', adminController.loadDashboard);
router.get('/logout', adminController.logout);

// Customer management
router.get('/users', customerController.customerInfo);
router.get("/blockCustomer", customerController.blockCustomer);
router.get("/unblockCustomer", customerController.unblockCustomer);

// Category management
router.get('/category', categoryController.categoryInfo);
router.post('/addCategory', categoryController.addCategory);
router.get('/listCategory', categoryController.getListCategory);
router.get('/unlistCategory', categoryController.getUnlistCategory);
router.get('/editCategory/:id', categoryController.getEditCategory);
router.post('/editCategory/:id', categoryController.editCategory);
router.get('/deleteCategory', categoryController.softDeleteCategory);

// Brand management - Updated to use Cloudinary
router.get('/brands', brandController.getBrandPage);
router.post('/addBrand', uploadToCloudinary("image"), brandController.addBrand);
router.get("/unlistBrand", brandController.unlistBrand);
router.get("/listBrand", brandController.listBrand);
router.get("/deleteBrand", brandController.deleteBrand);
router.get("/editBrand", brandController.getEditBrand);
router.post("/editBrand", uploadToCloudinary("image"), brandController.postEditBrand);

// Product Management Routes - Updated to use Cloudinary
router.get("/addProducts", productController.getProductAddPage);
router.post("/addProducts", uploadMultipleToCloudinary("images", 4), productController.addProducts);
router.get("/products", productController.getAllProducts);
router.get("/listProduct", editProductController.listProduct);
router.get("/unlistProduct", editProductController.unlistProduct);
router.get("/editProduct", editProductController.getEditProduct);
router.post("/editProduct/:id", uploadMultipleToCloudinary("images", 4), editProductController.editProduct);
router.get("/deleteProduct", editProductController.deleteProduct);
router.post("/deleteSingleImage", editProductController.deleteSingleImage);

module.exports = router;