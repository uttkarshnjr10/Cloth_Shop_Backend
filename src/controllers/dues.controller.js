import { Transaction } from "../models/transaction.model.js";
import { PaymentType } from "../models/paymentType.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get all dues with filtering and pagination
const getAllDues = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status = "all", searchTerm = "" } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Build filter query
    let filter = { type: "DUES" };

    if (status !== "all") {
        filter.status = status.toUpperCase();
    }

    // Search by customer name or phone
    if (searchTerm) {
        filter.$or = [
            { "duesDetails.name": { $regex: searchTerm, $options: "i" } },
            { "duesDetails.phoneNumber": { $regex: searchTerm, $options: "i" } }
        ];
    }

    // Fetch dues with transaction and staff details
    const dues = await PaymentType.find(filter)
        .populate({
            path: "transaction",
            select: "type amount productSnapshot createdAt",
            populate: {
                path: "staffId",
                select: "name staffId email"
            }
        })
        .populate("product", "name category subCategory")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber);

    const totalDocs = await PaymentType.countDocuments(filter);

    return res.status(200).json(
        new ApiResponse(200, {
            dues,
            pagination: {
                total: totalDocs,
                page: pageNumber,
                limit: limitNumber,
                totalPages: Math.ceil(totalDocs / limitNumber)
            }
        }, "Dues fetched successfully")
    );
});

// Get dues by ID
const getDuesById = asyncHandler(async (req, res) => {
    const { duesId } = req.params;

    const dues = await PaymentType.findById(duesId)
        .populate({
            path: "transaction",
            populate: {
                path: "staffId",
                select: "name staffId email"
            }
        })
        .populate("product", "name category subCategory");

    if (!dues || dues.type !== "DUES") {
        throw new ApiError(404, "Dues record not found");
    }

    return res.status(200).json(
        new ApiResponse(200, dues, "Dues fetched successfully")
    );
});

// Update dues status
const updateDuesStatus = asyncHandler(async (req, res) => {
    const { duesId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!["PENDING", "PAID", "PARTIAL"].includes(status)) {
        throw new ApiError(400, "Invalid status. Must be PENDING, PAID, or PARTIAL");
    }

    const dues = await PaymentType.findByIdAndUpdate(
        duesId,
        { status },
        { new: true, runValidators: true }
    )
        .populate({
            path: "transaction",
            populate: {
                path: "staffId",
                select: "name staffId email"
            }
        })
        .populate("product", "name category subCategory");

    if (!dues || dues.type !== "DUES") {
        throw new ApiError(404, "Dues record not found");
    }

    return res.status(200).json(
        new ApiResponse(200, dues, `Dues status updated to ${status}`)
    );
});

// Get dues statistics
const getDuesStatistics = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get all dues with date filter
    const allDues = await PaymentType.find({
        type: "DUES",
        ...dateFilter
    });

    // Calculate statistics
    const stats = {
        totalDuesRecords: allDues.length,
        totalDuesAmount: 0,
        pendingAmount: 0,
        paidAmount: 0,
        partialAmount: 0,
        statusBreakdown: {
            PENDING: { count: 0, amount: 0 },
            PARTIAL: { count: 0, amount: 0 },
            PAID: { count: 0, amount: 0 }
        }
    };

    allDues.forEach(due => {
        stats.totalDuesAmount += due.amount;

        if (due.status === "PENDING") {
            stats.pendingAmount += due.amount;
            stats.statusBreakdown.PENDING.count += 1;
            stats.statusBreakdown.PENDING.amount += due.amount;
        } else if (due.status === "PARTIAL") {
            stats.partialAmount += due.amount;
            stats.statusBreakdown.PARTIAL.count += 1;
            stats.statusBreakdown.PARTIAL.amount += due.amount;
        } else if (due.status === "PAID") {
            stats.paidAmount += due.amount;
            stats.statusBreakdown.PAID.count += 1;
            stats.statusBreakdown.PAID.amount += due.amount;
        }
    });

    return res.status(200).json(
        new ApiResponse(200, stats, "Dues statistics fetched successfully")
    );
});

// Get overdue dues
const getOverdueDues = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueDues = await PaymentType.find({
        type: "DUES",
        status: { $in: ["PENDING", "PARTIAL"] },
        "duesDetails.dueDate": { $lt: today }
    })
        .populate({
            path: "transaction",
            select: "type amount productSnapshot createdAt",
            populate: {
                path: "staffId",
                select: "name staffId email"
            }
        })
        .populate("product", "name category subCategory")
        .sort({ "duesDetails.dueDate": 1 })
        .skip(skip)
        .limit(limitNumber);

    const totalDocs = await PaymentType.countDocuments({
        type: "DUES",
        status: { $in: ["PENDING", "PARTIAL"] },
        "duesDetails.dueDate": { $lt: today }
    });

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

// Update customer details for a due
const updateDuesCustomerDetails = asyncHandler(async (req, res) => {
    const { duesId } = req.params;
    const { name, phoneNumber, dueDate } = req.body;

    // Validate phone number if provided
    if (phoneNumber && !/^\d{10}$/.test(phoneNumber)) {
        throw new ApiError(400, "Phone number must be 10 digits");
    }

    const dues = await PaymentType.findByIdAndUpdate(
        duesId,
        {
            "duesDetails.name": name,
            "duesDetails.phoneNumber": phoneNumber,
            "duesDetails.dueDate": dueDate
        },
        { new: true, runValidators: true }
    )
        .populate({
            path: "transaction",
            populate: {
                path: "staffId",
                select: "name staffId email"
            }
        })
        .populate("product", "name category subCategory");

    if (!dues || dues.type !== "DUES") {
        throw new ApiError(404, "Dues record not found");
    }

    return res.status(200).json(
        new ApiResponse(200, dues, "Customer details updated successfully")
    );
});

export { 
    getAllDues, 
    getDuesById, 
    updateDuesStatus, 
    getDuesStatistics, 
    getOverdueDues,
    updateDuesCustomerDetails
};