// models/cartSchema.js
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Variant'
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  }
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId // Store but don't populate
    },
    variantSpecs: [{ // Store variant specs directly
      name: String,
      value: String
    }],
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true
    }
  }],
  cartTotal: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  shippingCharge: {
    type: Number,
    default: 0
  },
  finalTotal: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Update timestamps on save
cartSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Cart', cartSchema);