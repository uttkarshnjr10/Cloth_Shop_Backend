import mongoose from "mongoose";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ["OWNER", "STAFF"],
        default: "STAFF"
    },
    // Owner Fields
    email: {
        type: String,
        unique: true,
        sparse: true, // Only enforces uniqueness if field exists
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
    // Authentication (Password for Owner, PIN for Staff)
    password: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Pre-save hook to hash password/pin
// userSchema.pre("save", async function (next) {
//     if (!this.isModified("password")) return next();
//     this.password = await argon2.hash(this.password);
//     next();
// });

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await argon2.hash(this.password);
});

// Method to compare password
userSchema.methods.isPasswordCorrect = async function (plainPassword) {
    return await argon2.verify(this.password, plainPassword);
};

// Generate Short-lived Access Token
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