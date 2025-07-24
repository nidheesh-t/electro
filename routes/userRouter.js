const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController")




router.get("/pageNotFound", userController.pageNotFound)
router.get("/", userController.loadHomepage)
router.get("/signup", userController.loadSignup)
router.post("/signup", userController.signup)
router.get("/login", userController.loadLogin)




module.exports = router;