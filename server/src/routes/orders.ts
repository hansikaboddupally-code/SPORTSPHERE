import { randomUUID } from "node:crypto";
import { Router } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { Cart, Coupon, Order, Product } from "../models/index.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { reserveInventory, restockInventory } from "../services/inventory.js";

const router = Router();
const addressInput = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(4).max(16),
  country: z.string().trim().min(2).max(80).default("India"),
});

async function cancelAndRestock(filter: Record<string, unknown>) {
  const order = await Order.findOneAndUpdate(
    { ...filter, status: { $in: ["pending", "confirmed", "processing"] }, paymentStatus: { $ne: "paid" }, razorpayOrderId: { $exists: false } },
    { $set: { status: "cancelled" } },
    { new: true },
  );
  if (!order) return null;
  await Promise.all(order.items.map((item) => restockInventory(item.product.toString(), item.size ?? "", item.color ?? "", item.quantity, item.inventoryMode ?? "product")));
  return order;
}

router.post(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const data = z.object({ shippingAddress: addressInput, paymentMethod: z.enum(["razorpay", "cod"]) }).parse(req.body);
    const cart = await Cart.findOne({ user: req.user?.id });
    if (!cart || !cart.items.length) {
      res.status(400).json({ message: "Your cart is empty." });
      return;
    }

    const items: Array<{ product: string; name: string; image: string; quantity: number; unitPrice: number; size?: string; color?: string; kitId?: string; inventoryMode: "product" | "variant" }> = [];
    let subtotal = 0;
    let savings = 0;
    let createdOrderId: string | null = null;
    const kitQuantities = new Map<string, number>();
    for (const item of cart.items) {
      if (item.kitId) kitQuantities.set(item.kitId, (kitQuantities.get(item.kitId) ?? 0) + item.quantity);
    }
    const reserved: Array<{ id: string; size: string; color: string; quantity: number; inventoryMode: "product" | "variant" }> = [];
    try {
      for (const cartItem of cart.items) {
        const quantity = cartItem.quantity;
        const product = await Product.findById(cartItem.product);
        if (!product) throw new Error("STOCK_UNAVAILABLE");
        const size = cartItem.size ?? "";
        const color = cartItem.color ?? "";
        const inventoryMode = await reserveInventory(product.id, size, color, quantity);
        if (!inventoryMode) throw new Error("STOCK_UNAVAILABLE");
        reserved.push({ id: product.id, size, color, quantity, inventoryMode });
        const lineSubtotal = product.price * quantity;
        const lineSavings = cartItem.kitId && (kitQuantities.get(cartItem.kitId) ?? 0) >= 3 ? lineSubtotal * 0.1 : 0;
        subtotal += lineSubtotal - lineSavings;
        savings += lineSavings;
        items.push({
          product: product.id,
          name: product.name,
          image: product.images[0],
          quantity,
          unitPrice: product.price * (lineSavings ? 0.9 : 1),
          size: cartItem.size,
          color: cartItem.color,
          kitId: cartItem.kitId,
          inventoryMode,
        });
      }

      let couponSavings = 0;
      if (cart.couponCode) {
        const coupon = await Coupon.findOne({
          code: cart.couponCode,
          active: true,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        });
        if (!coupon || subtotal < coupon.minimumSpend) throw new Error("COUPON_INVALID");
        couponSavings = Number(Math.min(subtotal, coupon.type === "percent" ? subtotal * coupon.value / 100 : coupon.value).toFixed(2));
      }
      const shipping = subtotal - couponSavings >= 1500 ? 0 : 99;
      const order = await Order.create({
        user: req.user?.id,
        orderNumber: `SS-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
        items,
        shippingAddress: data.shippingAddress,
        subtotal,
        savings: savings + couponSavings,
        couponCode: cart.couponCode,
        couponSavings,
        shipping,
        total: subtotal - couponSavings + shipping,
        paymentMethod: data.paymentMethod,
        status: data.paymentMethod === "cod" ? "confirmed" : "pending",
        paymentStatus: "pending",
      });
      createdOrderId = order.id;
      cart.items.splice(0, cart.items.length);
      cart.couponCode = "";
      await cart.save();
      res.status(201).json({ order });
    } catch (error) {
      if (createdOrderId) await Order.deleteOne({ _id: createdOrderId });
      await Promise.all(reserved.map(({ id, size, color, quantity, inventoryMode }) => restockInventory(id, size, color, quantity, inventoryMode)));
      if (error instanceof Error && error.message === "STOCK_UNAVAILABLE") {
        res.status(409).json({ message: "One or more items no longer have enough stock. Please review your cart." });
        return;
      }
      if (error instanceof Error && error.message === "COUPON_INVALID") {
        res.status(409).json({ message: "Your coupon is no longer valid for this order. Remove it and try again." });
        return;
      }
      throw error;
    }
  }),
);

router.post(
  "/:id/cancel",
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await cancelAndRestock({ _id: req.params.id, user: req.user?.id });
    if (!order) {
      res.status(409).json({ message: "This order cannot be cancelled. Paid or completed orders need support assistance." });
      return;
    }
    res.json({ message: "Order cancelled and stock released.", order });
  }),
);

router.get(
  "/mine",
  authenticate,
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user?.id }).sort({ createdAt: -1 }).lean();
    res.json({ orders });
  }),
);

router.get(
  "/admin/all",
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const orders = await Order.find().populate("user", "name email").sort({ createdAt: -1 }).limit(200).lean();
    res.json({ orders });
  }),
);

router.get(
  "/:id/invoice",
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = req.user?.role === "admin" ? { _id: req.params.id } : { _id: req.params.id, user: req.user?.id };
    const order = await Order.findOne(filter).lean();
    if (!order) {
      res.status(404).json({ message: "Order not found." });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="SPORTSPHERE-${order.orderNumber}-invoice.pdf"`);
    const document = new PDFDocument({ size: "A4", margin: 48 });
    document.on("error", (error: Error) => {
      if (!res.headersSent) res.status(500).json({ message: "The invoice could not be generated." });
      else res.destroy(error);
    });
    document.pipe(res);
    document.fontSize(22).text("SPORTSPHERE", { continued: true }).fontSize(11).text("  /  ORDER INVOICE", { align: "right" });
    document.moveDown().fontSize(10).text(`Order ${order.orderNumber}`).text(`Date: ${order.createdAt.toLocaleDateString("en-IN")}`);
    document.moveDown().fontSize(12).text("BILL TO", { underline: true }).fontSize(10);
    const address = order.shippingAddress;
    document.text(address.fullName).text(address.phone).text([address.line1, address.line2, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(", "));
    document.moveDown().fontSize(10).text("ITEM", 48, document.y, { continued: true }).text("QTY     UNIT PRICE       TOTAL", { align: "right" });
    document.moveDown(0.5);
    for (const item of order.items) {
      document.text(item.name, { continued: true }).text(`${item.quantity}       ${money(item.unitPrice)}       ${money(item.unitPrice * item.quantity)}`, { align: "right" });
      if (item.size || item.color) document.fontSize(8).fillColor("#666666").text([item.size, item.color].filter(Boolean).join(" / ")).fillColor("#000000").fontSize(10);
      document.moveDown(0.5);
    }
    document.moveDown().text(`Subtotal: ${money(order.subtotal)}`, { align: "right" });
    if (order.couponSavings) document.text(`Coupon discount: -${money(order.couponSavings)}`, { align: "right" });
    document.text(`Shipping: ${money(order.shipping)}`, { align: "right" });
    document.fontSize(13).text(`TOTAL: ${money(order.total)}`, { align: "right" }).fontSize(9).moveDown().text(`Payment: ${order.paymentMethod.toUpperCase()} / ${order.paymentStatus.toUpperCase()}`);
    document.end();
  }),
);

router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = req.user?.role === "admin" ? { _id: req.params.id } : { _id: req.params.id, user: req.user?.id };
    const order = await Order.findOne(filter).lean();
    if (!order) {
      res.status(404).json({ message: "Order not found." });
      return;
    }
    res.json({ order });
  }),
);

router.patch(
  "/admin/:id/status",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(["confirmed", "processing", "shipped", "delivered", "cancelled"]) }).parse(req.body);
    if (status === "cancelled") {
      const order = await cancelAndRestock({ _id: req.params.id });
      if (!order) {
        res.status(409).json({ message: "This order cannot be cancelled." });
        return;
      }
      res.json({ order });
      return;
    }
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: "Order not found." });
      return;
    }
    if (order.status === "cancelled" || order.status === "delivered") {
      res.status(409).json({ message: "This order cannot transition to the requested status." });
      return;
    }
    order.status = status;
    if (status === "shipped" && !order.shippedAt) order.shippedAt = new Date();
    if (status === "delivered") order.deliveredAt = new Date();
    await order.save();
    res.json({ order });
  }),
);

router.patch(
  "/admin/:id/tracking",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = z.object({
      carrier: z.string().trim().max(80).optional(),
      trackingNumber: z.string().trim().max(120).optional(),
      trackingUrl: z.string().trim().max(500).url().refine((value) => new URL(value).protocol === "https:", "Tracking URL must use HTTPS.").optional().or(z.literal("")),
    }).parse(req.body);
    if ((data.carrier && !data.trackingNumber) || (!data.carrier && data.trackingNumber)) {
      res.status(400).json({ message: "Provide both a carrier and tracking number, or leave both blank to clear tracking." });
      return;
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { carrier: data.carrier ?? "", trackingNumber: data.trackingNumber ?? "", trackingUrl: data.trackingUrl ?? "" } },
      { new: true, runValidators: true },
    );
    if (!order) {
      res.status(404).json({ message: "Order not found." });
      return;
    }
    res.json({ order });
  }),
);

function money(amount: number): string {
  return `INR ${amount.toFixed(2)}`;
}

export default router;
