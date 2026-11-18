const router = require("express").Router();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");

// หน้าร้านค้า: รองรับค้นหา (q), กรองหมวดหมู่ (category), และเรียงลำดับ (sort)
router.get("/", async (req, res) => {
  const q = String(req.query.q || "")
    .trim()
    .slice(0, 80);
  const category = String(req.query.category || "").trim();
  const sort = String(req.query.sort || "default");

  const filter = {};

  // หน้าดูรายละเอียดสินค้าทีละชิ้น
  router.get("/products/:id", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).send("ไม่พบสินค้าที่ต้องการ");
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).send("ไม่พบสินค้าที่ต้องการ");
    }

    // ดึงสินค้าแนะนำในหมวดเดียวกันมาแสดงด้านล่าง (ไม่รวมชิ้นปัจจุบัน)
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
    }).limit(3);

    res.render("shop/detail", { product, relatedProducts });
  });

  // ค้นหาจากชื่อสินค้า หรือ รหัส SKU
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { sku: { $regex: escaped, $options: "i" } },
    ];
  }

  // กรองตามหมวดหมู่จากแถบ BROWSE ด้านซ้าย
  if (category) {
    filter.category = category;
  }

  // ตัวเลือกการเรียงลำดับ (Default sorting ด้านขวาบน)
  let sortOption = { createdAt: -1 };
  if (sort === "price_asc") sortOption = { price: 1 };
  else if (sort === "price_desc") sortOption = { price: -1 };
  else if (sort === "name_asc") sortOption = { name: 1 };

  const products = await Product.find(filter).sort(sortOption);

  res.render("shop/index", {
    products,
    q,
    selectedCategory: category,
    sort,
  });
});

// เพิ่มสินค้าลงตะกร้า (รองรับการส่ง quantity จากหน้าสินค้าได้ด้วย)
router.post("/cart/add/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
  const product = await Product.findById(req.params.id);
  if (!product || product.stock < 1) {
    return res.status(400).send("สินค้าหมดหรือไม่พบสินค้า");
  }

  const addQty = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  const cart = req.session.cart || {};
  cart[product.id] = Math.min((cart[product.id] || 0) + addQty, product.stock);
  req.session.cart = cart;

  res.redirect("/cart");
});

// คำนวณรายละเอียดสินค้าในตะกร้า (รองรับราคา Sale และสินค้าที่ไม่มีราคา)
async function cartDetails(cart) {
  const ids = Object.keys(cart).filter((id) => mongoose.isValidObjectId(id));
  const products = await Product.find({ _id: { $in: ids } });

  let hasUnpricedItems = false;

  const items = products
    .map((p) => {
      const quantity = Math.min(cart[p.id], p.stock);
      // เช็กราคาจริงที่ใช้ขาย (ถ้าลดราคาอยู่ ให้ใช้ salePrice)
      const effectivePrice = p.isOnSale ? p.salePrice : p.price;
      if (effectivePrice === null || effectivePrice === undefined) {
        hasUnpricedItems = true;
      }
      return {
        product: p,
        quantity,
        unitPrice: effectivePrice,
        subtotal: effectivePrice !== null ? quantity * effectivePrice : null,
      };
    })
    .filter((i) => i.quantity > 0);

  const total = items.reduce((sum, i) => sum + (i.subtotal || 0), 0);

  return { items, total, hasUnpricedItems };
}

// หน้าตะกร้าสินค้า / รายการขอใบเสนอราคา
router.get("/cart", async (req, res) => {
  const detail = await cartDetails(req.session.cart || {});
  res.render("shop/cart", { ...detail, error: null });
});

// ลบสินค้าออกจากตะกร้า
router.post("/cart/remove/:id", (req, res) => {
  if (req.session.cart) delete req.session.cart[req.params.id];
  res.redirect("/cart");
});

// ยืนยันคำสั่งซื้อ / ส่งคำขอใบเสนอราคา
router.post("/checkout", async (req, res) => {
  const customerName = String(req.body.customerName || "").trim();
  const organization = String(req.body.organization || "").trim();
  const email = String(req.body.email || "").trim();
  const phone = String(req.body.phone || "").trim();
  const shippingAddress = String(req.body.shippingAddress || "").trim();
  const note = String(req.body.note || "").trim();

  const detail = await cartDetails(req.session.cart || {});
  const { items, total, hasUnpricedItems } = detail;

  if (!customerName || !phone || items.length === 0) {
    return res.status(400).render("shop/cart", {
      ...detail,
      error:
        "กรุณากรอกชื่อผู้ติดต่อ เบอร์โทรศัพท์ และเลือกสินค้าอย่างน้อย 1 รายการ",
    });
  }

  // ตัดสต็อกสินค้า
  for (const item of items) {
    const result = await Product.updateOne(
      { _id: item.product.id, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
    );
    if (!result.modifiedCount) {
      return res
        .status(409)
        .send("สต็อกสินค้ามีการเปลี่ยนแปลง กรุณากลับไปตรวจสอบตะกร้าอีกครั้ง");
    }
  }

  // ถ้าในตะกร้ามีสินค้าที่ไม่มีราคา ให้ตั้งสถานะเป็น "รอใบเสนอราคา (quote_requested)" อัตโนมัติ
  const orderStatus = hasUnpricedItems ? "quote_requested" : "pending";

  const order = await Order.create({
    customerName,
    organization,
    email,
    phone,
    shippingAddress,
    note,
    total,
    status: orderStatus,
    items: items.map((i) => ({
      product: i.product.id,
      name: i.product.name,
      sku: i.product.sku || "",
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  });

  req.session.cart = {};
  res.render("shop/success", { order });
});

module.exports = router;
