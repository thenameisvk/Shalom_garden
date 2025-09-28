const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    email: { type: String, required: true},
    mobile: { type: String, required: true},
    instagramlink: { type: String },
    facebooklink: { type: String },
    youtubelink: { type: String },
    twitterlink: { type: String },
    whatsapplink: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
