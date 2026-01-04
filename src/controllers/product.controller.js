import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteImageFromCloud } from "../services/image.service.js";

// 1. PUBLIC: Advanced Search & Filter
const getProducts = asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        search, 
        category, 
        subCategory, 
        sort = "newest", // newest, price_low, price_high, bestseller
        minPrice,
        maxPrice
    } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // A. Build Query Object
    const query = { isOnline: true }; // Always filter by online status for customers

    // Text Search (Regex is safer for partial matches than Text Index in some simple cases)
    if (search) {
        query.$text = { $search: search }; // Requires the Text Index we defined
    }

    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;
    
    // Price Range
    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // B. Build Sort Object
    let sortOptions = {};
    if (sort === "newest") sortOptions = { createdAt: -1 };
    else if (sort === "price_low") sortOptions = { price: 1 };
    else if (sort === "price_high") sortOptions = { price: -1 };
    else if (sort === "bestseller") sortOptions = { isBestSeller: -1 };

    // C. Execute Query with Pagination
    const products = await Product.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNumber)
        .select("name price images category subCategory isNewArrival isBestSeller"); 
        // Optimized: Only return fields needed for the Card UI

    const totalDocs = await Product.countDocuments(query);
    const hasNextPage = skip + products.length < totalDocs;

    return res.status(200).json(
        new ApiResponse(200, {
            products,
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                total: totalDocs,
                hasNextPage
            }
        }, "Products fetched successfully")
    );
});

// 2. STAFF/OWNER: Add Product
const createProduct = asyncHandler(async (req, res) => {
    const { name, price, category, subCategory, description, images, isNewArrival } = req.body;

    // Note: 'images' comes as an array of objects { url, public_id } from frontend
    if (!images || images.length === 0) {
        throw new ApiError(400, "At least one image is required");
    }

    const product = await Product.create({
        name,
        price,
        category,
        subCategory,
        description,
        images,
        isNewArrival: isNewArrival || true
    });

    return res.status(201).json(
        new ApiResponse(201, product, "Product created successfully")
    );
});

// 3. STAFF/OWNER: Delete Product (Cleanup Logic)
const deleteProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    // CLEANUP: Delete images from Cloudinary
    if (product.images && product.images.length > 0) {
        const deletePromises = product.images.map(img => deleteImageFromCloud(img.public_id));
        await Promise.all(deletePromises);
    }

    await Product.findByIdAndDelete(id);

    return res.status(200).json(
        new ApiResponse(200, {}, "Product and associated images deleted")
    );
});

export { getProducts, createProduct, deleteProduct };