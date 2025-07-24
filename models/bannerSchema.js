const mongoose = require("mongoose");
const { Schema } = mongoose;

const bannerSchema = new Schema({
    bannerName: {
        type: String,
        required: true,
    },
    bannerImage: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true,
    },
    link: {
        type: String,
        trim: true,
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const Banner = mongoose.model("Banner", bannerSchema);
module.exports = Banner;

