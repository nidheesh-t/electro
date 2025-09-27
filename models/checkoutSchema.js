const mongoose = require('mongoose');
const { Schema } = mongoose;

const checkoutSchema = new Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variantId: Schema.Types.ObjectId,
    variantSpecs: [{
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
  shippingAddress: {
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
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pincode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      default: 'India'
    }
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'upi', 'net_banking', 'cod'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  subtotal: {
    type: Number,
    required: true
  },
  shippingCharge: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String
}, {
  timestamps: true
});

// Generate order ID before saving
checkoutSchema.pre('save', async function(next) {
  if (this.isNew) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderId = `ORD${timestamp}${random}`;
  }
  next();
});

module.exports = mongoose.model('Checkout', checkoutSchema);