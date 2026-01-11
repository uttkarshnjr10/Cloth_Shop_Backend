import { User } from "../models/user.model.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateRefreshToken } from "../services/auth.service.js";
import argon2 from "argon2";

// --- DYNAMIC COOKIE OPTIONS (Unchanged - This logic is good) ---
const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000 // Explicitly set cookie lifetime (7 days)
    };
};

const login = asyncHandler(async (req, res) => {
    const { email, staffId, password, pin } = req.body;

    // ⚡ OPTIMIZATION 1: Single Database Query
    // Instead of "if email... else if staffId...", check both in one go.
    // We explicitly select the password field because it might be excluded in the model.
    const user = await User.findOne({
        $or: [
            { email: email || null },      // If email is undefined, don't search it
            { staffId: staffId || null }   // If staffId is undefined, don't search it
        ]
    }).select("+password +role +name +email"); // Explicitly fetch fields needed for auth

    if (!user) {
        // Generic error message for security (don't reveal if user exists)
        throw new ApiError(401, "Invalid credentials");
    }

    // 2. Check Password/PIN
    const secret = password || pin;
    if (!secret) throw new ApiError(400, "Password or PIN required");

    // ⚡ OPTIMIZATION 2: Verify Password
    // argon2 is CPU heavy. On Render free tier, this line causes the "pause".
    const isValid = await user.isPasswordCorrect(secret);
    if (!isValid) throw new ApiError(401, "Invalid credentials");

    // 3. Generate Tokens
    // generateAccessToken is sync (fast), generateRefreshToken is async (db write)
    const accessToken = user.generateAccessToken();
    const refreshToken = await generateRefreshToken(user, req.ip, req.headers["user-agent"]);

    // 4. Send Response
    const options = getCookieOptions();

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                // Return ONLY what the frontend needs to redirect properly
                user: {
                    _id: user._id,
                    name: user.name,
                    role: user.role, // Frontend relies on this for redirection!
                    email: user.email 
                },
                accessToken,
                refreshToken
            }, "Login successful")
        );
});

// ... (refreshAccessToken, logout, registerStaff remain mostly the same, just ensure they are clean)

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.headers.authorization?.split(" ")[1];

    if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

    const [tokenId, tokenSecret] = incomingRefreshToken.split(".");
    if(!tokenId || !tokenSecret) throw new ApiError(401, "Invalid Token Format");

    // ⚡ OPTIMIZATION: Use .lean() for faster read
    const tokenDoc = await RefreshToken.findById(tokenId).lean();

    if (!tokenDoc) throw new ApiError(401, "Invalid Refresh Token");
    if (tokenDoc.revoked) throw new ApiError(401, "Security Alert: Token reuse detected");

    // Verify Argon hash
    const isValid = await argon2.verify(tokenDoc.tokenHash, tokenSecret);
    if (!isValid) throw new ApiError(401, "Invalid Refresh Token");

    // ⚡ OPTIMIZATION: Fetch user just for the payload, no need for full document
    const user = await User.findById(tokenDoc.user).select("name role");
    if (!user) throw new ApiError(401, "User not found");

    const newAccessToken = user.generateAccessToken();

    // Rotate Refresh Token
    // We must use the Model to update, not the lean doc
    await RefreshToken.findByIdAndUpdate(tokenId, { revoked: true });

    const newRefreshTokenFull = await generateRefreshToken(user, req.ip, req.headers["user-agent"]);
    const options = getCookieOptions();

    return res
        .status(200)
        .cookie("accessToken", newAccessToken, options)
        .cookie("refreshToken", newRefreshTokenFull, options)
        .json(new ApiResponse(200, { accessToken: newAccessToken }, "Token refreshed"));
});

// ... logout and registerStaff (Keep your existing code, it is fine)
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
    // Don't send password back
    const createdUser = await User.findById(user._id).select("-password");

    return res.status(201).json(new ApiResponse(200, createdUser, "Staff registered successfully"));
});

export { login, refreshAccessToken, logout, registerStaff };