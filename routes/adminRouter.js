const express = require("express");
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');

router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);

router.get('/', adminController.loadDashboard);
router.get('/dashboard', adminController.loadDashboard);
router.get('/logout', adminController.logout)
// customer management
router.get('/users', customerController.customerInfo)
router.get("/blockCustomer", customerController.blockCustomer);
router.get("/unblockCustomer", customerController.unblockCustomer);
// category management
router.get('/category', categoryController.categoryInfo);
router.post('/addCategory', categoryController.addCategory);
router.get('/listCategory', categoryController.getListCategory);
router.get('/unlistCategory', categoryController.getUnlistCategory);
router.get('/editCategory/:id', categoryController.getEditCategory);
router.post('/editCategory/:id', categoryController.editCategory);
router.get('/deleteCategory', categoryController.softDeleteCategory);



module.exports = router;