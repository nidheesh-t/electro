const Admin = require('../../models/adminSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const bcrypt = require('bcryptjs');


const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
        const limit = 5;

        const query = {
            $or: [
                { firstName: { $regex: ".*" + search + ".*", $options: "i" } },
                { lastName: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        };

        const userData = await User.find(query)
            .sort({ _id: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        const count = await User.countDocuments(query);
        const totalPages = Math.ceil(count / limit);

        res.render("customers", {
            data: userData,
            currentPage: page,
            totalPages,
            search
        });
    } catch (error) {
        console.error('Error loading customer info:', error);
        res.status(500).send('Internal Server Error');
    }
}


const blockCustomer = async (req, res) => {
    try {
        const userId = req.query.id;
        await User.findByIdAndUpdate(userId, { isBlock: true });

        const page = req.query.page || 1;
        const search = req.query.search || "";

        res.redirect(`/admin/users?page=${page}&search=${search}`);
    } catch (error) {
        console.error('Error blocking customer:', error);
        res.redirect("pageerror");
    }
}

const unblockCustomer = async (req, res) => {
    try {
        const userId = req.query.id;
        await User.findByIdAndUpdate(userId, { isBlock: false });

        const page = req.query.page || 1;
        const search = req.query.search || "";

        res.redirect(`/admin/users?page=${page}&search=${search}`);
    } catch (error) {
        console.error('Error unblocking customer:', error);
        res.redirect("pageerror");
    }
}



module.exports = {
    customerInfo,
    blockCustomer,
    unblockCustomer
}