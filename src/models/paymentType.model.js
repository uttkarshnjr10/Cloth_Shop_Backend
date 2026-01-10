import mongoose from "mongoose";

const paymentTypeSchema = new mongoose.Schema(
  {
    // Parent transaction (source of truth)
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      index: true
    },

    // Optional product reference (useful for reports)
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },

    // HOW the money was received
    type: {
      type: String,
      enum: ["CASH", "ONLINE"],
      required: true,
      index: true
    },

    // HOW MUCH money was received
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

// Useful indexes
paymentTypeSchema.index({ createdAt: 1 });

export const PaymentType = mongoose.model("PaymentType", paymentTypeSchema);
