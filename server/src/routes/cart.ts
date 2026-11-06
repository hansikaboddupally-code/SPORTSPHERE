import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Cart, Coupon, Product, ProductVariant, Wishlist } from "../models/index.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user?.id }).populate("items.product").lean();
    const coupon = cart?.couponCode ? await Coupon.findOne({ code: cart.couponCode, active: true }).select("code type value minimumSpend").lean() : null;
    res.json({ items: cart?.items ?? [], coupon });
  }),
);

router.post(
  "/coupon",
  asyncHandler(async (req, res) => {
    const { code } = z.object({ code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()) }).parse(req.body);
    const [cart, coupon] = await Promise.all([
      Cart.findOne({ user: req.user?.id }),
      Coupon.findOne({ code, active: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }),
    ]);
    if (!cart || !cart.items.length) {
      res.status(400).json({ message: "Add an item to your bag before applying a coupon." });
      return;
    }
    if (!coupon) {
      res.status(400).json({ message: "That coupon is invalid or has expired." });
      return;
    }
    const products = await Product.find({ _id: { $in: cart.items.map((item) => item.product) } }).select("price");
    const prices = new Map(products.map((product) => [product.id, product.price]));
    const kitQuantities = new Map<string, number>();
    for (const item of cart.items) {
      if (item.kitId) kitQuantities.set(item.kitId, (kitQuantities.get(item.kitId) ?? 0) + item.quantity);
    }
    const subtotal = cart.items.reduce((sum, item) => {
      const lineTotal = (prices.get(item.product.toString()) ?? 0) * item.quantity;
      return sum + (item.kitId && (kitQuantities.get(item.kitId) ?? 0) >= 3 ? lineTotal * 0.9 : lineTotal);
    }, 0);
    if (subtotal < coupon.minimumSpend) {
      res.status(400).json({ message: `This coupon needs a minimum order of ₹${coupon.minimumSpend.toLocaleString("en-IN")}.` });
      return;
    }
    cart.couponCode = coupon.code;
    await cart.save();
    res.json({ message: "Coupon applied.", coupon: { code: coupon.code, type: coupon.type, value: coupon.value, minimumSpend: coupon.minimumSpend } });
  }),
);

router.delete(
  "/coupon",
  asyncHandler(async (req, res) => {
    await Cart.updateOne({ user: req.user?.id }, { $set: { couponCode: "" } });
    res.json({ coupon: null });
  }),
);

router.post(
  "/items",
  asyncHandler(async (req, res) => {
    const data = z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(20), size: z.string().max(40).optional(), color: z.string().max(40).optional() }).parse(req.body);
    const product = await Product.findById(data.productId);
    if (!product) {
      res.status(404).json({ message: "This product could not be found." });
      return;
    }
    if (product.stock < data.quantity) {
      res.status(409).json({ message: "There is not enough stock for that quantity." });
      return;
    }
    if (data.size && product.sizes.length && !product.sizes.includes(data.size)) {
      res.status(400).json({ message: "Choose an available size." });
      return;
    }
    if (data.color && product.colors.length && !product.colors.includes(data.color)) {
      res.status(400).json({ message: "Choose an available colour." });
      return;
    }
    const variantInventoryEnabled = await ProductVariant.exists({ product: product._id });
    if (variantInventoryEnabled && ((product.sizes.length > 0 && !data.size) || (product.colors.length > 0 && !data.color))) {
      res.status(400).json({ message: "Choose both size and colour before adding this item." });
      return;
    }
    const normalizedSize = data.size ?? "";
    const normalizedColor = data.color ?? "";
    if (variantInventoryEnabled) {
      const variant = await ProductVariant.findOne({ product: product._id, size: normalizedSize, color: normalizedColor }).select("stock");
      if (!variant || variant.stock < data.quantity) {
        res.status(409).json({ message: "There is not enough stock for that size and colour." });
        return;
      }
    }
    const cart = await Cart.findOneAndUpdate(
      { user: req.user?.id },
      { $setOnInsert: { user: req.user?.id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const existing = cart.items.find((item) => item.product.toString() === product.id && item.size === normalizedSize && item.color === normalizedColor);
    if (existing) {
      const newQuantity = existing.quantity + data.quantity;
      const availableStock = variantInventoryEnabled
        ? (await ProductVariant.findOne({ product: product._id, size: normalizedSize, color: normalizedColor }).select("stock"))?.stock ?? 0
        : product.stock;
      if (newQuantity > availableStock || newQuantity > 20) {
        res.status(409).json({ message: "The requested quantity exceeds available stock." });
        return;
      }
      existing.quantity = newQuantity;
    } else {
      cart.items.push({ product: product._id, quantity: data.quantity, size: normalizedSize, color: normalizedColor });
    }
    await cart.save();
    const updated = await Cart.findById(cart.id).populate("items.product").lean();
    res.status(201).json({ items: updated?.items ?? [] });
  }),
);

router.post(
  "/kits",
  asyncHandler(async (req, res) => {
    const data = z.object({
      sport: z.string().trim().min(2).max(40),
      items: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(10),
        size: z.string().max(40).optional(),
        color: z.string().max(40).optional(),
      })).min(1).max(10),
    }).parse(req.body);
    const products = await Product.find({ _id: { $in: data.items.map((item) => item.productId) }, sport: data.sport });
    if (products.length !== data.items.length) {
      res.status(400).json({ message: "Every kit item must be a valid product for the selected sport." });
      return;
    }
    const byId = new Map(products.map((product) => [product.id, product]));
    for (const item of data.items) {
      const product = byId.get(item.productId);
      if (!product || product.stock < item.quantity) {
        res.status(409).json({ message: "One or more kit items do not have enough stock." });
        return;
      }
      if (item.size && product.sizes.length && !product.sizes.includes(item.size)) {
        res.status(400).json({ message: `Choose an available size for ${product.name}.` });
        return;
      }
      if (item.color && product.colors.length && !product.colors.includes(item.color)) {
        res.status(400).json({ message: `Choose an available colour for ${product.name}.` });
        return;
      }
      if (await ProductVariant.exists({ product: product._id })) {
        if ((product.sizes.length > 0 && !item.size) || (product.colors.length > 0 && !item.color)) {
          res.status(400).json({ message: `Choose a size and colour for ${product.name}.` });
          return;
        }
        const variant = await ProductVariant.findOne({ product: product._id, size: item.size ?? "", color: item.color ?? "" }).select("stock");
        if (!variant || variant.stock < item.quantity) {
          res.status(409).json({ message: `There is not enough stock for ${product.name} in that size and colour.` });
          return;
        }
      }
    }
    const cart = await Cart.findOneAndUpdate(
      { user: req.user?.id },
      { $setOnInsert: { user: req.user?.id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const kitId = randomUUID();
    for (const item of data.items) {
      const product = byId.get(item.productId);
      if (!product) throw new Error("Validated kit product was not found.");
      cart.items.push({ product: product._id, quantity: item.quantity, size: item.size ?? "", color: item.color ?? "", kitId });
    }
    await cart.save();
    const updated = await Cart.findById(cart.id).populate("items.product").lean();
    res.status(201).json({ items: updated?.items ?? [], kitId });
  }),
);

router.patch(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const { quantity } = z.object({ quantity: z.number().int().min(1).max(20) }).parse(req.body);
    const cart = await Cart.findOne({ user: req.user?.id });
    const item = cart?.items.find((entry) => entry._id?.toString() === req.params.itemId);
    if (!cart || !item) {
      res.status(404).json({ message: "Cart item not found." });
      return;
    }
    const product = await Product.findById(item.product);
    const variantInventoryEnabled = product ? await ProductVariant.exists({ product: product._id }) : false;
    const variant = variantInventoryEnabled && product
      ? await ProductVariant.findOne({ product: product._id, size: item.size, color: item.color }).select("stock")
      : null;
    if (!product || (variantInventoryEnabled ? !variant || variant.stock < quantity : product.stock < quantity)) {
      res.status(409).json({ message: "The requested quantity is not available." });
      return;
    }
    item.quantity = quantity;
    await cart.save();
    const updated = await Cart.findById(cart.id).populate("items.product").lean();
    res.json({ items: updated?.items ?? [] });
  }),
);

router.delete(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user?.id });
    if (!cart) {
      res.status(404).json({ message: "Cart not found." });
      return;
    }
    cart.items = cart.items.filter((item) => item._id?.toString() !== req.params.itemId);
    await cart.save();
    const updated = await Cart.findById(cart.id).populate("items.product").lean();
    res.json({ items: updated?.items ?? [] });
  }),
);

router.get(
  "/wishlist",
  asyncHandler(async (req, res) => {
    const wishlist = await Wishlist.findOne({ user: req.user?.id }).populate("products").lean();
    res.json({ products: wishlist?.products ?? [] });
  }),
);

router.post(
  "/wishlist/:productId",
  asyncHandler(async (req, res) => {
    if (!(await Product.exists({ _id: req.params.productId }))) {
      res.status(404).json({ message: "This product could not be found." });
      return;
    }
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user?.id },
      { $addToSet: { products: req.params.productId }, $setOnInsert: { user: req.user?.id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).populate("products").lean();
    res.json({ products: wishlist.products });
  }),
);

router.delete(
  "/wishlist/:productId",
  asyncHandler(async (req, res) => {
    const wishlist = await Wishlist.findOneAndUpdate({ user: req.user?.id }, { $pull: { products: req.params.productId } }, { new: true }).populate("products").lean();
    res.json({ products: wishlist?.products ?? [] });
  }),
);

export default router;
