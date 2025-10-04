const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const bcrypt = require("bcryptjs");
const Razorpay = require("razorpay");
const crypto = require("crypto");

// ✅ Initialize Razorpay Instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = {
  /* ===========================
   * 🧑 User Authentication
   * =========================== */
  doSignup: async (data) => {
    const userExists = await User.findOne({ email: data.email });
    if (userExists) return { status: false, message: "Email already registered" };

    data.password = await bcrypt.hash(data.password, 10);
    const user = await User.create(data);
    return { status: true, user };
  },

  doLogin: async (data) => {
    const user = await User.findOne({ email: data.email });
    if (!user) return { status: false, message: "User not found" };

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) return { status: false, message: "Incorrect password" };

    return { status: true, user };
  },

  /* ===========================
   * 🛒 CART MANAGEMENT
   * =========================== */
  getCart: async (userId) => {
    return await Cart.findOne({ userId }).populate("products.productId").lean();
  },

  getCartCount: async (userId) => {
    if (!userId) return 0;
    const cart = await Cart.findOne({ userId });
    return cart ? cart.products.length : 0;
  },

  addToCart: async (userId, productId) => {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, products: [] });
    }

    const productIndex = cart.products.findIndex((p) => p.productId.toString() === productId);
    if (productIndex >= 0) {
      cart.products[productIndex].quantity += 1;
    } else {
      cart.products.push({ productId, quantity: 1 });
    }

    await cart.save();
    return cart;
  },

  updateQuantity: async (userId, productId, action) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) return;

    const productIndex = cart.products.findIndex((p) => p.productId.toString() === productId);
    if (productIndex >= 0) {
      if (action === "inc") cart.products[productIndex].quantity++;
      if (action === "dec" && cart.products[productIndex].quantity > 1)
        cart.products[productIndex].quantity--;
    }

    await cart.save();
    return cart;
  },

  removeFromCart: async (userId, productId) => {
    await Cart.updateOne({ userId }, { $pull: { products: { productId } } });
  },

  clearCart: async (userId) => {
    await Cart.deleteOne({ userId });
  },

  /* ===========================
   * 📦 ORDER MANAGEMENT
   * =========================== */
  placeOrder: async (userId, data, paymentMethod) => {
    const cart = await Cart.findOne({ userId }).populate("products.productId");
    if (!cart) throw new Error("Cart not found");

    let total = 0;
    cart.products.forEach((item) => {
      total += item.productId.price * item.quantity;
    });

    await Order.create({
      userId,
      products: cart.products,
      total,
      paymentMethod,
      mobile: data.mobile,
      address: data.address,
      pincode: data.pincode,
      locationLink: data.locationLink,
    });

    return true;
  },

  updateOrderAddress: async (orderId, userId, data) => {
    await Order.updateOne(
      { _id: orderId, userId },
      {
        $set: {
          address: data.address,
          mobile: data.mobile,
          pincode: data.pincode,
          locationLink: data.locationLink,
        },
      }
    );
  },

  cancelOrder: async (orderId, userId) => {
    await Order.updateOne({ _id: orderId, userId }, { $set: { status: "Cancelled" } });
  },

  /* ===========================
   * ⭐ PRODUCT REVIEWS
   * =========================== */

/* ✅ Fetch product reviews with user name + isOwner flag */
async getProductReviews(productId, currentUserId) {
  try {
    const product = await Product.findById(productId)
      .select("reviews")
      .populate("reviews.user", "name") // only get user name
      .lean();

    if (!product || !product.reviews) return [];

    return product.reviews.map((r) => ({
      _id: r._id,
      rating: r.rating,
      comment: r.comment,
      date: r.date,
      user: r.user ? { name: r.user.name } : { name: "Unknown" },
      isOwner: currentUserId ? r.user?._id?.toString() === currentUserId.toString() : false
    }));
  } catch (err) {
    console.error("getProductReviews error:", err);
    return [];
  }
},
// ✅ Add Product Review
addProductReview: async (userId, productId, rating, comment) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  // Optional: prevent duplicate review from same user
  const already = product.reviews.find(r => r.user.toString() === userId.toString());
  if (already) throw new Error("You already reviewed this product");

  product.reviews.push({
    user: userId,
    rating,
    comment,
    date: new Date()
  });

  await product.save();
},

// ✅ Delete Product Review
deleteReview: async (userId, reviewId) => {
  const product = await Product.findOne({ "reviews._id": reviewId });
  if (!product) throw new Error("Product not found");

  // find index of review owned by this user
  const index = product.reviews.findIndex(
    r => r._id.toString() === reviewId && r.user.toString() === userId.toString()
  );

  if (index === -1) throw new Error("Review not found or not yours");

  // remove review from array
  product.reviews.splice(index, 1);

  await product.save();
},

  canUserReviewProduct: async (userId, productId) => {
    if (!userId) return false;

    const deliveredOrders = await Order.find({
      userId,
      status: "Delivered",
      "products.productId": productId,
    });

    return deliveredOrders.length > 0;
  },
/* ===========================
 * 💳 RAZORPAY PAYMENT
 * =========================== */
createRazorpayOrder: async (userId, mobile, address, locationLink, pincode) => {
  // ✅ Fetch user cart
  const cart = await Cart.findOne({ userId }).populate("products.productId");
  if (!cart || !cart.products.length) throw new Error("Cart is empty");

  const total = cart.products.reduce((sum, item) => sum + item.productId.price * item.quantity, 0);

  // ✅ Validation before calling Razorpay
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys are not configured");
  }

  try {
    console.log("🔄 Creating Razorpay Order:", {
      amount: (total + 50) * 100,
      currency: "INR"
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: (total + 50) * 100, // must be in paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: { userId: String(userId) }
    });

    console.log("✅ Razorpay order created:", razorpayOrder);

    // ✅ Save local order in DB
    const localOrder = await Order.create({
      userId,
      products: cart.products,
      total,
      mobile,
      address,
      locationLink,
      pincode,
      paymentMethod: "ONLINE",
      razorpayOrderId: razorpayOrder.id,
      paymentStatus: "Pending",
      status: "Placed"
    });

    return {
      success: true,
      rzpOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      localOrderId: localOrder._id
    };

  } catch (err) {
    console.error("❌ Razorpay order creation failed:", err.response?.data || err.message || err);
    throw new Error(err.response?.data?.error?.description || "Failed to create Razorpay order");
  }
},

// ✅ Verify Razorpay Payment with rollback support
verifyRazorpayPayment: async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature, userId }) => {
  try {
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature === razorpay_signature) {
      await Order.updateOne(
        { razorpayOrderId: razorpay_order_id },
        {
          $set: {
            paymentStatus: "Success",
            paymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            status: "Paid"
          }
        }
      );
      await Cart.deleteOne({ userId });
      return { success: true };
    } else {
      await Order.updateOne(
        { razorpayOrderId: razorpay_order_id },
        { $set: { paymentStatus: "Failed", status: "Cancelled" } }
      );
      return { success: false, message: "Payment verification failed" };
    }
  } catch (err) {
    console.error("❌ Payment verification error:", err);
    await Order.updateOne(
      { razorpayOrderId: razorpay_order_id },
      { $set: { paymentStatus: "Failed", status: "Cancelled" } }
    );
    return { success: false, message: "Server error verifying payment" };
  }
},


};
