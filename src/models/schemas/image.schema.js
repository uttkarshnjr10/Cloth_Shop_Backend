import mongoose from "mongoose";

const productImageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true
    },
    public_id: {
        type: String, // Critical for deleting the image from Cloud later
        required: true
    }
}, { _id: false }); // No separate ID for image sub-document needed

export { productImageSchema };