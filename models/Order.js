const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ✅ List of Products in Order
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],

    // ✅ Razorpay Payment Details
    razorpayOrderId: String,
    paymentId: String,
    razorpaySignature: String,
    paymentStatus: {
      type: String,
      enum: ["Pending", "Success", "Failed"],
      default: "Pending",
    },

    // ✅ Customer Details
    mobile: {
      type: String,
      required: true,
      match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"],
      minlength: 10,
      maxlength: 10,
    },
    address: { type: String, required: true, trim: true },
    locationLink: String,
    pincode: {
      type: String,
      required: true,
      match: [/^\d{6}$/, "Please enter a valid 6-digit pincode"],
    },

    // ✅ Order Details
    total: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE"],
      default: "COD",
    },
    status: {
      type: String,
      enum: ["Placed", "Paid", "Shipped", "Delivered", "Cancelled"],
      default: "Placed",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
