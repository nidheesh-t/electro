const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const editProfileController =require("../controllers/user/editProfileController");
const productController = require("../controllers/user/productController");
const shopController = require("../controllers/user/shopController");
const filterController = require("../controllers/user/filterController");
const passport = require("../config/passport");
const User = require("../models/userSchema");
const Review = require("../models/reviewSchema");
const mongoose = require("mongoose");

router.get("/pageNotFound", shopController.pageNotFound);
router.get("/", shopController.loadHomePage);

// Product Routes
router.get("/shop", shopController.loadShoppingPage);
router.get("/filter", filterController.filterProducts);
router.get("/filterPrice", filterController.filterByPrice);
router.post("/search", filterController.searchProducts);
router.get("/productDetails/:id", productController.productDetails);

// Review Routes
router.post("/submit", productController.submitReview);
router.get("/api/reviews/average/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;
    const averageRating = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, average: { $avg: "$rating" } } }
    ]);
    res.json({ average: averageRating[0]?.average || 0 });
  } catch (error) {
    console.error('Error fetching average rating:', error);
    res.status(500).json({ average: 0 });
  }
})


// Authentication Routes
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/auth/google", passport.authenticate("google", { scope: ["email", "profile"] }));
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", failureMessage: true }),
  (req, res) => {
    req.session.user = req.user._id;
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.redirect("/");
  }
);
router.get("/check-session", async (req, res) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user);
      if (user && !user.isBlock) {
        return res.status(200).json({ valid: true });
      }
    }
    return res.status(401).json({ valid: false });
  } catch (error) {
    console.error("Session check error:", error);
    return res.status(500).json({ valid: false });
  }
});
router.get("/logout", userController.logout);

// Profile management
router.get('/forgot-password', profileController.getForgotPassPage);
router.post('/forgot-email-valid', profileController.forgotEmailValid);
router.post('/verify-passForgot-otp', profileController.verifyForgotPassOtp);
router.get('/reset-password', profileController.ensureValidSession, profileController.getResetPassPage);
router.post('/resend-forgot-otp', profileController.resendOtp)
router.post('/reset-password', profileController.postNewPassword)
router.get('/userProfile', profileController.userProfile)

router.get('/change-email', editProfileController.changeEmail)
router.post('/change-email', editProfileController.changeEmailValid)
router.post('/verify-email-otp', editProfileController.verifyEmailOtp)
router.get('/new-email', editProfileController.getNewEmailPage)
router.post("/update-email", editProfileController.updateEmail);
router.post('/resend-email-otp', editProfileController.resendChangeEmailOtp)
router.get('/change-password', editProfileController.changePassword)
router.post('/change-password', editProfileController.changePasswordValid)
router.post('/verify-change-pass-otp', editProfileController.verifyChangePassOtp)
router.get('/reset-password-profile', editProfileController.getPassProfile)
router.post('/reset-password-profile', editProfileController.postChangePassword)

router.post("/demo-login", userController.demoLogin);


module.exports = router;
