const mongoose = require("mongoose");
const { Schema } = mongoose;

const categorySchema = new Schema({
    categoryName: {
        type: String,
        required: true,
        unique: true,
        // trim: true,
        // lowercase: true,
    },
    description: {
        type: String,
        required: true
    },
    isListed: {
        type: Boolean,
        default: true
    },
    categoryOffer: {
        type: Number,
        default: 0
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });


const Category = mongoose.model("Category", categorySchema);
module.exports = Category;

