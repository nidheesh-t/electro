const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const Review = require('../../models/reviewSchema');
const mongoose = require('mongoose');


const productDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    let userData = null;

    if (userId) {
      userData = await User.findById(userId).lean();
      if (userData) {
        req.session.userName = `${userData.firstName} ${userData.lastName}`;
      }
    }

    const productId = req.params.id;

    const product = await Product.findOne({
      _id: new mongoose.Types.ObjectId(productId),
      isListed: true,
      isDeleted: false
    })
      .populate({
        path: 'brand',
        match: { isListed: true, isDeleted: false }
      })
      .populate({
        path: 'category',
        match: { isListed: true, isDeleted: false }
      })
      .lean();

    // Check if product, brand, or category is invalid
    if (!product || !product.brand || !product.category) {
      return res.redirect('/shop');
    }

    const reviews = await Review.find({
      product: new mongoose.Types.ObjectId(productId)
    })
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const averageRating = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, average: { $avg: '$rating' } } }
    ]);

    const relatedProducts = await Product.find({
      category: new mongoose.Types.ObjectId(product.category._id),
      _id: { $ne: new mongoose.Types.ObjectId(productId) },
      isListed: true,
      isDeleted: false
    })
      .limit(4)
      .populate('brand')
      .lean();

    const variants = product.variants || [];

    const categoryOffer = Number(product.category?.categoryOffer) || 0;
    const productOffer = Number(product.productOffer) || 0;
    const totalOffer = categoryOffer + productOffer;

    res.render('product-details', {
      user: userData,
      product,
      quantity: product.totalTotal,
      totalOffer,
      category: product.category,
      reviews,
      averageRating: averageRating[0]?.average || 0,
      relatedProducts,
      specs: variants.flatMap(v => v.specs)
    });

  } catch (error) {
    console.error('Error fetching product details:', {
      error: error.message,
      stack: error.stack,
      productId: req.params.id,
      userId: req.session.user
    });
    res.redirect('/pageNotFound');
  }
}

const submitReview = async (req, res) => {
  try {
    const { productId, rating, comment, userId } = req.body;
    const sessionUserId = req.session.user;

    if (!sessionUserId) {
      return res.status(401).json({ success: false, message: 'Please login to submit a review' });
    }

    if (userId !== sessionUserId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized user' });
    }

    if (!productId || !rating || !comment) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
    }

    if (comment.length > 500) {
      return res.status(400).json({ success: false, message: 'Comment cannot exceed 500 characters' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const existingReview = await Review.findOne({ user: userId, product: productId });
    if (existingReview) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this product' });
    }

    const review = new Review({
      user: userId,
      product: productId,
      rating: parsedRating,
      comment
    });

    await review.save();
    await Product.findByIdAndUpdate(productId, { $push: { review: review._id } });

    res.json({
      success: true,
      message: 'Review submitted successfully',
      review: {
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        user: {
          firstName: user.firstName,
          lastName: user.lastName
        }
      }
    });

  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
};




module.exports = {
  productDetails,
  submitReview
};