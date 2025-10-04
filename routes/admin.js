const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Product = require("../models/Product");
const { ensureAdmin } = require("../config/auth");
const adminHelper = require("../helpers/adminHelper");
const cloudinary = require("../cloudinary");
const bcrypt = require("bcrypt");

// ✅ Middleware: Set isAdmin flag for all admin pages
router.use((req, res, next) => {
  res.locals.isAdmin = true;
  next();
});

// Dashboard
router.get("/", ensureAdmin, async (req, res) => {
  try {
    const totalUsers = await adminHelper.getTotalUsers();
    const totalProducts = await adminHelper.getTotalProducts();
    const totalOrders = await adminHelper.getTotalOrders();

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      totalUsers,
      totalProducts,
      totalOrders,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      totalUsers: 0,
      totalProducts: 0,
      totalOrders: 0,
    });
  }
});

// GET - add product form
router.get('/add-product', ensureAdmin, (req, res) => {
  res.render('admin/add-product', { title: 'Add Product', layout: 'main' });
});

// POST - add product
router.post('/add-product', ensureAdmin, async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body;

    if (!req.files || !req.files.image) {
      return res.redirect('/admin/add-product?error=Image is required');
    }

    // upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
      folder: "shalom-garden-products"
    });

    const productData = {
      name,
      category,
      price,
      stock,
      description,
      image: result.secure_url,        // ✅ cloudinary URL
      imagePublicId: result.public_id  // ✅ cloudinary public_id
    };

    await adminHelper.addProduct(productData);
    res.redirect('/admin/products?success=Product added successfully');
  } catch (err) {
    console.error("Error adding product:", err);
    res.redirect('/admin/add-product?error=Failed to add product');
  }
});

// =======================
//  LIST PRODUCTS
// =======================
router.get('/products', ensureAdmin, async (req, res) => {
  try {
    const products = await adminHelper.getAllProducts();
    res.render('admin/products', { title: 'All Products', layout: 'main', products });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// =======================
//  EDIT PRODUCT
// =======================

// GET edit product form
router.get('/edit-product/:id', ensureAdmin, async (req, res) => {
  try {
    const product = await adminHelper.getProductById(req.params.id);
    if (!product) return res.redirect('/admin/products');

    res.render('admin/edit-product', { title: 'Edit Product', layout: 'main', product });
  } catch (err) {
    console.error("Edit product error:", err);
    res.redirect('/admin/products?error=Product not found');
  }
});

// POST update product
router.post('/edit-product/:id', ensureAdmin, async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body;
    const product = await adminHelper.getProductById(req.params.id);

    if (!product) return res.redirect('/admin/products?error=Product not found');

    let updateData = { name, category, price, stock, description };

    // If a new image uploaded → replace old one
    if (req.files && req.files.image) {
      // delete old image from Cloudinary
      if (product.imagePublicId) {
        await cloudinary.uploader.destroy(product.imagePublicId);
      }

      // upload new image
      const result = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
        folder: "shalom-garden-products"
      });

      updateData.image = result.secure_url;
      updateData.imagePublicId = result.public_id;
    }

    await adminHelper.updateProduct(req.params.id, updateData);
    res.redirect('/admin/products?success=Product updated');
  } catch (err) {
    console.error("Update product error:", err);
    res.redirect('/admin/products?error=Failed to update');
  }
});

// =======================
//  DELETE PRODUCT
// =======================
router.get('/delete-product/:id', ensureAdmin, async (req, res) => {
  try {
    const product = await adminHelper.getProductById(req.params.id);

    if (product && product.imagePublicId) {
      // delete image from Cloudinary
      await cloudinary.uploader.destroy(product.imagePublicId);
    }

    await adminHelper.deleteProduct(req.params.id);
    res.redirect('/admin/products?success=Deleted successfully');
  } catch (err) {
    console.error("Delete product error:", err);
    res.redirect('/admin/products?error=Failed to delete');
  }
});
// ==========================
// Manage Orders
// ==========================
router.get("/manage-orders", ensureAdmin, async (req, res) => {
  try {
    const orders = await adminHelper.getAllOrders();
    res.render("admin/manage-orders", {
      title: "Manage Orders",
      orders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.redirect("/admin/dashboard");
  }
});
// ✅ Manage Orders
router.post("/manage-orders/update-status/:id", ensureAdmin, async (req, res) => {
  try {
    await adminHelper.updateOrderStatus(req.params.id, req.body.status);
    res.redirect("/admin/manage-orders");
  } catch (error) {
    console.error("Error updating order status:", error);
    res.redirect("/admin/manage-orders");
  }
});

// ✅ Manage Users (with Reviews)
router.get("/manage-users", ensureAdmin, async (req, res) => {
  try {
    const users = await adminHelper.getAllUsersWithReviews();
    res.render("admin/manage-users", {
      title: "Manage Users",
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.redirect("/admin/dashboard");
  }
});

router.post("/review/:reviewId/delete", ensureAdmin, async (req, res) => {
  try {
    await adminHelper.deleteReview(req.params.reviewId);
    res.redirect("back");
  } catch (err) {
    console.error("Admin Delete Review Error:", err);
    res.redirect("back");
  }
});

// ✅ Block / Unblock User
router.post("/manage-users/toggle/:id", ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.isBlocked = !user.isBlocked;
    await user.save();
    res.redirect("/admin/manage-users");
  } catch (error) {
    console.error("Error blocking/unblocking user:", error);
    res.redirect("/admin/manage-users");
  }
});



// ✅ Admin Login
router.get("/login", (req, res) => {
  if (req.session.isAdmin) return res.redirect("/admin");
  res.render("admin/login", { title: "Admin Login" });
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Read from ENV
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPasswordHash = process.env.ADMIN_PASSWORD;

    if (username !== adminUsername) {
      return res.render("admin/login", { error: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, adminPasswordHash);
    if (!isMatch) {
      return res.render("admin/login", { error: "Invalid username or password" });
    }

    // ✅ Set session
    req.session.isAdmin = true;
    req.session.admin = { username: adminUsername };
    res.redirect("/admin");
  } catch (err) {
    console.error("Admin login error:", err);
    res.render("admin/login", { error: "Something went wrong" });
  }
});

// ✅ Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/admin/login");
  });
});


// ✅ Admin About Info
router.get("/about", ensureAdmin, async (req, res) => {
  try {
    const adminInfo = await adminHelper.getAdminInfo();
    res.render("admin/about", {
      title: "Admin Contact Details",
      adminInfo,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (error) {
    console.error("Error fetching admin info:", error);
    res.render("admin/about", {
      title: "Admin Contact Details",
      adminInfo: null,
      error: "Failed to load admin information",
    });
  }
});

router.post("/about", ensureAdmin, async (req, res) => {
  try {
    const { email, mobile, instagramlink, facebooklink, youtubelink, twitterlink, whatsapplink } = req.body;
    const existingAdmin = await adminHelper.getAdminInfo();

    if (existingAdmin) {
      await adminHelper.updateAdminInfoById(existingAdmin._id, {
        email,
        mobile,
        instagramlink,
        facebooklink,
        youtubelink,
        twitterlink,
        whatsapplink,
      });
      return res.redirect("/admin/about?success=Contact details updated successfully");
    } else {
      await adminHelper.updateAdminInfo({
        email,
        mobile,
        instagramlink,
        facebooklink,
        youtubelink,
        twitterlink,
        whatsapplink,
      });
      return res.redirect("/admin/about?success=Contact details added successfully");
    }
  } catch (error) {
    console.error("Error in /admin/about POST:", error);
    res.redirect("/admin/about?error=Failed to save contact details");
  }
});

module.exports = router;
