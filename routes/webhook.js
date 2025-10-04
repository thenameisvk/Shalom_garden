const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order');

router.post('/', (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  
  let rawBody = '';
  
  req.on('data', chunk => {
    rawBody += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const signature = req.headers["x-razorpay-signature"];

      if (!signature) {
        return res.status(400).send("Missing signature");
      }

      // Verify signature
      const shasum = crypto.createHmac("sha256", webhookSecret);
      shasum.update(rawBody);
      const digest = shasum.digest("hex");

      if (digest === signature) {
        console.log("✅ Razorpay Webhook Verified");
        
        const webhookData = JSON.parse(rawBody);
        
        if (webhookData.event === "payment.captured") {
          const payment = webhookData.payload.payment.entity;
          console.log("💰 Payment Captured:", payment);

          await Order.findOneAndUpdate(
            { razorpay_order_id: payment.order_id },
            { 
              paymentStatus: "Paid",
              status: "Confirmed"
            }
          );
        }

        if (webhookData.event === "payment.failed") {
          const payment = webhookData.payload.payment.entity;
          console.log("❌ Payment Failed:", payment);
          
          await Order.findOneAndUpdate(
            { razorpay_order_id: payment.order_id },
            { 
              paymentStatus: "Failed",
              status: "Failed"
            }
          );
        }

        res.json({ status: "ok" });
      } else {
        console.warn("❌ Webhook Signature Verification Failed");
        res.status(400).send("Invalid signature");
      }
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(400).send("Webhook processing failed");
    }
  });
});

module.exports = router;