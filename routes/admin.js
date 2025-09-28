const express = require('express');
const router = express.Router();
const path = require('path');
const User = require('../models/User');
const { ensureAdmin } = require('../config/auth');
const adminHelper = require('../helpers/adminHelper');
const Admin = require('../models/Admin');



// ✅ Middleware: Set isAdmin flag for all admin pages
router.use((req, res, next) => {
  res.locals.isAdmin = true;
  next();
});

// Admin Dashboard
router.get('/',ensureAdmin, async (req, res) => {
  try {
    const totalUsers = await adminHelper.getTotalUsers();
    const totalProducts = await adminHelper.getTotalProducts();
    const totalOrders = await adminHelper.getTotalOrders();

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      totalUsers,
      totalProducts,
      totalOrders
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      totalUsers: 0,
      totalProducts: 0,
      totalOrders: 0
    });
  }
});

// Add Product - GET
router.get('/add-product', ensureAdmin, (req, res) => {
  res.render('admin/add-product', { title: 'Add Product', layout: 'main' });
});

// Add Product - POST
router.post('/add-product', async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body;
    const imageFile = req.files?.image;

    if (!imageFile) {
      return res.status(400).send('No image uploaded');
    }

    const imageName = Date.now() + '-' + imageFile.name;
    const uploadPath = path.join(__dirname, '../public/images/products/', imageName);

    await imageFile.mv(uploadPath);

    await adminHelper.addProduct({
      name,
      category,
      price,
      stock,
      description,
      image: imageName
    });

    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).send('Internal Server Error');
  }
});

// List Products
router.get('/products',ensureAdmin, async (req, res) => {
  try {
    const products = await adminHelper.getAllProducts();
    res.render('admin/products', { title: 'All Products', layout: 'main', products });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Delete Product
router.get('/delete-product/:id', async (req, res) => {
  try {
    await adminHelper.deleteProduct(req.params.id);
    res.redirect('/admin/products');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Edit Product - GET
router.get('/edit-product/:id', async (req, res) => {
  try {
    const product = await adminHelper.getProductById(req.params.id);
    res.render('admin/edit-product', { title: 'Edit Product', product });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Edit Product - POST
router.post('/edit-product/:id', async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body;
    let updateData = { name, category, price, stock, description };

    if (req.files?.image) {
      const imageFile = req.files.image;
      const imageName = Date.now() + '-' + imageFile.name;
      const uploadPath = path.join(__dirname, '../public/images/products/', imageName);
      await imageFile.mv(uploadPath);
      updateData.image = imageName;
    }

    await adminHelper.updateProduct(req.params.id, updateData);
    res.redirect('/admin/products');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});
router.get('/manage-orders', ensureAdmin, async (req, res) => {
  try {
    const orders = await adminHelper.getAllOrders();
    res.render('admin/manage-orders', {
      layout: 'main',
      orders
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.redirect('/admin');
  }
});

// Update Order Status
router.post('/manage-orders/update-status/:id', ensureAdmin, async (req, res) => {
  try {
    await adminHelper.updateOrderStatus(req.params.id, req.body.status);
    res.redirect('/admin/manage-orders');
  } catch (error) {
    console.error("Error updating order status:", error);
    res.redirect('/admin/manage-orders');
  }
});
// ✅ Manage Users Route (with Reviews)
router.get('/manage-users', ensureAdmin, async (req, res) => { 
  try {
    const users = await adminHelper.getAllUsersWithReviews(); // <-- Use helper

    res.render('admin/manage-users', {
      layout: 'main',
      title: 'Manage Users',
      users
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.redirect('/admin/dashboard');
  }
});
router.post("/review/:reviewId/delete", async (req, res) => {
  try {
    await adminHelper.deleteReview(req.params.reviewId);
    res.redirect("back");
  } catch (err) {
    console.error("Admin Delete Review Error:", err);
    res.redirect("back");
  }
});


// Block / Unblock User
router.post('/manage-users/toggle/:id', ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.isBlocked = !user.isBlocked;
    await user.save();
    res.redirect('/admin/manage-users');
  } catch (error) {
    console.error("Error blocking/unblocking user:", error);
    res.redirect('/admin/manage-users');
  }
});
// Admin login page
router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.render('admin/login', { layout: 'main' });
});

// Admin login POST
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Hardcoded admin credentials
  if (email === "sachu@gmail.com" && password === "1307") {
    req.session.isAdmin = true;
    req.session.admin = { name: "Admin", email }; // store for header display
    return res.redirect('/admin');
  } else {
    return res.render('admin/login', { layout: 'main', error: "Invalid credentials" });
  }
});

// Admin logout
router.get('/logout', (req, res) => {
  req.session.isAdmin = false;
  req.session.admin = null;
  res.redirect('/admin/login');
});

// In admin.js - Fix the about routes

// In admin.js - Use POST for both create and update

// About Page - GET (Show form with existing data)
router.get('/about', ensureAdmin, async (req, res) => {
  try {
    const adminInfo = await adminHelper.getAdminInfo();
    const success = req.query.success;
    const error = req.query.error;
    
    res.render('admin/about', { 
      title: 'Admin Contact Details', 
      layout: 'main', 
      adminInfo,
      success,
      error
    });
  } catch (error) {
    console.error("Error fetching admin info:", error);
    res.render('admin/about', { 
      title: 'Admin Contact Details', 
      layout: 'main', 
      adminInfo: null,
      error: "Failed to load admin information"
    });
  }
});

// In the POST route, add detailed logging
router.post('/about', ensureAdmin, async (req, res) => {
  try {
    console.log("POST /admin/about received");
    console.log("Request body:", req.body);
    
    const { email, mobile, instagramlink, facebooklink, youtubelink, twitterlink, whatsapplink } = req.body;
    
    // Check if admin info already exists
    const existingAdmin = await adminHelper.getAdminInfo();
    console.log("Existing admin:", existingAdmin);
    
    if (existingAdmin) {
      console.log("Updating existing admin with ID:", existingAdmin._id);
      // Update existing
      await adminHelper.updateAdminInfoById(existingAdmin._id, {
        email,
        mobile,
        instagramlink,
        facebooklink,
        youtubelink,
        twitterlink,
        whatsapplink
      });
      console.log("Update successful");
      return res.redirect('/admin/about?success=Contact details updated successfully');
    } else {
      console.log("Creating new admin info");
      // Create new
      await adminHelper.updateAdminInfo({
        email,
        mobile,
        instagramlink,
        facebooklink,
        youtubelink,
        twitterlink,
        whatsapplink
      });
      console.log("Create successful");
      return res.redirect('/admin/about?success=Contact details added successfully');
    }
  } catch (error) {
    console.error('Error in /admin/about POST:', error);
    res.redirect('/admin/about?error=Failed to save contact details: ' + error.message);
  }
});
// PUT route for editing (optional - if you want separate endpoint)
router.put('/about/:id', ensureAdmin, async (req, res) => {
  try {
    const { email, mobile, instagramlink, facebooklink, youtubelink, twitterlink, whatsapplink } = req.body;
    
    await adminHelper.updateAdminInfoById(req.params.id, {
      email,
      mobile,
      instagramlink,
      facebooklink,
      youtubelink,
      twitterlink,
      whatsapplink
    });
    
    res.redirect('/admin/about?success=Contact details updated successfully');
  } catch (error) {
    console.error('Error updating admin info:', error);
    res.redirect('/admin/about?error=Failed to update contact details');
  }
});


module.exports = router;