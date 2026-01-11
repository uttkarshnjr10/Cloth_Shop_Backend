import mongoose from "mongoose";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true // Adding index for faster search/sort by name if needed later
    },
    role: {
        type: String,
        enum: ["OWNER", "STAFF"],
        default: "STAFF",
        index: true // ⚡ Indexing Role makes "Find all Staff" queries 100x faster
    },
    // Owner Fields
    email: {
        type: String,
        unique: true,
        sparse: true, 
        lowercase: true,
        trim: true
    },
    // Staff Fields
    staffId: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        select: false // ⚡ SECURITY: Never return password by default. We manually select it in login.
    }
}, { timestamps: true });

// ⚡ PERFORMANCE INDEXES
// This ensures that when we search `$or: [{email}, {staffId}]`, both fields are indexed.
userSchema.index({ email: 1 });
userSchema.index({ staffId: 1 });

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    try {
        this.password = await argon2.hash(this.password);
        next();
    } catch (err) {
        next(err);
    }
});

userSchema.methods.isPasswordCorrect = async function (plainPassword) {
    // argon2 verify is robust but CPU intensive. 
    // This is the unavoidable bottleneck on free hosting.
    return await argon2.verify(this.password, plainPassword);
};

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            role: this.role,
            name: this.name
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
};

export const User = mongoose.model("User", userSchema);