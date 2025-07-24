const mongoose = require("mongoose");
const { Schema } = mongoose;

const brandSchema = new Schema({
    brandName: {
        type: String,
        required: true,
        unique: true,
        // trim: true
    },
    brandLogo: {
        type: [String],
        default: null
    },
    isListed: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });


const Brand = mongoose.model("Brand", brandSchema);
module.exports = Brand;
