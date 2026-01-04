import cloudinary from "../config/cloudinary.js";

// Generates a signature for client-side direct uploads
export const generateUploadSignature = (folderName = "afh-products") => {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const params = {
        timestamp: timestamp,
        folder: folderName,
        allowed_formats: "jpg,png,webp", // Restrict file types
        transformation: "w_1200,q_auto,f_auto" // Resize max width, auto quality/format
    };

    // Generate the SHA-1 signature using the API Secret
    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    return {
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        folder: folderName,
        transformation: params.transformation
    };
};

// Removes an image from Cloudinary
export const deleteImageFromCloud = async (publicId) => {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
        return true;
    } catch (error) {
        console.error("Cloudinary Delete Error:", error);
        return false; // to prevent app from crashing 
    }
};