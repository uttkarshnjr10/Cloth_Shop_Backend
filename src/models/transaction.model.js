import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["SALE", "EXPENSE"],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    // Who did this?
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // If it's a SALE, link to the product (optional if product deleted later, so we use snapshot)
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },
    // CRITICAL: The Snapshot. 
    // This data is "frozen" at the moment of sale.
    productSnapshot: {
        name: String,
        category: String,
        subCategory: String,
        url: String
    },
    description: String // For Expenses
}, { timestamps: true });

// Index for fast Date Range Filtering (Weekly/Monthly Charts)
transactionSchema.index({ createdAt: 1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);