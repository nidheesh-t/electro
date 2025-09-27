const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema'); // Add this import

const cartController = {
  // NEW METHOD: Render cart page (HTML)
  renderCartPage: async (req, res) => {
    try {
      const userId = req.session.user;
      let userData = null;

      // Get user data if logged in
      if (userId) {
        userData = await User.findById(userId).lean();
      }

      let cart = { 
        items: [], 
        cartTotal: 0, 
        finalTotal: 0, 
        shippingCharge: 0, 
        discount: 0 
      };

      // Get cart data if user is logged in
      if (userId) {
        const cartData = await Cart.findOne({ userId })
          .populate('items.productId');
        
        if (cartData) {
          // Enhance cart with variant data for display
          const enhancedCart = await enhanceCartWithVariantData(cartData);
          cart = enhancedCart;
        }
      }

      // Render the cart page with data
      res.render('cart', {
        user: userData,
        cart: cart
      });

    } catch (error) {
      console.error('Error rendering cart page:', error);
      // Render cart page with empty cart on error
      res.render('cart', {
        user: null,
        cart: { items: [], cartTotal: 0, finalTotal: 0, shippingCharge: 0, discount: 0 }
      });
    }
  },

  // EXISTING METHOD: Get cart data (JSON for AJAX)
  getCart: async (req, res) => {
    try {
      const userId = req.session.user;

      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Please login to view cart',
          cart: { items: [], cartTotal: 0, finalTotal: 0, shippingCharge: 0, discount: 0 }
        });
      }

      const cart = await Cart.findOne({ userId })
        .populate('items.productId');

      if (!cart) {
        return res.json({
          success: true,
          cart: { items: [], cartTotal: 0, finalTotal: 0, shippingCharge: 0, discount: 0 }
        });
      }

      const enhancedCart = await enhanceCartWithVariantData(cart);
      res.json({ success: true, cart: enhancedCart });
    } catch (error) {
      console.error('Error fetching cart:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch cart' });
    }
  },

  addToCart: async (req, res) => {
    try {
      const { productId, variantId, quantity } = req.body;
      const userId = req.session.user;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login to add items to cart' });
      }

      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({ success: false, message: 'Invalid product data' });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      let availableQuantity = product.totalQuantity;
      let selectedVariant = null;

      if (variantId && product.variants.length > 0) {
        selectedVariant = product.variants.id(variantId);
        if (!selectedVariant) {
          return res.status(404).json({ success: false, message: 'Variant not found' });
        }
        availableQuantity = selectedVariant.quantity;
      }

      if (availableQuantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${availableQuantity} items available in stock`
        });
      }

      const price = product.salePrice;
      const totalPrice = price * quantity;

      let cart = await Cart.findOne({ userId });

      if (!cart) {
        cart = new Cart({ userId, items: [] });
      }

      const existingItemIndex = cart.items.findIndex(item =>
        item.productId.toString() === productId &&
        (!variantId || item.variantId?.toString() === variantId)
      );

      if (existingItemIndex > -1) {
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;

        if (newQuantity > availableQuantity) {
          return res.status(400).json({
            success: false,
            message: `Cannot add more than ${availableQuantity} items`
          });
        }

        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].totalPrice = price * newQuantity;
      } else {
        cart.items.push({
          productId,
          variantId: variantId || null, // Store variantId but don't populate it
          quantity,
          price,
          totalPrice,
          variantSpecs: selectedVariant ? selectedVariant.specs : [] // Store variant specs directly
        });
      }

      await calculateCartTotals(cart);
      await cart.save();

      await cart.populate('items.productId');

      res.json({
        success: true,
        message: 'Product added to cart successfully',
        cartCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        cart
      });

    } catch (error) {
      console.error('Error adding to cart:', error);
      res.status(500).json({ success: false, message: 'Failed to add product to cart' });
    }
  },

  updateCartItem: async (req, res) => {
    try {
      const { itemId, quantity } = req.body;
      const userId = req.session.user;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login' });
      }

      if (quantity < 1) {
        return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
      }

      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }

      const cartItem = cart.items.id(itemId);
      if (!cartItem) {
        return res.status(404).json({ success: false, message: 'Item not found in cart' });
      }

      const product = await Product.findById(cartItem.productId);
      let availableQuantity = product.totalQuantity;

      if (cartItem.variantId) {
        const variant = product.variants.id(cartItem.variantId);
        availableQuantity = variant ? variant.quantity : 0;
      }

      if (quantity > availableQuantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${availableQuantity} items available`
        });
      }

      cartItem.quantity = quantity;
      cartItem.totalPrice = cartItem.price * quantity;

      await calculateCartTotals(cart);
      await cart.save();

      await cart.populate('items.productId');

      res.json({
        success: true,
        message: 'Cart updated successfully',
        cart
      });

    } catch (error) {
      console.error('Error updating cart:', error);
      res.status(500).json({ success: false, message: 'Failed to update cart' });
    }
  },

  removeFromCart: async (req, res) => {
    try {
      const { itemId } = req.body;
      const userId = req.session.user;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login' });
      }

      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }

      cart.items = cart.items.filter(item => item._id.toString() !== itemId);

      await calculateCartTotals(cart);
      await cart.save();

      await cart.populate('items.productId');

      res.json({
        success: true,
        message: 'Item removed from cart',
        cartCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        cart
      });

    } catch (error) {
      console.error('Error removing from cart:', error);
      res.status(500).json({ success: false, message: 'Failed to remove item from cart' });
    }
  },

  clearCart: async (req, res) => {
    try {
      const userId = req.session.user;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login' });
      }

      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }

      cart.items = [];
      cart.cartTotal = 0;
      cart.finalTotal = 0;
      cart.discount = 0;

      await cart.save();

      res.json({
        success: true,
        message: 'Cart cleared successfully',
        cart
      });

    } catch (error) {
      console.error('Error clearing cart:', error);
      res.status(500).json({ success: false, message: 'Failed to clear cart' });
    }
  }
};

clearCartAfterCheckout: async (userId, session = null) => {
  try {
    const options = session ? { session } : {};
    const cart = await Cart.findOne({ userId });
    
    if (cart) {
      cart.items = [];
      cart.cartTotal = 0;
      cart.finalTotal = 0;
      cart.discount = 0;
      cart.shippingCharge = 0;
      
      await cart.save(options);
    }
  } catch (error) {
    console.error('Error clearing cart after checkout:', error);
    throw error;
  }
}

async function calculateCartTotals(cart) {
  cart.cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
  cart.shippingCharge = cart.cartTotal >= 999 ? 0 : 50;
  cart.discount = 0;
  cart.finalTotal = cart.cartTotal - cart.discount + cart.shippingCharge;
}

async function enhanceCartWithVariantData(cart) {
  const cartObj = cart.toObject ? cart.toObject() : cart;

  for (let item of cartObj.items) {
    if (item.variantId && item.productId) {
      const product = await Product.findById(item.productId);
      if (product && product.variants) {
        const variant = product.variants.id(item.variantId);
        if (variant) {
          item.variantDetails = variant;
        }
      }
    }
  }

  return cartObj;
}

module.exports = cartController;