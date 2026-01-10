import { Transaction } from "../models/transaction.model.js";
import { PaymentType } from "../models/paymentType.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


// Collect payment for an existing due
const collectDuePayment = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const { amount, paymentMode } = req.body;

  if (!amount || amount <= 0) {
    throw new ApiError(400, "Payment amount must be greater than 0");
  }

  if (!["CASH", "ONLINE"].includes(paymentMode)) {
    throw new ApiError(400, "Invalid payment mode");
  }

  // 1. Find transaction
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    throw new ApiError(404, "Transaction not found");
  }

  if (transaction.paymentStatus !== "DUE") {
    throw new ApiError(400, "This transaction has no pending dues");
  }

  const paymentAmount = Number(amount);

  if (paymentAmount > transaction.dueAmount) {
    throw new ApiError(400, "Payment exceeds due amount");
  }

  // 2. Create payment record (REAL MONEY)
  const payment = await PaymentType.create({
    transaction: transaction._id,
    product: transaction.productId,
    type: paymentMode,
    amount: paymentAmount,
    status: "PAID"
  });

  // 3. Update transaction totals (BACKEND OWNED)
  transaction.amountPaid += paymentAmount;
  transaction.dueAmount -= paymentAmount;

  if (transaction.dueAmount === 0) {
    transaction.paymentStatus = "PAID";
  }

  transaction.paymentTypes.push(payment._id);
  await transaction.save();

  // 4. Return updated transaction
  await transaction.populate([
    { path: "staffId", select: "name staffId email" },
    { path: "paymentTypes" }
  ]);

  return res.status(200).json(
    new ApiResponse(200, transaction, "Due payment collected successfully")
  );
});

// 1. Get all dues (Already correct in your snippet, keeping it consistent)
const getAllDues = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, searchTerm = "" } = req.query;

  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const skip = (pageNumber - 1) * limitNumber;

  // Base filter: transactions that still owe money
  const filter = {
    paymentStatus: "DUE",
    dueAmount: { $gt: 0 }
  };

  // Search by customer name or phone
  if (searchTerm) {
    filter.$or = [
      { "customer.name": { $regex: searchTerm, $options: "i" } },
      { "customer.phoneNumber": { $regex: searchTerm, $options: "i" } }
    ];
  }

  const dues = await Transaction.find(filter)
    .populate("staffId", "name staffId email")
    .sort({ createdAt: -1 }) // Newest dues first
    .skip(skip)
    .limit(limitNumber);

  const totalDocs = await Transaction.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        dues,
        pagination: {
          total: totalDocs,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalDocs / limitNumber)
        }
      },
      "Dues fetched successfully"
    )
  );
});

// 2. Get dues by Transaction ID (Already correct)
const getDuesById = asyncHandler(async (req, res) => {
  const { transactionId } = req.params; 

  const transaction = await Transaction.findById(transactionId)
    .populate("staffId", "name staffId email")
    .populate("paymentTypes");

  if (!transaction || transaction.paymentStatus !== "DUE") {
    throw new ApiError(404, "Dues record not found or already paid");
  }

  return res.status(200).json(
    new ApiResponse(200, transaction, "Dues fetched successfully")
  );
});

// 3. Get dues statistics
const getDuesStatistics = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // We look for ANY transaction created in this range that IS or WAS a sale
    // But typically for "Dues Stats" we care about what is CURRENTLY owed.
    // Let's filter for transactions that have paymentStatus="DUE"
    const duesTransactions = await Transaction.find({
        paymentStatus: "DUE",
        ...dateFilter
    });

    // Calculate statistics
    const stats = {
        totalDuesRecords: duesTransactions.length,
        totalOutstandingAmount: 0, // Total money yet to be received (dueAmount)
        totalCollectedOnDues: 0,   // Money collected so far on these specific incomplete sales
        statusBreakdown: {
            PENDING: { count: 0, amount: 0 }, // 0 paid so far
            PARTIAL: { count: 0, amount: 0 }  // Some amount paid, but not full
        }
    };

    duesTransactions.forEach(txn => {
        stats.totalOutstandingAmount += txn.dueAmount;
        stats.totalCollectedOnDues += txn.amountPaid;

        if (txn.amountPaid === 0) {
            // PENDING (No payment made yet)
            stats.statusBreakdown.PENDING.count += 1;
            stats.statusBreakdown.PENDING.amount += txn.dueAmount;
        } else {
            // PARTIAL (Some payment made)
            stats.statusBreakdown.PARTIAL.count += 1;
            stats.statusBreakdown.PARTIAL.amount += txn.dueAmount;
        }
    });

    return res.status(200).json(
        new ApiResponse(200, stats, "Dues statistics fetched successfully")
    );
});

// 4. Get overdue dues 
const getOverdueDues = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find Transactions where status is DUE AND dueDate is in the past
    const filter = {
        paymentStatus: "DUE",
        dueDate: { $lt: today, $exists: true, $ne: null } // Ensure dueDate exists and is past
    };

    const overdueDues = await Transaction.find(filter)
        .populate("staffId", "name staffId email")
        // We don't need to populate 'transaction' or 'product' heavily because Transaction IS the main doc now
        // But if you want product info, use productSnapshot or populate productId
        .sort({ dueDate: 1 }) // Show oldest due dates first (most urgent)
        .skip(skip)
        .limit(limitNumber);

    const totalDocs = await Transaction.countDocuments(filter);

    return res.status(200).json(
        new ApiResponse(200, {
            overdueDues,
            pagination: {
                total: totalDocs,
                page: pageNumber,
                limit: limitNumber,
                totalPages: Math.ceil(totalDocs / limitNumber)
            }
        }, "Overdue dues fetched successfully")
    );
});

// 5. Update customer details for a due
const updateDuesCustomerDetails = asyncHandler(async (req, res) => {
    const { transactionId } = req.params; // Matching the route param usually
    const { name, phoneNumber, dueDate } = req.body;

    // Validate phone number if provided
    if (phoneNumber && !/^\d{10}$/.test(phoneNumber)) {
        throw new ApiError(400, "Phone number must be 10 digits");
    }

    // Determine update object based on what is provided
    const updateFields = {};
    if (name) updateFields["customer.name"] = name;
    if (phoneNumber) updateFields["customer.phoneNumber"] = phoneNumber;
    if (dueDate) updateFields["dueDate"] = dueDate;

    const transaction = await Transaction.findOneAndUpdate(
        { _id: transactionId, paymentStatus: "DUE" }, // Only update if it's still a DUE
        { $set: updateFields },
        { new: true, runValidators: true }
    ).populate("staffId", "name staffId");

    if (!transaction) {
        throw new ApiError(404, "Dues record not found or already paid");
    }

    return res.status(200).json(
        new ApiResponse(200, transaction, "Customer details updated successfully")
    );
});

export { 
    getAllDues, 
    getDuesById, 
    collectDuePayment, 
    getDuesStatistics, 
    getOverdueDues,
    updateDuesCustomerDetails
};
