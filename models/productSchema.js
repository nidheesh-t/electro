const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    description: {
        type: String,
        required: true
    },
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
        required: true,
        min: [0, "Regular price must be positive"]
    },
    salePrice: {
        type: Number,
        required: true,
        min: [0, "Sale price must be positive"],
        validate: {
            validator: function (value) {
                return value <= this.regularPrice;
            },
            message: "Sale price must be less than or equal to regular price"
        }
    },
    productOffer: {
        type: Number,
        default: 0
    },
    variants: [{
        specs: [{
            name: String,
            value: String
        }],
        quantity: {
            type: Number,
            required: true,
            min: [0, "Quantity cannot be negative"]
        }
    }],
    totalQuantity: {
        type: Number,
        default: 0,
        min: [0, "Total quantity cannot be negative"]
    },
    productImage: {
        type: [String],
        required: true
    },
    isListed: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["Available", "Out of Stock", "Discontinued"],
        default: "Available"
    }
}, { timestamps: true });

// Pre-save hook to calculate totalQuantity from variants
productSchema.pre('save', function (next) {
    this.totalQuantity = this.variants.reduce((sum, variant) => sum + (variant.quantity || 0), 0);
    this.status = this.totalQuantity <= 0 ? "Out of Stock" : "Available";
    next();
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;