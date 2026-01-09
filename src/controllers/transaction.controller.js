import { Transaction } from "../models/transaction.model.js";
import { PaymentType } from "../models/paymentType.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// 1. Record a Sale (Staff/Owner) - UPDATED with Multiple Payment Types
const recordSale = asyncHandler(async (req, res) => {
    const { productId, salePrice, paymentMethods } = req.body;

    // Validation
    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }       

    if (product.stockStatus === "OUT_OF_STOCK") {
        throw new ApiError(400, "Product is already sold");
    }

    // Initialize payment breakdown
    let paymentBreakdown = { cash: 0, online: 0, dues: 0 };
    let paymentTypeRecords = [];
    let totalPaymentAmount = 0;

    // A. Handle Payment Methods (NEW FEATURE)
    if (paymentMethods && Array.isArray(paymentMethods) && paymentMethods.length > 0) {
        // Validate payment methods
        for (const payment of paymentMethods) {
            if (!payment.type || !payment.amount) {
                throw new ApiError(400, "Each payment method must have type and amount");
            }

            if (!["CASH", "ONLINE", "DUES"].includes(payment.type)) {
                throw new ApiError(400, "Invalid payment type");
            }

            // Validate DUES specific fields
            if (payment.type === "DUES") {
                if (!payment.duesDetails?.name || !payment.duesDetails?.phoneNumber) {
                    throw new ApiError(400, "DUES type requires name and phoneNumber");
                }

                if (!/^\d{10}$/.test(payment.duesDetails.phoneNumber)) {
                    throw new ApiError(400, "Phone number must be 10 digits");
                }
            }

            totalPaymentAmount += payment.amount;
            paymentBreakdown[payment.type.toLowerCase()] += payment.amount;
        }

        // Verify total payment matches sale price
        if (Math.abs(totalPaymentAmount - Number(salePrice)) > 0.01) {
            throw new ApiError(400, "Sum of payment methods must equal sale price");
        }
    } else {
        // BACKWARD COMPATIBILITY: If no paymentMethods provided, treat entire amount as CASH
        totalPaymentAmount = Number(salePrice);
        paymentBreakdown.cash = Number(salePrice);
        paymentMethods = [{
            type: "CASH",
            amount: Number(salePrice)
        }];
    }

    // B. Create the Transaction Record
    const transaction = await Transaction.create({
        type: "SALE",
        amount: Number(salePrice),
        staffId: req.user._id,
        productId: product._id,
        productSnapshot: {
            name: product.name,
            category: product.category,
            subCategory: product.subCategory,
            url: product.images[0]?.url || ""
        },
        paymentBreakdown
    });

    // C. Create Payment Type Records (NEW)
    paymentTypeRecords = await Promise.all(
        paymentMethods.map(payment =>
            PaymentType.create({
                transaction: transaction._id,
                product: product._id,
                type: payment.type,
                amount: payment.amount,
                duesDetails: payment.type === "DUES" ? payment.duesDetails : null,
                status: payment.type === "DUES" ? "PENDING" : "PAID"
            })
        )
    );

    // D. Update Transaction with Payment Type References
    transaction.paymentTypes = paymentTypeRecords.map(pt => pt._id);
    await transaction.save();

    // E. Update Product Inventory
    product.stockStatus = "OUT_OF_STOCK";
    product.isOnline = false;
    await product.save();

    // F. Populate and Return Response
    await transaction.populate([
        { path: "staffId", select: "name staffId" },
        { path: "paymentTypes" }
    ]);

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

// 3. Get Transaction History
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
        start.setHours(0, 0, 0, 0);

        if (filter === "today") {
            // default start is today 00:00
        } else if (filter === "week") {
            start.setDate(now.getDate() - 7);
        } else if (filter === "month") {
            start.setMonth(now.getMonth() - 1);
        }
        dateQuery = { createdAt: { $gte: start } };
    }

    // Build Type Filter
    let typeQuery = {};
    if (type) {
        typeQuery = { type: type };
    }

    const query = { ...dateQuery, ...typeQuery };

    const transactions = await Transaction.find(query)
        .populate("staffId", "name staffId")
        .populate("paymentTypes")  // NEW: Include payment methods
        .sort({ createdAt: -1 })
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

// 4. NEW: Update Dues Status
const updateDuesStatus = asyncHandler(async (req, res) => {
    const { paymentTypeId } = req.params;
    const { status } = req.body;

    if (!["PENDING", "PAID", "PARTIAL"].includes(status)) {
        throw new ApiError(400, "Invalid status");
    }

    const paymentType = await PaymentType.findByIdAndUpdate(
        paymentTypeId,
        { status },
        { new: true }
    );

    if (!paymentType) {
        throw new ApiError(404, "Payment record not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, paymentType, "Payment status updated successfully"));
});

export { recordSale, recordExpense, getTransactionHistory, updateDuesStatus };