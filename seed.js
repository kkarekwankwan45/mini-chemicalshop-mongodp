require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Product = require("./models/Product");

(async () => {
  if (
    !process.env.MONGODB_URI ||
    !process.env.ADMIN_EMAIL ||
    !process.env.ADMIN_PASSWORD
  ) {
    throw new Error(
      "ตั้งค่า MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD ใน .env ก่อน",
    );
  }

  await mongoose.connect(process.env.MONGODB_URI);

  // สร้างหรืออัปเดตบัญชี Admin
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await User.updateOne(
    { email: process.env.ADMIN_EMAIL.toLowerCase().trim() },
    { $set: { passwordHash, role: "admin" } },
    { upsert: true },
  );

  // เพิ่มข้อมูลสินค้าจำลอง 4 รายการตามหน้าเว็บตัวอย่าง (เฉพาะเมื่อยังไม่มีสินค้าใน DB)
  if ((await Product.countDocuments()) === 0) {
    await Product.insertMany([
      {
        name: "ADVANTEC 12130002 Membrane Filter (PTFE Type), Hole Diameter 3µm, 100 Sheets",
        sku: "12130002",
        description:
          "แผ่นกรองเมมเบรน PTFE ขนาดรูพรุน 3 ไมครอน บรรจุ 100 แผ่น/กล่อง สำหรับงานกรองสารละลายเคมี",
        category: "Consumable",
        price: null, // สินค้าแบบไม่แสดงราคา (ลูกค้ากดขอใบเสนอราคา)
        salePrice: null,
        isNewProduct: false,
        stock: 15,
        imageUrl: "/images/advantec-filter.jpg",
      },
      {
        name: "Example Product 3",
        sku: "CHEM-003",
        description:
          "สารเคมีวิเคราะห์ความบริสุทธิ์สูง สำหรับงานทดสอบในห้องปฏิบัติการ",
        category: "Chemical Reagent",
        price: 29.0,
        salePrice: null,
        isNewProduct: false,
        stock: 25,
        imageUrl: "/images/example-product-3.jpg",
      },
      {
        name: "Example Product 4",
        sku: "CHEM-004",
        description: "ชุดสารเคมีทดสอบมาตรฐาน พร้อมขวดบรรจุและอุปกรณ์ตวงวัด",
        category: "Chemical Reagent",
        price: 29.0,
        salePrice: 25.0, // ลดราคาจาก 29.00 เหลือ 25.00 (แสดงป้าย Sale! อัตโนมัติ)
        isNewProduct: true, // แสดงป้าย New สีส้ม
        stock: 10,
        imageUrl: "/images/example-product-4.jpg",
      },
      {
        name: "n-Propyl Alcohol, HPLC (1-Propanol, Propan-1-ol), 2.5 L, Fisher Chemical™ P/7486/17",
        sku: "P/7486/17",
        description:
          "ตัวทำละลายเกรด HPLC ความบริสุทธิ์สูง ขนาดบรรจุ 2.5 ลิตร แบรนด์ Fisher Chemical",
        category: "Chemical Reagent",
        price: null, // สินค้าแบบไม่แสดงราคา
        salePrice: null,
        isNewProduct: false,
        stock: 8,
        imageUrl: "/images/n-propyl-alcohol.jpg",
      },
    ]);
    console.log("Inserted 4 sample chemical products.");
  }

  console.log("Seed complete");
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
