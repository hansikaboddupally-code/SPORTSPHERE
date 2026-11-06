import { Router } from "express";
import { createHash } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { Category, Coupon, Order, Product, ProductVariant, Review, User } from "../models/index.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.use(authenticate, requireAdmin);

router.post("/upload-signature", (_req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    res.status(503).json({ message: "Cloudinary image uploads are not configured. Add the Cloudinary credentials to server/.env." });
    return;
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "sportsphere/products";
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret);
  res.json({ cloudName, apiKey, timestamp, folder, signature });
});

const productInput = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  brand: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(80),
  sport: z.string().trim().min(1).max(40),
  description: z.string().trim().min(10).max(2000),
  images: z.array(z.string().url()).min(1).max(8),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0),
  stock: z.number().int().min(0),
  sizes: z.array(z.string().max(40)).max(30).default([]),
  colors: z.array(z.string().max(40)).max(30).default([]),
  specifications: z.record(z.string(), z.string().max(120)).default({}),
  featured: z.boolean().default(false),
});

router.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    const [revenue, orderCount, customerCount, productCount, lowStock, recentOrders] = await Promise.all([
      Order.aggregate([{ $match: { paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
      Order.countDocuments(),
      User.countDocuments({ role: "customer" }),
      Product.countDocuments(),
      Product.countDocuments({ stock: { $lte: 5 } }),
      Order.find().sort({ createdAt: -1 }).limit(8).populate("user", "name email").lean(),
    ]);
    res.json({ revenue: revenue[0]?.total ?? 0, orderCount, customerCount, productCount, lowStock, recentOrders });
  }),
);

router.post(
  "/products",
  asyncHandler(async (req, res) => {
    const product = await Product.create(productInput.parse(req.body));
    res.status(201).json({ product });
  }),
);

router.patch(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const data = productInput.partial().parse(req.body);
    const current = await Product.findById(req.params.id).select("sizes colors");
    if (!current) {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    const variantsConfigured = await ProductVariant.exists({ product: current._id });
    const optionsChanged = (data.sizes && JSON.stringify(data.sizes) !== JSON.stringify(current.sizes))
      || (data.colors && JSON.stringify(data.colors) !== JSON.stringify(current.colors));
    if (variantsConfigured && optionsChanged && await Order.exists({
      _id: { $exists: true },
      status: { $in: ["pending", "confirmed", "processing"] },
      paymentStatus: { $ne: "paid" },
      "items.product": current._id,
    })) {
      res.status(409).json({ message: "Product options cannot change while an unpaid order is still cancellable." });
      return;
    }
    const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    if (variantsConfigured) {
      if (optionsChanged) {
        await ProductVariant.deleteMany({ product: product._id });
      } else {
        const variants = await ProductVariant.find({ product: product._id }).select("stock").lean();
        product.stock = variants.reduce((total, variant) => total + variant.stock, 0);
        await product.save();
      }
    }
    res.json({ product });
  }),
);

const variantInventoryInput = z.object({
  variants: z.array(z.object({
    size: z.string().max(40),
    color: z.string().max(40),
    stock: z.number().int().min(0).max(1_000_000),
  })).max(900),
});

router.get(
  "/products/:id/variants",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id).select("sizes colors");
    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    const variants = await ProductVariant.find({ product: product._id }).select("sku size color stock").sort({ size: 1, color: 1 }).lean();
    res.json({ variants });
  }),
);

router.put(
  "/products/:id/variants",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    const { variants } = variantInventoryInput.parse(req.body);
    if (await Order.exists({
      status: { $in: ["pending", "confirmed", "processing"] },
      paymentStatus: { $ne: "paid" },
      "items.product": product._id,
    })) {
      res.status(409).json({ message: "Inventory cannot be reconfigured while an unpaid order is still cancellable." });
      return;
    }
    const allowedSizes = product.sizes.length ? product.sizes : [""];
    const allowedColors = product.colors.length ? product.colors : [""];
    const expected = new Set(allowedSizes.flatMap((size) => allowedColors.map((color) => `${size}\u0000${color}`)));
    const received = new Set(variants.map((variant) => `${variant.size}\u0000${variant.color}`));
    if (expected.size !== received.size || [...received].some((key) => !expected.has(key))) {
      res.status(400).json({ message: "Provide exactly one inventory entry for every available size and colour combination." });
      return;
    }
    const operations = variants.map((variant) => {
      const skuSuffix = createHash("sha256").update(`${variant.size}\u0000${variant.color}`).digest("hex").slice(0, 12).toUpperCase();
      return {
        updateOne: {
          filter: { product: product._id, size: variant.size, color: variant.color },
          update: {
            $set: { stock: variant.stock },
            $setOnInsert: { product: product._id, size: variant.size, color: variant.color, sku: `SS-${product.id}-${skuSuffix}` },
          },
          upsert: true,
        },
      };
    });
    await ProductVariant.bulkWrite(operations);
    await ProductVariant.deleteMany({ product: product._id, $nor: variants.map(({ size, color }) => ({ size, color })) });
    const stock = variants.reduce((total, variant) => total + variant.stock, 0);
    await Product.updateOne({ _id: product._id }, { $set: { stock } });
    const savedVariants = await ProductVariant.find({ product: product._id }).select("sku size color stock").sort({ size: 1, color: 1 }).lean();
    res.json({ variants: savedVariants, stock });
  }),
);

router.delete(
  "/products/:id/variants",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    if (await ProductVariant.exists({ product: product._id }) && await Order.exists({
      status: { $in: ["pending", "confirmed", "processing"] },
      paymentStatus: { $ne: "paid" },
      "items.product": product._id,
    })) {
      res.status(409).json({ message: "Inventory cannot switch to shared stock while an unpaid order is still cancellable." });
      return;
    }
    await ProductVariant.deleteMany({ product: product._id });
    res.json({ stock: product.stock });
  }),
);

router.delete(
  "/products/:id",
  asyncHandler(async (req, res) => {
    if (await Order.exists({
      status: { $in: ["pending", "confirmed", "processing"] },
      paymentStatus: { $ne: "paid" },
      "items.product": req.params.id,
    })) {
      res.status(409).json({ message: "This product cannot be deleted while an unpaid order is still cancellable." });
      return;
    }
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    await ProductVariant.deleteMany({ product: product._id });
    res.json({ message: "Product removed." });
  }),
);

router.get(
  "/customers",
  asyncHandler(async (_req, res) => {
    const customers = await User.find({ role: "customer" }).select("name email createdAt").sort({ createdAt: -1 }).limit(200).lean();
    res.json({ customers });
  }),
);

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await Category.find().sort({ name: 1 }).lean();
    res.json({ categories });
  }),
);

router.post(
  "/categories",
  asyncHandler(async (req, res) => {
    const data = z.object({ name: z.string().trim().min(2).max(80), slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), image: z.string().url().optional() }).parse(req.body);
    const category = await Category.create(data);
    res.status(201).json({ category });
  }),
);

router.patch(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const data = z.object({ name: z.string().trim().min(2).max(80), slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), image: z.string().url().optional() }).partial().parse(req.body);
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: "Category not found." });
      return;
    }
    const previousName = category.name;
    Object.assign(category, data);
    await category.save();
    if (data.name && data.name !== previousName) {
      await Product.updateMany({ category: previousName }, { $set: { category: data.name } });
    }
    res.json({ category });
  }),
);

router.delete(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: "Category not found." });
      return;
    }
    if (await Product.exists({ category: category.name })) {
      res.status(409).json({ message: "This category still has products. Reassign them before deleting it." });
      return;
    }
    await category.deleteOne();
    res.json({ message: "Category removed." });
  }),
);

router.get(
  "/reviews",
  asyncHandler(async (_req, res) => {
    const reviews = await Review.find().populate("user", "name email").populate("product", "name slug").sort({ createdAt: -1 }).limit(200).lean();
    res.json({ reviews });
  }),
);

router.patch(
  "/reviews/:id",
  asyncHandler(async (req, res) => {
    const { approved } = z.object({ approved: z.boolean() }).parse(req.body);
    const review = await Review.findByIdAndUpdate(req.params.id, { approved }, { new: true });
    if (!review) {
      res.status(404).json({ message: "Review not found." });
      return;
    }
    res.json({ review });
  }),
);

router.get(
  "/coupons",
  asyncHandler(async (_req, res) => {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.json({ coupons });
  }),
);

router.post(
  "/coupons",
  asyncHandler(async (req, res) => {
    const data = z.object({
      code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
      type: z.enum(["percent", "fixed"]),
      value: z.number().positive(),
      minimumSpend: z.number().min(0).default(0),
      expiresAt: z.string().datetime().optional(),
    }).superRefine((value, context) => {
      if (value.type === "percent" && value.value > 100) {
        context.addIssue({ code: "custom", path: ["value"], message: "Percentage discounts cannot exceed 100%." });
      }
    }).parse(req.body);
    const coupon = await Coupon.create({ ...data, expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined });
    res.status(201).json({ coupon });
  }),
);

router.patch(
  "/coupons/:id",
  asyncHandler(async (req, res) => {
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { active }, { new: true });
    if (!coupon) {
      res.status(404).json({ message: "Coupon not found." });
      return;
    }
    res.json({ coupon });
  }),
);

export default router;
