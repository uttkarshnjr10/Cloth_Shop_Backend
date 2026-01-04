import crypto from "crypto";
import argon2 from "argon2";
import { RefreshToken } from "../models/refreshToken.model.js";

export const generateRefreshToken = async (user, ipAddress, userAgent) => {

    const tokenSecret = crypto.randomBytes(40).toString("hex");
    const tokenHash = await argon2.hash(tokenSecret);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const tokenDoc = await RefreshToken.create({
        user: user._id,
        tokenHash,
        expiresAt,
        ipAddress,
        userAgent
    });

    // Return Format: "DatabaseID.RandomSecret"
    return `${tokenDoc._id}.${tokenSecret}`;
};

export const verifyRefreshTokenRotation = async (rawToken) => {
    // This logic handles the complex rotation check in the Controller
    // We cannot verify hash directly without querying all, so we rely on the Controller to find the candidate.
};