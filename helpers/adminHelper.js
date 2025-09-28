const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Admin = require('../models/Admin');

module.exports = {
  addProduct: async (productData) => {
    try {
      const newProduct = new Product(productData);
      return await newProduct.save();
    } catch (err) {
      throw err;
    }
  },

  getAllProducts: async () => {
    try {
      return await Product.find().sort({ createdAt: -1 }).lean();
    } catch (err) {
      throw err;
    }
  },

  deleteProduct: async (id) => {
    try {
      return await Product.findByIdAndDelete(id);
    } catch (err) {
      throw err;
    }
  },
  getProductById: async (id) => {
  try {
    return await Product.findById(id).lean();
  } catch (err) {
    throw err;
  }
},

updateProduct: async (id, updateData) => {
  try {
    return await Product.findByIdAndUpdate(id, updateData);
  } catch (err) {
    throw err;
  }
},
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
      .populate('userId', 'name email')              // fetch user details
      .populate('products.productId') // fetch product details
      .sort({ createdAt: -1 })
      .lean();
  },

  updateOrderStatus: async (orderId, status) => {
  await Order.findByIdAndUpdate(orderId, { status });
},
getAllUsersWithReviews : async () => {
  const users = await User.find().lean();

  // Attach reviews for each user
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
deleteReview : async (reviewId) => {
  const product = await Product.findOne({ "reviews._id": reviewId });
  if (!product) throw new Error("Review not found");

  product.reviews = product.reviews.filter(r => r._id.toString() !== reviewId);
  await product.save();
},
 
 // ✅ FIXED: updateAdminInfo function
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

  // ✅ ADD: Get single admin info
  getAdminInfo: async () => {
    try {
      const adminInfo = await Admin.findOne().sort({ createdAt: -1 }).lean();
      return adminInfo || null;
    } catch (err) {
      console.error("Error in getAdminInfo:", err);
      return null;
    }
  },

  // ✅ ADD: Update existing admin info
  updateAdminInfoById: async (id, adminData) => {
    try {
      return await Admin.findByIdAndUpdate(id, adminData, { new: true });
    } catch (err) {
      console.error("Error in updateAdminInfoById:", err);
      throw err;
    }
  },

  // ✅ ADD: Get admin info by ID
  getAdminInfoById: async (id) => {
    try {
      return await Admin.findById(id).lean();
    } catch (err) {
      console.error("Error in getAdminInfoById:", err);
      throw err;
    }
  },
};
