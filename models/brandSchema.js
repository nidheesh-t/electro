const mongoose = require("mongoose");
const { Schema } = mongoose;

const brandSchema = new Schema({
    brandName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    brandLogo: {
        public_id: {
            type: String,
            default: null
        },
        url: {
            type: String,
            default: null
        }
    },
    isListed: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Brand = mongoose.model("Brand", brandSchema);
module.exports = Brand;