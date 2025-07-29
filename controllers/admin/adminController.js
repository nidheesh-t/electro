const Admin = require('../../models/adminSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const bcrypt = require('bcryptjs');


const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin-login', { message: null });
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.render('admin-login', { message: 'Invalid credentials' });
        }

        const passwordMatch = bcrypt.compareSync(password, admin.password);
        if (!passwordMatch) {
            return res.render('admin-login', { message: 'Invalid credentials, please try again' });
        }

        req.session.admin = admin._id; // Store admin ID for better tracking
        res.redirect('/admin/dashboard');

    } catch (error) {
        console.error('Error during admin login', error);
        res.redirect('/pageerror');
    }
}

const loadDashboard = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }
    try {
        const [userCount, productCount] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments(),
        ]);
        res.render('dashboard', { userCount, productCount });
    } catch (error) {
        console.error('Error loading dashboard', error);
        res.redirect('/error');
    }
}

const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying admin session', err);
            return res.redirect('/error');
        }
        res.redirect('/admin/login');
    });
}


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    logout
}