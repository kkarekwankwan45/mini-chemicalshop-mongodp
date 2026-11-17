const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    // สร้างเลขที่คำสั่งซื้ออัตโนมัติผ่าน default function (รองรับ Mongoose v9+ โดยไม่ติดปัญหา next)
    orderNumber: {
      type: String,
      unique: true,
      trim: true,
      default: function () {
        const datePart = new Date()
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        return `ORD-${datePart}-${randomPart}`;
      },
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    organization: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    shippingAddress: {
      type: String,
      trim: true,
      default: "",
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: { type: String, required: true, trim: true },
        sku: { type: String, trim: true, default: "" },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, min: 0, default: null },
      },
    ],
    total: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        "quote_requested",
        "pending",
        "confirmed",
        "shipped",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
