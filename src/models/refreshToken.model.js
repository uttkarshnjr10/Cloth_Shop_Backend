import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    tokenHash: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    revoked: {
        type: Boolean,
        default: false
    },
    replacedByTokenHash: { // If rotated, point to the new one (audit trail)
        type: String
    },
    ipAddress: String,
    userAgent: String
}, { timestamps: true });

// Auto-delete expired tokens after 30 days (MongoDB TTL)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);