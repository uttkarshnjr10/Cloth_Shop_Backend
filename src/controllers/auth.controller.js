import { User } from "../models/user.model.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateRefreshToken } from "../services/auth.service.js";
import argon2 from "argon2";

// --- DYNAMIC COOKIE OPTIONS  ---
const getCookieOptions = () => {
    // Check if we are in production (e.g. on Vercel/Render)
    const isProduction = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        // On Localhost, 'secure' must be false for Safari/Brave to accept it over HTTP
        secure: isProduction, 
        // On Localhost, 'Lax' is preferred. On Prod, 'None' is needed for Cross-Origin.
        sameSite: isProduction ? "None" : "Lax",
        path: "/", // Ensure cookie is available for all routes
    };
};

const login = asyncHandler(async (req, res) => {
    const { email, staffId, password, pin } = req.body;

    let user;

    // 1. Determine Login Type
    if (email) {
        user = await User.findOne({ email });
    } else if (staffId) {
        user = await User.findOne({ staffId });
    }

    if (!user) {
        throw new ApiError(401, "Invalid credentials");
    }

    // 2. Check Password/PIN
    const secret = password || pin;
    if (!secret) throw new ApiError(400, "Password or PIN required");

    const isValid = await user.isPasswordCorrect(secret);
    if (!isValid) throw new ApiError(401, "Invalid credentials");

    // 3. Generate Tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = await generateRefreshToken(user, req.ip, req.headers["user-agent"]);

    // 4. Send Response with DYNAMIC Options
    const options = getCookieOptions();

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, { 
                user: { _id: user._id, name: user.name, role: user.role, email: user.email },
                accessToken 
            }, "Login successful")
        );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    const [tokenId, tokenSecret] = incomingRefreshToken.split(".");
    if(!tokenId || !tokenSecret) throw new ApiError(401, "Invalid Token Format");

    const tokenDoc = await RefreshToken.findById(tokenId);
    if (!tokenDoc) throw new ApiError(401, "Invalid Refresh Token");

    if (tokenDoc.revoked) {
        await RefreshToken.deleteMany({ user: tokenDoc.user });
        throw new ApiError(401, "Security Alert: Token reuse detected. Re-login required.");
    }

    const isValid = await argon2.verify(tokenDoc.tokenHash, tokenSecret);
    if (!isValid) throw new ApiError(401, "Invalid Refresh Token");

    const user = await User.findById(tokenDoc.user);
    const newAccessToken = user.generateAccessToken();
    
    tokenDoc.revoked = true;
    await tokenDoc.save();

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
        if(tokenId) {
            await RefreshToken.findByIdAndUpdate(tokenId, { revoked: true });
        }
    }

    const options = getCookieOptions();

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "Logged out successfully"));
});

// Register Staff remains the same (no cookies involved)
const registerStaff = asyncHandler(async (req, res) => {
    const { name, staffId, pin } = req.body;

    if ([name, staffId, pin].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields (name, staffId, pin) are required");
    }

    const existedUser = await User.findOne({ staffId });
    if (existedUser) {
        throw new ApiError(409, "Staff ID already exists");
    }

    const user = await User.create({
        name,
        name, // Fix: Ensure name is passed correctly
        staffId,
        password: pin,
        role: "STAFF"
    });

    const createdUser = await User.findById(user._id).select("-password -refresh_token");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the staff");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "Staff registered successfully")
    );
});

export { login, refreshAccessToken, logout, registerStaff };