const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const env = require("dotenv").config();
const session = require("express-session");


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
            subject: 'Your OTP for password reset',
            text: `Your OTP is ${otp}`,
            html: `<p style="font-size: 1.1rem;">Hello,</p><p style="font-size: 1.1rem;">Your OTP for password reset is: <strong>${otp}</strong></p>`
        });

        return info.accepted.length > 0;

    } catch (error) {
        console.error('Error sending email:', error);
        return false;
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



const changeEmail = async (req, res) => {
    try {
        res.render("change-email");
    } catch (error) {
        console.error("Error loading change email page:", error);
        res.redirect("/pageNotFound");
    }
}

const changeEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) {
            const otp = generateOTP();

            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.userData = req.body;
                req.session.email = email;

                res.render("change-email-otp");
                console.log("Generated OTP:", otp);
            } else {
                res.json("email-error")
            }
        } else {
            res.render("change-email", { message: "Email not registered" });
        }
    } catch (error) {
        console.error("Error in changeEmailValid:", error);
        res.redirect("/pageNotFound");
    }
}


const verifyEmailOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log(otp);
        if (otp === req.session.userOtp) {
            res.json({ success: true, redirectUrl: '/new-email' });
        } else {
            console.log("Invalid OTP entered");
            res.json({ success: false, message: "Invalid OTP, Please try again" });
        }
    } catch (error) {
        console.error("Error verify otp", error);
        res.status(500).send("Internal server error")

    }

}

const getNewEmailPage = async (req, res) => {
    try {
        res.render('new-email')
    } catch (error) {
        console.log("new email page not found")
        res.render('/pageNotFound')
    }

}

const updateEmail = async (req, res) => {
    try {
        const newEmail = req.body.newEmail;
        const userId = req.session.user;

        await User.findByIdAndUpdate(userId, { email: newEmail });
        res.redirect("/userProfile");
    } catch (error) {
        console.error("Error updating email:", error);
        res.redirect("/pageNotFound");
    }
}

const resendChangeEmailOtp = async (req, res) => {
    try {
        const email = req.session.email;
        if (!email) return res.json({ success: false, message: "Email not found in session" });

        const otp = generateOTP();
        const emailSent = await sendVerificationEmail(email, otp);
        console.log("Regenerated otp: ", otp);

        if (emailSent) {
            req.session.userOtp = otp;
            res.json({ success: true });
        } else {
            res.json({ success: false, message: "Failed to send OTP" });
        }
    } catch (error) {
        console.error("Error in resendChangePassOtp:", error);
        res.json({ success: false, message: "Server error" });
    }
}

const changePassword = async (req, res) => {
    try {
        res.render("change-password");
    } catch (error) {
        console.error("Error loading change password page:", error);
        res.redirect("/pageNotFound");
    }
}

const changePasswordValid = async (req, res) => {
    try {
        const { email } = req.body;
        console.log(email);

        const userExists = await User.findOne({ email });
        if (userExists) {
            const otp = generateOTP();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.userData = req.body;
                req.session.email = email;

                res.render("change-password-otp");
                console.log("Generated OTP:", otp);
            } else {
                res.json("email-error");
            }
        } else {
            res.render("change-password", { message: "Email not registered" });
        }
    } catch (error) {
        console.error("Error in changePasswordValid:", error);
        res.redirect("/pageNotFound");
    }
}

const verifyChangePassOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log(otp);
        if (otp === req.session.userOtp) {
            res.json({ success: true, redirectUrl: '/reset-password-profile' });
        } else {
            console.log("Invalid OTP entered");
            res.json({ success: false, message: "Invalid OTP, Please try again" });
        }
    } catch (error) {
        console.error("Error verify otp", error);
        res.status(500).send("Internal server error")

    }

}

const getPassProfile = async (req, res) => {
    try {
        res.render('reset-password-profile', {
            email: req.session.userData?.email || '',
            message: null
        });
    } catch (error) {
        console.error("Error rendering reset password page:", error);
        res.redirect('/change-password?message=An error occurred. Please try again.');
    }
}

const postChangePassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        const email = req.session.userData?.email;

        if (!email) {
            return res.render("reset-password-profile", {
                email: '',
                message: "Session expired. Please restart the password reset process."
            });
        }

        if (newPass1 !== newPass2) {
            return res.render("reset-password-profile", {
                email: email,
                message: "Passwords do not match"
            });
        }

        if (newPass1.length < 8) {
            return res.render("reset-password-profile", {
                email: email,
                message: "Password must be at least 8 characters long"
            });
        }

        const passwordHash = await securePassword(newPass1);
        const updatedUser = await User.findOneAndUpdate(
            { email: email },
            { $set: { password: passwordHash } },
            { new: true }
        );

        if (!updatedUser) {
            return res.render("reset-password-profile", {
                email: email,
                message: "User not found. Please try again."
            });
        }

        req.session.userOtp = null;
        req.session.userData = null;

        res.render('change-password', { message: "Password reset successfully" });

    } catch (error) {
        console.error("Error resetting password:", error);
        res.render("reset-password-profile", {
            email: req.session.userData?.email || '',
            message: "An error occurred. Please try again."
        });
    }
}



module.exports = {
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    getNewEmailPage,
    updateEmail,
    resendChangeEmailOtp,
    changePassword,
    changePasswordValid,
    verifyChangePassOtp,
    getPassProfile,
    postChangePassword
}