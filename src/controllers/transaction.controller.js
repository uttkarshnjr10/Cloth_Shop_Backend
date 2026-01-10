import { Transaction } from "../models/transaction.model.js";
import { PaymentType } from "../models/paymentType.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// 1. Record a Sale - SIMPLIFIED 
const recordSale = asyncHandler(async (req, res) => {
  const {
    productId,
    salePrice,
    paymentStatus,     // "PAID" | "DUE"
    amountPaid = 0,
    paymentMode,       // "CASH" | "ONLINE" (only if amountPaid > 0)
    customer,
    dueDate
  } = req.body;

  // 1. Validate product
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  if (product.stockStatus === "OUT_OF_STOCK") {
    throw new ApiError(400, "Product is already sold");
  }

  const totalAmount = Number(salePrice);
  const paidAmount = Number(amountPaid);

  if (paidAmount < 0 || paidAmount > totalAmount) {
    throw new ApiError(400, "Invalid paid amount");
  }

  // 2. Calculate dues (BACKEND responsibility)
  const dueAmount = totalAmount - paidAmount;

  // 3. Validate DUE-specific fields
  if (dueAmount > 0) {
    if (!customer?.name || !customer?.phoneNumber) {
      throw new ApiError(400, "Customer name and phone are required for dues");
    }

    if (!/^\d{10}$/.test(customer.phoneNumber)) {
      throw new ApiError(400, "Phone number must be 10 digits");
    }
  }

  // 4. Create Transaction
  const transaction = await Transaction.create({
    type: "SALE",
    amount: totalAmount,
    amountPaid: paidAmount,
    dueAmount,
    paymentStatus: dueAmount === 0 ? "PAID" : "DUE",
    staffId: req.user._id,
    productId: product._id,
    productSnapshot: {
      name: product.name,
      category: product.category,
      subCategory: product.subCategory,
      url: product.images[0]?.url || ""
    },
    customer: dueAmount > 0 ? customer : undefined,
    dueDate: dueAmount > 0 ? dueDate : undefined
  });

  // 5. Create Payment record ONLY if money received
  let paymentTypeRecord = null;

  if (paidAmount > 0) {
    if (!["CASH", "ONLINE"].includes(paymentMode)) {
      throw new ApiError(400, "Invalid payment mode");
    }

    paymentTypeRecord = await PaymentType.create({
      transaction: transaction._id,
      product: product._id,
      type: paymentMode,
      amount: paidAmount,
      status: "PAID"
    });

    transaction.paymentTypes.push(paymentTypeRecord._id);
    await transaction.save();
  }

  // 6. Update product inventory
  product.stockStatus = "OUT_OF_STOCK";
  product.isOnline = false;
  await product.save();

  // 7. Populate response
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


export { recordSale, recordExpense, getTransactionHistory };