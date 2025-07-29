const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("../config/passport");
const User = require("../models/userSchema");

router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/auth/google", passport.authenticate("google", { scope: ["email", "profile"] }));
router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
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

module.exports = router;