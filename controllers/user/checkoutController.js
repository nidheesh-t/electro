const Checkout = require('../../models/checkoutSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');

const checkoutController = {
  // Render checkout page
  renderCheckoutPage: async (req, res) => {
    try {
      const userId = req.session.user;
      
      if (!userId) {
        return res.redirect('/login?redirect=checkout');
      }

      const user = await User.findById(userId).lean();
      const cart = await Cart.findOne({ userId }).populate('items.productId');

      if (!cart || cart.items.length === 0) {
        return res.redirect('/cart');
      }

      res.render('checkout', {
        user: user,
        cart: cart,
        cartCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
      });
    } catch (error) {
      console.error('Error rendering checkout page:', error);
      res.redirect('/cart');
    }
  },

  // Process checkout
  processCheckout: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userId = req.session.user;
      const { 
        firstName, 
        lastName, 
        email, 
        phone, 
        address, 
        city, 
        state, 
        pincode, 
        paymentMethod 
      } = req.body;

      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Please login to continue' 
        });
      }

      // Validate required fields
      if (!firstName || !lastName || !email || !phone || !address || !city || !state || !pincode || !paymentMethod) {
        return res.status(400).json({ 
          success: false, 
          message: 'All fields are required' 
        });
      }

      // Get user's cart
      const cart = await Cart.findOne({ userId }).populate('items.productId').session(session);
      
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cart is empty' 
        });
      }

      // Check stock availability
      for (let item of cart.items) {
        const product = item.productId;
        let availableQuantity = product.totalQuantity;

        if (item.variantId) {
          const variant = product.variants.id(item.variantId);
          availableQuantity = variant ? variant.quantity : 0;
        }

        if (availableQuantity < item.quantity) {
          await session.abortTransaction();
          session.endSession();
          
          return res.status(400).json({ 
            success: false, 
            message: `Only ${availableQuantity} items available for ${product.productName}` 
          });
        }
      }

      // Create checkout order
      const checkout = new Checkout({
        userId,
        items: cart.items.map(item => ({
          productId: item.productId._id,
          variantId: item.variantId,
          variantSpecs: item.variantSpecs,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice
        })),
        shippingAddress: {
          firstName,
          lastName,
          email,
          phone,
          address,
          city,
          state,
          pincode
        },
        paymentMethod,
        subtotal: cart.cartTotal,
        shippingCharge: cart.shippingCharge,
        discount: cart.discount,
        totalAmount: cart.finalTotal
      });

      await checkout.save({ session });

      // Update product quantities
      for (let item of cart.items) {
        const product = await Product.findById(item.productId._id).session(session);
        
        if (item.variantId) {
          const variant = product.variants.id(item.variantId);
          if (variant) {
            variant.quantity -= item.quantity;
          }
        } else {
          product.totalQuantity -= item.quantity;
        }

        product.totalQuantity = product.variants.reduce((sum, variant) => sum + variant.quantity, 0);
        product.status = product.totalQuantity <= 0 ? "Out of Stock" : "Available";
        
        await product.save({ session });
      }

      // Clear cart
      cart.items = [];
      cart.cartTotal = 0;
      cart.finalTotal = 0;
      cart.discount = 0;
      cart.shippingCharge = 0;
      
      await cart.save({ session });

      await session.commitTransaction();
      session.endSession();

      // For COD orders, mark as completed immediately
      if (paymentMethod === 'cod') {
        checkout.paymentStatus = 'completed';
        checkout.orderStatus = 'confirmed';
        await checkout.save();
      }

      res.json({
        success: true,
        message: 'Order placed successfully!',
        orderId: checkout.orderId,
        paymentMethod: paymentMethod,
        redirectUrl: `/order-confirmation/${checkout._id}`
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      console.error('Error processing checkout:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to process order. Please try again.' 
      });
    }
  },

  // Order confirmation page
  orderConfirmation: async (req, res) => {
    try {
      const userId = req.session.user;
      const orderId = req.params.id;

      if (!userId) {
        return res.redirect('/login');
      }

      const order = await Checkout.findOne({ 
        _id: orderId, 
        userId 
      }).populate('items.productId');

      if (!order) {
        return res.redirect('/cart');
      }

      const user = await User.findById(userId).lean();

      res.render('order-confirmation', {
        user: user,
        order: order,
        cartCount: 0
      });
    } catch (error) {
      console.error('Error loading order confirmation:', error);
      res.redirect('/cart');
    }
  },

  // Get user orders
  getUserOrders: async (req, res) => {
    try {
      const userId = req.session.user;

      if (!userId) {
        return res.redirect('/login');
      }

      const orders = await Checkout.find({ userId })
        .populate('items.productId')
        .sort({ createdAt: -1 })
        .lean();

      const user = await User.findById(userId).lean();

      res.render('orders', {
        user: user,
        orders: orders,
        cartCount: 0
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.redirect('/');
    }
  },

  // Get order details
  getOrderDetails: async (req, res) => {
    try {
      const userId = req.session.user;
      const orderId = req.params.id;

      if (!userId) {
        return res.redirect('/login');
      }

      const order = await Checkout.findOne({ 
        _id: orderId, 
        userId 
      }).populate('items.productId');

      if (!order) {
        return res.redirect('/orders');
      }

      const user = await User.findById(userId).lean();

      res.render('order-details', {
        user: user,
        order: order,
        cartCount: 0
      });
    } catch (error) {
      console.error('Error fetching order details:', error);
      res.redirect('/orders');
    }
  }
};

module.exports = checkoutController;