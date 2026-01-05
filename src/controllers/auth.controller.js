import { User } from "../models/user.model.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateRefreshToken } from "../services/auth.service.js";
import argon2 from "argon2";

// Cookie Options (Production Grade)
const cookieOptions = {
    httpOnly: true,
    secure: true, // Always true since we requested "Production Grade"
    sameSite: "None"
};

const login = asyncHandler(async (req, res) => {
    const { email, staffId, password, pin } = req.body;

    let user;

    // 1. Determine Login Type (Owner vs Staff)
    if (email) {
        user = await User.findOne({ email });
    } else if (staffId) {
        user = await User.findOne({ staffId });
    }

    if (!user) {
        throw new ApiError(401, "Invalid credentials");
    }

    // 2. Check Password/PIN
    const secret = password || pin; // Flexible field
    if (!secret) throw new ApiError(400, "Password or PIN required");

    const isValid = await user.isPasswordCorrect(secret);
    if (!isValid) throw new ApiError(401, "Invalid credentials");

    // 3. Generate Tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = await generateRefreshToken(user, req.ip, req.headers["user-agent"]);

    // 4. Send Response
    return res
        .status(200)
        // Use the new options here
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
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

    // 1. Find all active tokens for this user (Optimization: In a real app, you might iterate or store a lookup key. 
    // Since we hash the token, we can't search by hash directly efficiently without a lookup key.
    // TRADEOFF FIX: To search efficiently, we normally store a 'familyId' or we verify strictly.
    // For this strict implementation, we will fetch the user's tokens and compare.
    // NOTE: For performance, usually we store 'token' encrypted or a plain 'familyId'. 
    // Given the strict requirement "Store hashed refresh tokens", we must iterate user's tokens or rely on a "tokenId" in the JWT payload if we used JWT for Refresh. 
    // But we are using Random Strings.
    
    // STRATEGY: We will decode the user from the *expired* access token if passed, OR 
    // simpler: We will allow the frontend to pass userId? No, that's insecure.
    // Correction: Standard practice with Hashed Tokens is to send `tokenId.randomString`. 
    // The `tokenId` looks up the DB record, the `randomString` verifies the hash.
    // Let's assume the incoming token is just the string for now and we accept the scan cost (low for small user counts) 
    // OR we change the design to JWT for Refresh Token but with database backing (Hybrid).
    
    // Let's stick to the prompt: "Refresh tokens must be random... strings".
    // To find it efficiently, we will assume we iterate. (Or better, we check valid tokens for the user context if we had it).
    // Wait, we don't know the user. 
    // FIX: We will Issue Refresh Token as `objectId + "." + randomString`.
    
    // Splitting the token
    const [tokenId, tokenSecret] = incomingRefreshToken.split(".");
    if(!tokenId || !tokenSecret) throw new ApiError(401, "Invalid Token Format");

    const tokenDoc = await RefreshToken.findById(tokenId);
    if (!tokenDoc) throw new ApiError(401, "Invalid Refresh Token");

    // 2. Reuse Detection (The Fortress Logic)
    if (tokenDoc.revoked) {
        // Security Alert: A revoked token was used. Delete ALL tokens for this user.
        await RefreshToken.deleteMany({ user: tokenDoc.user });
        throw new ApiError(401, "Security Alert: Token reuse detected. Re-login required.");
    }

    // 3. Validate Hash
    const isValid = await argon2.verify(tokenDoc.tokenHash, tokenSecret);
    if (!isValid) throw new ApiError(401, "Invalid Refresh Token");

    // 4. Rotate Token
    const user = await User.findById(tokenDoc.user);
    const newAccessToken = user.generateAccessToken();
    
    // Revoke old
    tokenDoc.revoked = true;
    await tokenDoc.save();

    // Issue new
    // Note: We need to modify our generate service slightly to return the ID too.
    const newRefreshTokenFull = await generateRefreshToken(user, req.ip, req.headers["user-agent"]);

    // return res
    //     .status(200)
    //     .cookie("accessToken", newAccessToken, cookieOptions)
    //     .cookie("refreshToken", newRefreshTokenFull, cookieOptions)
    //     .json(new ApiResponse(200, { accessToken: newAccessToken }, "Token refreshed"));
    return res
        .status(200)
        // Use the new options here as well
        .cookie("accessToken", newAccessToken, cookieOptions)
        .cookie("refreshToken", newRefreshTokenFull, cookieOptions)
        .json(new ApiResponse(200, { accessToken: newAccessToken }, "Token refreshed"));
});
const registerStaff = asyncHandler(async (req, res) => {
    const { name, staffId, pin } = req.body;

    if ([name, staffId, pin].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields (name, staffId, pin) are required");
    }

    const existedUser = await User.findOne({ staffId });
    if (existedUser) {
        throw new ApiError(409, "Staff ID already exists");
    }

    // 3. Create User (Password field acts as PIN for staff)
    // Note: The User Model pre-save hook will hash this PIN automatically.
    const user = await User.create({
        name,
        staffId,
        password: pin, // We store the PIN in the password field
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


const logout = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken;
    
    if (incomingRefreshToken) {
        const [tokenId] = incomingRefreshToken.split(".");
        if(tokenId) {
            await RefreshToken.findByIdAndUpdate(tokenId, { revoked: true });
        }
    }

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "Logged out successfully"));
});

export { login, refreshAccessToken, logout, registerStaff };