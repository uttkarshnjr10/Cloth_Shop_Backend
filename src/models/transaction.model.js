import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    // SALE or EXPENSE
    type: {
      type: String,
      enum: ["SALE", "EXPENSE"],
      required: true,
    },

    // Total transaction amount (source of truth)
    amount: {
      type: Number,
      required: true,
    },

    // Payment tracking (BACKEND OWNED)
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["PAID", "DUE"],
      default: "PAID",
      index: true,
    },

    // Who performed the transaction
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // SALE-specific fields
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },

    // Immutable snapshot at time of sale
    productSnapshot: {
      name: String,
      category: String,
      subCategory: String,
      url: String,
    },

    // Customer info (ONLY if paymentStatus = DUE)
    customer: {
      name: {
        type: String,
        trim: true,
      },
      phoneNumber: {
        type: String,
        match: [/^\d{10}$/, "Phone number must be 10 digits"],
      },
    },

    dueDate: {
      type: Date,
    },

    // Payment records (ONLY real money received)
    paymentTypes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PaymentType",
      },
    ],

    // Optional notes
    description: String,
  },
  { timestamps: true }
);

//  INDEXES 
// For dues listing
transactionSchema.index({ paymentStatus: 1, dueAmount: 1 });

// For reports & charts
transactionSchema.index({ createdAt: 1 });
transactionSchema.index({ staffId: 1, createdAt: 1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);
