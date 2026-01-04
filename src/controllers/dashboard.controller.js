import { Transaction } from "../models/transaction.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Utility to get date ranges
const getDateRange = (filter) => {
    const now = new Date();
    const start = new Date();
    
    // Reset time to start of day for accurate filtering
    start.setHours(0, 0, 0, 0); 
    
    if (filter === 'today') {
        // start is already 00:00 today
    } else if (filter === 'week') {
        start.setDate(now.getDate() - 7);
    } else if (filter === 'month') {
        start.setMonth(now.getMonth() - 1);
    } else {
        // Default to all time (or extensive range)
        start.setFullYear(2000); 
    }
    
    return start;
};

// Stats Cards (Revenue, Profit, Items Sold)
const getStats = asyncHandler(async (req, res) => {
    const { filter = 'week' } = req.query; // today, week, month
    const startDate = getDateRange(filter);

    // Aggregation Pipeline
    const stats = await Transaction.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate } // Filter by date
            }
        },
        {
            $group: {
                _id: null,
                totalRevenue: { 
                    $sum: { 
                        $cond: [{ $eq: ["$type", "SALE"] }, "$amount", 0] 
                    } 
                },
                totalExpenses: { 
                    $sum: { 
                        $cond: [{ $eq: ["$type", "EXPENSE"] }, "$amount", 0] 
                    } 
                },
                totalSalesCount: {
                    $sum: {
                        $cond: [{ $eq: ["$type", "SALE"] }, 1, 0]
                    }
                }
            }
        }
    ]);

    const result = stats[0] || { totalRevenue: 0, totalExpenses: 0, totalSalesCount: 0 };
    const netProfit = result.totalRevenue - result.totalExpenses;

    return res.status(200).json(
        new ApiResponse(200, { ...result, netProfit }, "Stats fetched successfully")
    );
});

//  Bar Chart (Weekly Sales)
const getSalesChart = asyncHandler(async (req, res) => {
    // Logic: Get Last 7 Days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const rawData = await Transaction.aggregate([
        {
            $match: {
                type: "SALE",
                createdAt: { $gte: sevenDaysAgo }
            }
        },
        {
            $group: {
                // Group by Day of Week (1=Sun, 2=Mon...)
                _id: { $dayOfWeek: "$createdAt" }, 
                totalSales: { $sum: "$amount" }
            }
        }
    ]);

    // Data Normalization (Zero-Filling)
    // Map MongoDB day numbers (1=Sun) to Names
    const dayMap = { 1: "Sun", 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat" };
    
    // Create the full template for the last 7 days to ensure order
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayNum = d.getDay() + 1; // getDay() is 0-6, Mongo is 1-7
        const dayName = dayMap[dayNum];

        // Find if we have data for this day
        const found = rawData.find(item => item._id === dayNum);
        
        chartData.push({
            name: dayName,
            sales: found ? found.totalSales : 0 // Fill 0 if missing
        });
    }

    return res.status(200).json(
        new ApiResponse(200, chartData, "Sales chart data fetched")
    );
});

// Pie Chart (Sales by Category)
const getCategoryChart = asyncHandler(async (req, res) => {
    const { filter = 'month' } = req.query;
    const startDate = getDateRange(filter);

    const categoryData = await Transaction.aggregate([
        {
            $match: {
                type: "SALE",
                createdAt: { $gte: startDate }
            }
        },
        {
            // Group by the SNAPSHOT category (safe even if product deleted)
            $group: {
                _id: "$productSnapshot.category", 
                value: { $sum: 1 } // Counting items sold. Use $sum: "$amount" for revenue share.
            }
        },
        {
            $project: {
                _id: 0,
                name: "$_id",
                value: 1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, categoryData, "Category distribution fetched")
    );
});

export { getStats, getSalesChart, getCategoryChart };