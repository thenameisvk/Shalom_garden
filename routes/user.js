const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Order = require("../models/Order");
const userHelper = require("../helpers/userHelper");
const adminHelper = require("../helpers/adminHelper");
const { ensureUser } = require("../config/auth");
const crypto = require("crypto");

/**
 * Middleware: make session & cartCount available to all views (res.locals)
 */
router.use(async (req, res, next) => {
  try {
    res.locals.session = req.session || {};
    if (req.session && req.session.user) {
      res.locals.cartCount = await userHelper.getCartCount(req.session.user._id);
    } else {
      res.locals.cartCount = 0;
    }
  } catch (err) {
    console.error("Cart-count middleware error:", err);
    res.locals.cartCount = 0;
  }
  next();
});

/* Landing Page (no layout) */
router.get("/", async (req, res) => {
  res.render("index", { layout: false, title: "Welcome" });
});

/* Home */
/* Home */
router.get("/home", async (req, res) => {
  try {
    const products = await Product.find().lean();
    
    // Calculate average ratings for ALL products
    const productsWithRatings = await Promise.all(
      products.map(async (product) => {
        try {
          // Fetch reviews for each product
          const reviews = await userHelper.getProductReviews(product._id);
          
          // Calculate average rating
          const averageRating = reviews.length
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : 0;
          
          // Count total reviews
          const totalReviews = reviews.length;
          
          return {
            ...product,
            averageRating: parseFloat(averageRating), // Convert to number
            totalReviews,
            reviews // Optional: include reviews if needed
          };
        } catch (error) {
          console.error(`Error fetching reviews for product ${product._id}:`, error);
          return {
            ...product,
            averageRating: 0,
            totalReviews: 0,
            reviews: []
          };
        }
      })
    );

    res.render("user/home", {
      title: "Home",
      products: productsWithRatings
    });
  } catch (err) {
    console.error("Home page error:", err);
    res.redirect("/error");
  }
});

/* ✅ View Product (with reviews & cart count) */
router.get("/view-product/:id", ensureUser, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.redirect("/home");

    // fetch reviews with user names + isOwner flag
    const reviews = await userHelper.getProductReviews(product._id, req.session.user?._id);

    // check if current user already reviewed (to hide form)
    const alreadyReviewed = reviews.some(r => r.isOwner);

    // calculate average rating
    const averageRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    // get cart count for header
    const cartCount = req.session.user
      ? await userHelper.getCartCount(req.session.user._id)
      : 0;

    res.render("user/view-product", {
      title: `${product.name} | Shalom Garden`,
      product,
      relatedProducts: await Product.find({
        category: product.category,
        _id: { $ne: product._id }
      }).limit(6).lean(),
      reviews,
      averageRating,
      totalReviews: reviews.length,
      canReview: !alreadyReviewed, // hide form if user already reviewed
      cartCount,
      session: req.session,
      query: req.query // so hbs can use ?review=success or ?error=...
    });
  } catch (err) {
    console.error("Error loading product:", err);
    res.redirect("/home?error=product_not_found");
  }
});

// Add Review Route
router.post("/product/:productId/review", ensureUser, async (req, res) => {
  try {
    await userHelper.addProductReview(req.session.user._id, req.params.productId, Number(req.body.rating), req.body.comment);
    res.redirect(`/view-product/${req.params.productId}?review=success`);
  } catch (err) {
    console.error("Add Review Error:", err);
    res.redirect(`/view-product/${req.params.productId}?error=${encodeURIComponent(err.message)}`);
  }
});

// Delete Review Route
router.post("/product/:productId/review/:reviewId/delete", ensureUser, async (req, res) => {
  try {
    await userHelper.deleteReview(req.session.user._id, req.params.reviewId);
    res.redirect(`/view-product/${req.params.productId}?delete=success`);
  } catch (err) {
    console.error("Delete Review Error:", err);
    res.redirect(`/view-product/${req.params.productId}?error=${encodeURIComponent(err.message)}`);
  }
});

/* Add to cart */
router.post("/add-to-cart/:id", ensureUser, async (req, res) => {
  try {
    await userHelper.addToCart(req.session.user._id, req.params.id);
    res.redirect("/cart");
  } catch (err) {
    console.error("Add to cart error:", err);
    res.redirect("/shop");
  }
});

/* Cart Page */
router.get("/cart", ensureUser, async (req, res) => {
  try {
    const cart = await userHelper.getCart(req.session.user._id);
    let cartTotal = 0;
    if (cart && cart.products && cart.products.length) {
      cart.products.forEach(item => {
        cartTotal += item.productId.price * item.quantity;
      });
    }
    res.render("user/cart", {
      title: "My Cart",
      cart,
      cartTotal,
      grandTotal: cartTotal + 50 // delivery
    });
  } catch (err) {
    console.error("Cart page error:", err);
    res.redirect("/home");
  }
});

/* Update cart qty (inc/dec) */
router.post("/cart/update/:id/:action", ensureUser, async (req, res) => {
  try {
    await userHelper.updateQuantity(req.session.user._id, req.params.id, req.params.action);
    res.redirect("/cart");
  } catch (err) {
    console.error("Update cart qty error:", err);
    res.redirect("/cart");
  }
});

/* Remove from cart */
router.post("/cart/remove/:id", ensureUser, async (req, res) => {
  try {
    await userHelper.removeFromCart(req.session.user._id, req.params.id);
    res.redirect("/cart");
  } catch (err) {
    console.error("Remove from cart error:", err);
    res.redirect("/cart");
  }
});

/* Signup / Login routes */
router.get("/signup", (req, res) => res.render("user/signup", { title: "Sign Up", layout: "main" }));
router.post("/signup", async (req, res) => {
  try {
    const result = await userHelper.doSignup(req.body);
    if (result.status) {
      req.session.user = result.user;
      req.session.isLoggedIn = true;
      return res.redirect("/home");
    }
    res.render("user/signup", { title: "Sign Up", layout: "main", error: result.message });
  } catch (err) {
    console.error("Signup error:", err);
    res.render("user/signup", { title: "Sign Up", layout: "main", error: "Something went wrong" });
  }
});

router.get("/login", (req, res) => res.render("user/login", { title: "Login", layout: "main" }));
router.post("/login", async (req, res) => {
  try {
    const result = await userHelper.doLogin(req.body);
    if (result.status) {
      req.session.user = result.user;
      req.session.isLoggedIn = true;
      return res.redirect("/home");
    }
    res.render("user/login", { title: "Login", layout: "main", error: result.message });
  } catch (err) {
    console.error("Login error:", err);
    res.render("user/login", { title: "Login", layout: "main", error: "Something went wrong" });
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

/* Checkout (shows form and razorpay key) */
router.get("/checkout", ensureUser, async (req, res) => {
  try {
    const cart = await userHelper.getCart(req.session.user._id);
    let subtotal = 0;
    if (cart && cart.products && cart.products.length) {
      subtotal = cart.products.reduce((sum, item) => sum + item.productId.price * item.quantity, 0);
    }
    res.render("user/checkout", {
      title: "Checkout",
      layout: "main",
      user: req.session.user,
      cartTotal: subtotal,
      grandTotal: subtotal + 50,
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error("Checkout page error:", err);
    res.redirect("/cart");
  }
});

/* Checkout (COD) */
router.post("/checkout", ensureUser, async (req, res) => {
  try {
    await userHelper.placeOrder(req.session.user._id, req.body, "COD");
    await userHelper.clearCart(req.session.user._id);
    res.render("user/order-success", { title: "Order Success", layout: "main" });
  } catch (err) {
    console.error("Place order (COD) error:", err);
    res.redirect("/checkout");
  }
});

/* Create Razorpay Order (Server) */
/* Create Razorpay Order (Server) */
router.post("/create-razorpay-order", ensureUser, async (req, res) => {
  try {
    const { mobile, address, locationLink, pincode } = req.body;
    const orderData = await userHelper.createRazorpayOrder(
      req.session.user._id,
      mobile,
      address,
      locationLink,
      pincode
    );
    res.json(orderData);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/* Verify Razorpay Payment */
router.post("/verify-payment", ensureUser, async (req, res) => {
  try {
    const result = await userHelper.verifyRazorpayPayment({
      razorpay_order_id: req.body.razorpay_order_id,
      razorpay_payment_id: req.body.razorpay_payment_id,
      razorpay_signature: req.body.razorpay_signature,
      userId: req.session.user._id // ✅ Pass userId from session
    });

    if (result.success) {
      return res.json({ 
        success: true, 
        redirectUrl: "/order-success?paymentMethod=ONLINE" 
      });
    }
    res.json({ success: false, message: result.message });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.json({ success: false, message: "Server error during verification" });
  }
});

/* Order success page (after payment or COD) */
router.get("/order-success", ensureUser, (req, res) => {
  const { orderId, paymentMethod } = req.query;
  res.render("user/order-success", {
    title: "Order Success",
    layout: "main",
    orderId,
    paymentMethod
  });
});

// ✅ My Orders Route
router.get("/orders", ensureUser, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.session.user._id })
      .populate({
        path: "products.productId",
        model: "Product",          // ✅ Explicitly tell Mongoose which model to use
        strictPopulate: false      // ✅ Fixes StrictPopulateError
      })
      .sort({ createdAt: -1 })
      .lean();
const cartCount = await userHelper.getCartCount(req.session.user._id);
    res.render("user/orders", {
      layout: "main",
      title: "📦 My Orders",
      cartCount,
      orders,
      session: req.session
    });

  } catch (error) {
    console.error("❌ Error loading orders:", error.message);
    res.redirect("/home");
  }
});


/* Update order address */
router.post("/orders/update-address/:id", ensureUser, async (req, res) => {
  try {
    await userHelper.updateOrderAddress(req.params.id, req.session.user._id, req.body);
    res.redirect("/orders");
  } catch (err) {
    console.error("Update address error:", err);
    res.redirect("/orders");
  }
});

/* Cancel order */
router.post("/orders/cancel/:id", ensureUser, async (req, res) => {
  try {
    await userHelper.cancelOrder(req.params.id, req.session.user._id);
    res.redirect("/orders");
  } catch (err) {
    console.error("Cancel order error:", err);
    res.redirect("/orders");
  }
});

router.get("/about", (req, res) => {
  res.render("user/about", { title: "About Us", layout: "main" });
});
// Add this to user.js (after the contact route)
router.get("/contact", ensureUser, async (req, res) => {
  try {
    const adminHelper = require("../helpers/adminHelper");
    const admins = await adminHelper.getUpdateData(); // This gets all admin entries
    
    res.render("user/contact", { 
      title: "Contact Us", 
      layout: "main",
      admins: admins.length > 0 ? [admins[0]] : [] // Send only the latest one
    });
  } catch (err) {
    console.error("Contact page error:", err);
    res.render("user/contact", { 
      title: "Contact Us", 
      layout: "main",
      admins: [] 
    });
  }
});



module.exports = router;
