const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController")
const passport = require("../config/passport")




router.get("/pageNotFound", userController.pageNotFound)
router.get("/", userController.loadHomepage)
router.get("/signup", userController.loadSignup)
router.post("/signup", userController.signup)
router.get("/login", userController.loadLogin)
router.post("/verify-otp", userController.verifyOtp)
router.post("/resend-otp", userController.resendOtp)

router.get('/auth/google',
    passport.authenticate('google', {
        scope:
            ['email', 'profile']
    }
    ));

router.get('/auth/google/callback',
    passport.authenticate('google', {
        successRedirect: '/',
        failureRedirect: '/login'
    }));



module.exports = router;