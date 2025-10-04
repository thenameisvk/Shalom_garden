const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Admin = require('../models/Admin');
const cloudinary = require('../cloudinary');

module.exports = {
  // =====================
  // PRODUCT HELPERS
  // =====================

  addProduct: async (productData) => {
    try {
      const newProduct = new Product(productData);
      return await newProduct.save();
    } catch (err) {
      console.error("Error in addProduct:", err);
      throw err;
    }
  },

  getAllProducts: async () => {
    try {
      return await Product.find().sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.error("Error in getAllProducts:", err);
      throw err;
    }
  },

  getProductById: async (id) => {
    try {
      return await Product.findById(id).lean();
    } catch (err) {
      console.error("Error in getProductById:", err);
      throw err;
    }
  },

  updateProduct: async (id, updateData) => {
    try {
      return await Product.findByIdAndUpdate(id, updateData, { new: true });
    } catch (err) {
      console.error("Error in updateProduct:", err);
      throw err;
    }
  },

  deleteProduct: async (id) => {
    try {
      const product = await Product.findById(id);

      if (product) {
        // delete from Cloudinary first
        if (product.imagePublicId) {
          await cloudinary.uploader.destroy(product.imagePublicId);
        }

        return await Product.findByIdAndDelete(id);
      }
      return null;
    } catch (err) {
      console.error("Error in deleteProduct:", err);
      throw err;
    }
  },

  // =====================
  // DASHBOARD HELPERS
  // =====================

  getTotalUsers: async () => {
    return await User.countDocuments();
  },

  getTotalProducts: async () => {
    return await Product.countDocuments();
  },

  getTotalOrders: async () => {
    return await Order.countDocuments();
  },

  getAllOrders: async () => {
    return await Order.find()
      .populate('userId', 'name email')       // user details
      .populate('products.productId')         // product details
      .sort({ createdAt: -1 })
      .lean();
  },

  updateOrderStatus: async (orderId, status) => {
    await Order.findByIdAndUpdate(orderId, { status });
  },

  // =====================
  // USER & REVIEWS
  // =====================

  getAllUsersWithReviews: async () => {
    const users = await User.find().lean();

    for (let user of users) {
      const products = await Product.find({ "reviews.user": user._id })
        .select("name reviews")
        .lean();

      user.reviews = [];

      products.forEach(product => {
        product.reviews.forEach(r => {
          if (r.user.toString() === user._id.toString()) {
            user.reviews.push({
              _id: r._id,
              rating: r.rating,
              comment: r.comment,
              date: r.date,
              product: { name: product.name }
            });
          }
        });
      });
    }
    return users;
  },

  deleteReview: async (reviewId) => {
    const product = await Product.findOne({ "reviews._id": reviewId });
    if (!product) throw new Error("Review not found");

    product.reviews = product.reviews.filter(r => r._id.toString() !== reviewId);
    await product.save();
  },

  // =====================
  // ADMIN INFO
  // =====================

  updateAdminInfo: async (adminData) => {
    try {
      const newUpdate = new Admin(adminData);
      return await newUpdate.save();
    } catch (err) {
      console.error("Error in updateAdminInfo:", err);
      throw err;
    }
  },

  getUpdateData: async () => {
    try {
      return await Admin.find().sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.error("Error in getUpdateData:", err);
      throw err;
    }
  },

  getAdminInfo: async () => {
    try {
      return await Admin.findOne().sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.error("Error in getAdminInfo:", err);
      return null;
    }
  },

  updateAdminInfoById: async (id, adminData) => {
    try {
      return await Admin.findByIdAndUpdate(id, adminData, { new: true });
    } catch (err) {
      console.error("Error in updateAdminInfoById:", err);
      throw err;
    }
  },

  getAdminInfoById: async (id) => {
    try {
      return await Admin.findById(id).lean();
    } catch (err) {
      console.error("Error in getAdminInfoById:", err);
      throw err;
    }
  }
};
