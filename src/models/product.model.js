import mongoose from "mongoose";
import { productImageSchema } from "./schemas/image.schema.js"; 

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true // Simple index for exact matches
    },
    description: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    // The Showcase Images (Array of Cloudinary Objects)
    images: {
        type: [productImageSchema], 
        validate: [arrayLimit, '{PATH} exceeds the limit of 5 images']
    },
    category: {
        type: String,
        required: true,
        enum: ["Men", "Women", "Kids"],
        index: true
    },
    subCategory: {
        type: String, 
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    stockStatus: {
        type: String,
        enum: ["IN_STOCK", "OUT_OF_STOCK"], // Simplified. Sold items are tracked in Transactions.
        default: "IN_STOCK"
    },
    // Operational Flags
    isOnline: {
        type: Boolean,
        default: true,
        index: true // Critical for customer queries
    },
    isNewArrival: {
        type: Boolean,
        default: true
    },
    isBestSeller: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Text Index for Search functionality
productSchema.index({ name: "text", description: "text", subCategory: "text" });

function arrayLimit(val) {
    return val.length <= 5;
}

export const Product = mongoose.model("Product", productSchema);