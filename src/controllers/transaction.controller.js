import { Transaction } from "../models/transaction.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// 1. Record a Sale (Staff/Owner)
const recordSale = asyncHandler(async (req, res) => {
    const { productId, salePrice } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    if (product.stockStatus === "OUT_OF_STOCK") {
        throw new ApiError(400, "Product is already sold");
    }

    // A. Create the Transaction Record
    const transaction = await Transaction.create({
        type: "SALE",
        amount: Number(salePrice), // Staff might offer a discount, so we take input price
        staffId: req.user._id,
        productId: product._id,
        productSnapshot: {
            name: product.name,
            category: product.category,
            subCategory: product.subCategory,
            url: product.images[0]?.url || ""
        }
    });

    // B. Update Product Inventory
    product.stockStatus = "OUT_OF_STOCK";
    product.isOnline = false; // Automatically hide from website
    await product.save();

    return res.status(201).json(
        new ApiResponse(201, transaction, "Sale recorded successfully")
    );
});

// 2. Record an Expense (Staff/Owner) - e.g., Tea, Cleaning
const recordExpense = asyncHandler(async (req, res) => {
    const { amount, description } = req.body;

    const transaction = await Transaction.create({
        type: "EXPENSE",
        amount: Number(amount),
        staffId: req.user._id,
        description
    });

    return res.status(201).json(
        new ApiResponse(201, transaction, "Expense recorded successfully")
    );
});

const getTransactionHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, filter = "all", type } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Build Date Filter
    let dateQuery = {};
    if (filter !== "all") {
        const now = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0); // Start of today

        if (filter === "today") {
            // default start is today 00:00
        } else if (filter === "week") {
            start.setDate(now.getDate() - 7);
        } else if (filter === "month") {
            start.setMonth(now.getMonth() - 1);
        }
        dateQuery = { createdAt: { $gte: start } };
    }

    // Build Type Filter (Optional: see only SALES or only EXPENSES)
    let typeQuery = {};
    if (type) {
        typeQuery = { type: type }; // 'SALE' or 'EXPENSE'
    }

    const query = { ...dateQuery, ...typeQuery };

    const transactions = await Transaction.find(query)
        .populate("staffId", "name staffId") // Show who sold it
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(limitNumber);

    const totalDocs = await Transaction.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, {
            transactions,
            pagination: {
                total: totalDocs,
                page: pageNumber,
                limit: limitNumber,
                totalPages: Math.ceil(totalDocs / limitNumber)
            }
        }, "Transaction history fetched")
    );
});

export { recordSale, recordExpense , getTransactionHistory };