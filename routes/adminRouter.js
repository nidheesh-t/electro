const express = require("express");
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController')


router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);

router.get('/', adminController.loadDashboard);
router.get('/dashboard', adminController.loadDashboard);
router.get('/logout', adminController.logout)
router.get('/users', customerController.customerInfo)
router.get("/blockCustomer", customerController.blockCustomer);
router.get("/unblockCustomer", customerController.unblockCustomer);



module.exports = router;