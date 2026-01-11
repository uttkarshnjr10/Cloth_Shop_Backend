import { User } from "../models/user.model.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateRefreshToken } from "../services/auth.service.js";
import argon2 from "argon2";

// --- DYNAMIC COOKIE OPTIONS ---
const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };
};

const login = asyncHandler(async (req, res) => {
    const { email, staffId, password, pin } = req.body;

    // FIX: Construct query dynamically
    // Only search for fields that actually exist in the request.
    
    const criteria = [];
    if (email) criteria.push({ email: email.trim().toLowerCase() });
    if (staffId) criteria.push({ staffId: staffId.trim() });

    if (criteria.length === 0) {
        throw new ApiError(400, "Username (Email or Staff ID) is required");
    }

    // strictly search only for the provided value
    const user = await User.findOne({
        $or: criteria
    }).select("+password +role +name +email");

    if (!user) {
        throw new ApiError(401, "Invalid credentials");
    }

    //  Check Password/PIN
    const secret = password || pin;
    if (!secret) throw new ApiError(400, "Password or PIN required");

    const isValid = await user.isPasswordCorrect(secret);
    if (!isValid) throw new ApiError(401, "Invalid credentials");

    // Generate Tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = await generateRefreshToken(user, req.ip, req.headers["user-agent"]);

    // Send Response
    const options = getCookieOptions();

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, { 
                user: { 
                    _id: user._id, 
                    name: user.name, 
                    role: user.role, 
                    email: user.email 
                },
                accessToken,
                refreshToken
            }, "Login successful")
        );
});


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.headers.authorization?.split(" ")[1];

    if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

    const [tokenId, tokenSecret] = incomingRefreshToken.split(".");
    if(!tokenId || !tokenSecret) throw new ApiError(401, "Invalid Token Format");

    const tokenDoc = await RefreshToken.findById(tokenId).lean();

    if (!tokenDoc) throw new ApiError(401, "Invalid Refresh Token");
    if (tokenDoc.revoked) throw new ApiError(401, "Security Alert: Token reuse detected");

    const isValid = await argon2.verify(tokenDoc.tokenHash, tokenSecret);
    if (!isValid) throw new ApiError(401, "Invalid Refresh Token");

    const user = await User.findById(tokenDoc.user).select("name role");
    if (!user) throw new ApiError(401, "User not found");

    const newAccessToken = user.generateAccessToken();

    await RefreshToken.findByIdAndUpdate(tokenId, { revoked: true });

    const newRefreshTokenFull = await generateRefreshToken(user, req.ip, req.headers["user-agent"]);
    const options = getCookieOptions();

    return res
        .status(200)
        .cookie("accessToken", newAccessToken, options)
        .cookie("refreshToken", newRefreshTokenFull, options)
        .json(new ApiResponse(200, { accessToken: newAccessToken }, "Token refreshed"));
});

const logout = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken;
    if (incomingRefreshToken) {
        const [tokenId] = incomingRefreshToken.split(".");
        if(tokenId) await RefreshToken.findByIdAndUpdate(tokenId, { revoked: true });
    }
    const options = getCookieOptions();
    return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(new ApiResponse(200, {}, "Logged out"));
});

const registerStaff = asyncHandler(async (req, res) => {
    const { name, staffId, pin } = req.body;
    if ([name, staffId, pin].some((field) => field?.trim() === "")) throw new ApiError(400, "All fields required");

    const existedUser = await User.findOne({ staffId });
    if (existedUser) throw new ApiError(409, "Staff ID already exists");

    const user = await User.create({ name, staffId, password: pin, role: "STAFF" });
    const createdUser = await User.findById(user._id).select("-password");

    return res.status(201).json(new ApiResponse(200, createdUser, "Staff registered successfully"));
});

export { login, refreshAccessToken, logout, registerStaff };