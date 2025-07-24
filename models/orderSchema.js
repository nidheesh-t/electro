const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4()
    },
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true,
        }
    }],
    totalPrice: {
        type: Number,
        required: true,
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true,
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: "Address",
        required: true
    },
    invoiceDate: {
        type: Date,
    },
    paymentMethod: {
        type: String,
        enum: ["Credit Card", "Debit Card", "Net Banking", "Wallet", "Cash on Delivery", "UPI"],
        default: "Cash on Delivery"
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Completed", "Failed"],
        default: "Pending"
    },
    deliveryStatus: {
        type: String,
        enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return request", "Returned"],
        default: "Pending"
    },
    couponApplied:{
        type: Boolean,
        default: false
    }

}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
