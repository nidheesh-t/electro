const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
    couponCode: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    offerPrice: {
        type: Number,
        required: true,
    },
    minimumPrice: {
        type: Number,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true
    },
    usedBy: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }]
}, { timestamps: true });


const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;
