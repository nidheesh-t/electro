const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    variants: [{
        color: String,
        storage: String,
        ram: String,
        screen: String
    }],
    brand: {
        type: Schema.Types.ObjectId,
        ref: "Brand",
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true,
        validate: {
            validator: function (value) {
                return value <= this.regularPrice;
            },
            message: 'Sale price must be less than or equal to regular price'
        }
    },
    productOffer: {
        type: Number,
        default: 0
    },
    quantity: {
        type: Number,
        required: true,
        default: 0
    },
    productImage: {
        type: [String],
        required: true
    },
    isListed: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ["Available", "Out of stock", "Discontinued"],
        default: "Available"
    }
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;

