const mongoose = require("mongoose");
const { Schema } = mongoose

const userSchema = new Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    password: {
        type: String,
        required: false
    },
    isBlock: {
        type: Boolean,
        default: false
    },
    wallet: {
        type: Number,
        default: 0
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart"
    }],
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Wishlist"
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order"
    }],
    referralCode: {
        type: String
    },
    redeemed: {
        type: Boolean,
        default: false
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
        },
        brand: {
            type: String
        },
        searchOn: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true })

const User = mongoose.model("User", userSchema);
module.exports = User;
