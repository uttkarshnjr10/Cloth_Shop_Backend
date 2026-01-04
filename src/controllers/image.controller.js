// import { asyncHandler } from "../utils/asyncHandler.js";
// import { ApiResponse } from "../utils/ApiResponse.js";
// import { generateUploadSignature } from "../services/image.service.js";

// const getUploadSignature = asyncHandler(async (req, res) => {
//     // Generate the secure signature
//     const signatureData = generateUploadSignature("afh-products");

//     // Return credentials to client
//     return res.status(200).json(
//         new ApiResponse(200, signatureData, "Upload signature generated successfully")
//     );
// });

// export { getUploadSignature };

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { generateUploadSignature } from "../services/image.service.js";

const getUploadSignature = asyncHandler(async (req, res) => {
    // 1. Generate the secure signature (Timestamp + Signature)
    const signatureData = generateUploadSignature("afh-products");

    // 2. Combine it with the public credentials (API Key & Cloud Name)
    // CRITICAL: The frontend needs these to talk to Cloudinary
    const payload = {
        ...signatureData,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        folder: "afh-products"
    };

    return res.status(200).json(
        new ApiResponse(200, payload, "Upload signature generated successfully")
    );
});

export { getUploadSignature };