import mongoose from "mongoose";

const paymentTypeSchema = new mongoose.Schema({
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },
    type: {
        type: String,
        enum: ["CASH", "ONLINE", "DUES"],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    // For DUES type only
    duesDetails: {
        name: {
            type: String,
            required: function() { return this.type === "DUES"; }
        },
        phoneNumber: {
            type: String,
            required: function() { return this.type === "DUES"; },
            match: [/^\d{10}$/, "Phone number must be 10 digits"]
        },
        dueDate: {
            type: Date
        }
    },
    // Payment status for DUES
    status: {
        type: String,
        enum: ["PENDING", "PAID", "PARTIAL"],
        default: "PENDING"
    }
}, { timestamps: true });

// Index for fast queries
paymentTypeSchema.index({ transaction: 1 });
paymentTypeSchema.index({ type: 1 });
paymentTypeSchema.index({ createdAt: 1 });

export const PaymentType = mongoose.model("PaymentType", paymentTypeSchema);