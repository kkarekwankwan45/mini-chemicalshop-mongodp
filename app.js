require("dotenv").config();
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const path = require("path");
const shopRoutes = require("./routes/shop");
const adminRoutes = require("./routes/admin");

const app = express();

// ตั้งค่า View Engine (EJS)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware สำหรับอ่านค่าจากฟอร์ม (Form) และ JSON (เผื่อใช้ Fetch/AJAX)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ตั้งค่า Session (อายุ session 24 ชั่วโมง)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-only-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

// Global Variables: ส่งข้อมูลกลางไปยังไฟล์ EJS ทุกหน้า (รวมถึง partials/header และ sidebar)
app.use((req, res, next) => {
  res.locals.isAdmin = req.session.isAdmin === true;
  res.locals.cartCount = Object.values(req.session.cart || {}).reduce(
    (a, b) => a + b,
    0,
  );
  // รายการหมวดหมู่สำหรับแถบ BROWSE ด้านซ้าย และตัวเลือกในหน้า Admin
  res.locals.categories = [
    "Chemical Reagent",
    "Column & SPE",
    "Consumable",
    "Raw Material",
    "Standard",
  ];
  // เก็บ Path ปัจจุบันไว้ทำแถบเมนู Active (เช่น หน้าแรก / สินค้าของเรา / ติดต่อเรา)
  res.locals.currentPath = req.path;
  next();
});

// Routes
app.use("/", shopRoutes);
app.use("/admin", adminRoutes);

// 404 Not Found
app.use((req, res) => {
  res.status(404).send("404 Not Found - ไม่พบหน้าที่คุณต้องการ");
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("เกิดข้อผิดพลาดภายในระบบ (ตรวจสอบ Terminal)");
});

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error("กรุณาตั้งค่า MONGODB_URI ใน .env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB successfully");

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Open http://localhost:${port}`));
}

start().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
