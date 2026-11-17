const router = require("express").Router();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.redirect("/admin/login");
  next();
}

// ตรวจสอบและจัดเตรียมข้อมูลสินค้าจากฟอร์ม Admin
function formProduct(body) {
  const name = String(body.name || "").trim();
  const stock = Number(body.stock);

  // ชื่อสินค้าและจำนวนสต็อกบังคับกรอกเสมอ
  if (!name || !Number.isInteger(stock) || stock < 0) return null;

  // ราคาปกติ: อนุญาตให้เว้นว่างได้ (เป็น null สำหรับสินค้าที่ต้องขอใบเสนอราคา)
  const rawPrice = String(body.price || "").trim();
  let price = null;
  if (rawPrice !== "") {
    price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) return null;
  }

  // ราคาลดพิเศษ (Sale Price): อนุญาตให้เว้นว่างได้ แต่ถ้ากรอกต้องเป็นตัวเลข >= 0
  const rawSalePrice = String(body.salePrice || "").trim();
  let salePrice = null;
  if (rawSalePrice !== "") {
    salePrice = Number(rawSalePrice);
    if (!Number.isFinite(salePrice) || salePrice < 0) return null;
  }

  return {
    name,
    sku: String(body.sku || "").trim(),
    description: String(body.description || "").trim(),
    category: String(body.category || "Chemical Reagent").trim(),
    price,
    salePrice,
    // Checkbox จาก HTML form จะส่งค่ามาเมื่อถูกติ๊กเลือก
    isNewProduct: body.isNewProduct === "on" || body.isNewProduct === "true",
    stock,
    imageUrl: String(body.imageUrl || "").trim(),
  };
}

// หน้าเข้าสู่ระบบ Admin
router.get("/login", (req, res) => {
  if (req.session.isAdmin) return res.redirect("/admin");
  res.render("admin/login", { error: null });
});

router.post("/login", async (req, res) => {
  const email = String(req.body.email || "")
    .toLowerCase()
    .trim();
  const password = String(req.body.password || "");

  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res
      .status(401)
      .render("admin/login", { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).send("Session error");
    req.session.isAdmin = user.role === "admin";
    res.redirect("/admin");
  });
});

router.post("/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// หน้าจัดการรายการสินค้าทั้งหมด (รองรับค้นหาชื่อ, SKU และกรองหมวดหมู่)
router.get("/", requireAdmin, async (req, res) => {
  const q = String(req.query.q || "")
    .trim()
    .slice(0, 80);
  const category = String(req.query.category || "").trim();
  const filter = {};

  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { sku: { $regex: escaped, $options: "i" } },
    ];
  }
  if (category) {
    filter.category = category;
  }

  const products = await Product.find(filter).sort({ createdAt: -1 });
  res.render("admin/index", { products, q, selectedCategory: category });
});

// ฟอร์มเพิ่มสินค้าใหม่
router.get("/products/new", requireAdmin, (req, res) => {
  res.render("admin/form", { product: null, error: null });
});

router.post("/products", requireAdmin, async (req, res) => {
  const data = formProduct(req.body);
  if (!data) {
    return res.status(400).render("admin/form", {
      product: req.body,
      error: "กรุณากรอกชื่อสินค้า จำนวนสต็อก และตัวเลขราคาให้ถูกต้อง",
    });
  }
  await Product.create(data);
  res.redirect("/admin");
});

// ฟอร์มแก้ไขสินค้า
router.get("/products/:id/edit", requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
  const product = await Product.findById(req.params.id);
  if (!product) return res.sendStatus(404);
  res.render("admin/form", { product, error: null });
});

router.post("/products/:id/edit", requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
  const data = formProduct(req.body);
  if (!data) {
    return res.status(400).render("admin/form", {
      product: { ...req.body, _id: req.params.id },
      error: "ข้อมูลสินค้าไม่ถูกต้อง กรุณาตรวจสอบตัวเลขราคาและสต็อก",
    });
  }
  await Product.findByIdAndUpdate(req.params.id, data, { runValidators: true });
  res.redirect("/admin");
});

// ลบสินค้า
router.post("/products/:id/delete", requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
  await Product.findByIdAndDelete(req.params.id);
  res.redirect("/admin");
});

// หน้าจัดการรายการคำสั่งซื้อและคำขอใบเสนอราคา
router.get("/orders", requireAdmin, async (req, res) => {
  const status = String(req.query.status || "").trim();
  const filter = status ? { status } : {};
  const orders = await Order.find(filter).sort({ createdAt: -1 });
  res.render("admin/orders", { orders, selectedStatus: status });
});

// อัปเดตสถานะคำสั่งซื้อ / ใบเสนอราคา
router.post("/orders/:id/status", requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
  const validStatuses = [
    "quote_requested",
    "pending",
    "confirmed",
    "shipped",
    "completed",
    "cancelled",
  ];
  const newStatus = String(req.body.status || "");
  if (validStatuses.includes(newStatus)) {
    await Order.findByIdAndUpdate(req.params.id, { status: newStatus });
  }
  res.redirect("/admin/orders");
});

module.exports = router;
