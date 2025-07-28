const User = require("../../models/userSchema");
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


const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;

        if (user) {
            const userData = await User.findById({ _id: user })
            res.render("home", { user: userData });
        } else {
            return res.render("home");
        }

    } catch (error) {
        console.error("Error loading homepage", error);
        res.status(500).send("Internal server error");
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
            return res.render("login");
        } else {
            res.redirect("/");
        }

    } catch (error) {
        console.log("Login page not found");
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
        req.session.destroy((err) => {
            if (err) {
                console.log("Session destroy error", err.message);
                return res.redirect("/pagenotFound");
            }
            return res.redirect("/login");
        })
    } catch (error) {
        console.log("Logout error", error.message);
        res.redirect("/pagenotFound");
    }
}


module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    loadLogin,
    login,
    signup,
    verifyOtp,
    resendOtp,
    logout
}