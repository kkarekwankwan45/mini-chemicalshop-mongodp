const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // ขยาย maxlength เป็น 200 เพราะชื่อสารเคมีและรหัสสินค้ามักจะยาว (เช่น n-Propyl Alcohol, HPLC...)
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    // รหัสสินค้าหรือยี่ห้อ (เช่น P/7486/17, ADVANTEC) เผื่อไว้ใช้ค้นหาหรือแสดงผล
    sku: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    // กำหนด enum ตามแถบ BROWSE ด้านซ้ายของหน้าเว็บ เพื่อป้องกันการพิมพ์หมวดหมู่ผิด
    category: {
      type: String,
      required: true,
      enum: [
        "Chemical Reagent",
        "Column & SPE",
        "Consumable",
        "Raw Material",
        "Standard",
        "ทั่วไป",
      ],
      default: "Chemical Reagent",
      trim: true,
    },
    // ราคาขายปกติ (บางสินค้าในภาพไม่มีราคาแสดง จึงตั้ง required: false และ default: null)
    price: {
      type: Number,
      min: 0,
      default: null,
    },
    // ราคาลดพิเศษ (รองรับการแสดงราคาขีดฆ่า เช่น $29.00 เหลือ $25.00 ใน Example Product 4)
    salePrice: {
      type: Number,
      min: 0,
      default: null,
    },
    // สถานะป้ายกำกับ (Badge) มุมซ้ายบนของรูปสินค้า
    isNewProduct: {
      type: Boolean,
      default: false,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    imageUrl: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

// Virtual field: เช็กอัตโนมัติว่าสินค้านี้ลดราคาอยู่หรือไม่ (เอาไว้ขึ้นป้าย "Sale!" ในหน้า EJS)
productSchema.virtual("isOnSale").get(function () {
  return (
    this.salePrice !== null &&
    this.price !== null &&
    this.salePrice < this.price
  );
});

// เปิดให้ใช้งาน virtuals เวลาแปลงเป็น JSON หรือ Object
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);
