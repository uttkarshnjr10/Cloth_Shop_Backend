import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./models/user.model.js";
import connectDB from "./config/db.js";

dotenv.config({ path: "./.env" });

const seedOwner = async () => {
    await connectDB();

    // Check if owner exists
    const exists = await User.findOne({ role: process.env.OWNER_ROLE });
    if (exists) {
        console.log("Owner already exists.");
        process.exit(0);
    }

    const owner = new User({
        name: process.env.OWNER_NAME,
        email: process.env.OWNER_EMAIL,
        password: process.env.OWNER_PASSWORD, // hashed by pre-save hook
        role: process.env.OWNER_ROLE
    });

    await owner.save();
    console.log("Owner created successfully!");
    process.exit(0);
};

seedOwner();
