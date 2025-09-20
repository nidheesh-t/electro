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


const demoLogin = async (req, res) => {
    try {
        let demoUser = await User.findOne({ email: 'demo@123.com' });

        if (!demoUser) {
            const demoPassword = 'Demo1234';
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

        if (demoUser.isBlock) {
            req.flash('error', 'Demo account is blocked. Please contact support.');
            return res.redirect('/login');
        }

        req.session.user = demoUser._id;
        return res.redirect('/');

    } catch (error) {
        console.error('Demo login error:', error);
        req.flash('error', 'An error occurred during demo login. Please try again.');
        return res.redirect('/login');
    }
};


module.exports = {
    loadSignup,
    loadLogin,
    login,
    signup,
    verifyOtp,
    resendOtp,
    logout,
    demoLogin
}






