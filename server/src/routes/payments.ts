import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import Razorpay from "razorpay";
import { z } from "zod";
import { Order, Payment } from "../models/index.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.use(authenticate);

function razorpayClient(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error("Razorpay is not configured. Add the test keys to server/.env.");
  return new Razorpay({ key_id, key_secret });
}

router.post(
  "/razorpay/order",
  asyncHandler(async (req, res) => {
    const { orderId } = z.object({ orderId: z.string().min(1) }).parse(req.body);
    const order = await Order.findOne({ _id: orderId, user: req.user?.id });
    if (!order) {
      res.status(404).json({ message: "Order not found." });
      return;
    }
    if (order.paymentMethod !== "razorpay" || order.paymentStatus !== "pending" || order.status !== "pending") {
      res.status(409).json({ message: "This order is not awaiting a Razorpay payment." });
      return;
    }
    const existing = await Payment.findOne({ order: order.id, status: "created" });
    if (existing) {
      res.json({ keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: existing.providerOrderId, amount: existing.amount, currency: "INR" });
      return;
    }
    const paymentOrder = await razorpayClient().orders.create({
      amount: Math.round(order.total * 100),
      currency: "INR",
      receipt: order.orderNumber,
      notes: { orderId: order.id, userId: req.user?.id ?? "" },
    });
    await Payment.create({ order: order.id, provider: "razorpay", providerOrderId: paymentOrder.id, amount: paymentOrder.amount });
    const awaitingOrder = await Order.findOneAndUpdate(
      { _id: order.id, user: req.user?.id, status: "pending", paymentStatus: "pending", razorpayOrderId: { $exists: false } },
      { $set: { razorpayOrderId: paymentOrder.id } },
      { new: true },
    );
    if (!awaitingOrder) {
      await Payment.deleteOne({ order: order.id, providerOrderId: paymentOrder.id });
      res.status(409).json({ message: "This order is no longer awaiting payment." });
      return;
    }
    res.status(201).json({ keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: paymentOrder.id, amount: paymentOrder.amount, currency: "INR" });
  }),
);

router.post(
  "/razorpay/verify",
  asyncHandler(async (req, res) => {
    const data = z.object({
      orderId: z.string().min(1),
      razorpay_order_id: z.string().min(1),
      razorpay_payment_id: z.string().min(1),
      razorpay_signature: z.string().regex(/^[a-f\d]{64}$/i),
    }).parse(req.body);
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new Error("Razorpay is not configured. Add the test keys to server/.env.");
    const order = await Order.findOne({ _id: data.orderId, user: req.user?.id });
    if (!order) {
      res.status(404).json({ message: "Order not found." });
      return;
    }
    if (order.paymentStatus === "paid") {
      if (order.razorpayPaymentId === data.razorpay_payment_id) {
        res.json({ message: "Payment was already verified.", order });
        return;
      }
      res.status(409).json({ message: "This order has already been paid." });
      return;
    }
    if (order.paymentMethod !== "razorpay" || order.razorpayOrderId !== data.razorpay_order_id) {
      res.status(400).json({ message: "Payment does not match this order." });
      return;
    }
    const payment = await Payment.findOne({ order: order.id, providerOrderId: data.razorpay_order_id, status: "created" });
    if (!payment || payment.amount !== Math.round(order.total * 100)) {
      res.status(400).json({ message: "Payment amount or order is invalid." });
      return;
    }
    const expected = createHmac("sha256", secret).update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`).digest();
    const received = Buffer.from(data.razorpay_signature, "hex");
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) {
      res.status(400).json({ message: "Payment signature verification failed." });
      return;
    }
    const claimedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: "created" },
      { $set: { status: "paid", providerPaymentId: data.razorpay_payment_id, signature: data.razorpay_signature } },
      { new: true },
    );
    if (!claimedPayment) {
      const currentOrder = await Order.findById(order.id);
      if (currentOrder?.paymentStatus === "paid" && currentOrder.razorpayPaymentId === data.razorpay_payment_id) {
        res.json({ message: "Payment was already verified.", order: currentOrder });
        return;
      }
      res.status(409).json({ message: "This payment has already been processed." });
      return;
    }
    const paidOrder = await Order.findOneAndUpdate(
      { _id: order.id, user: req.user?.id, status: "pending", paymentStatus: "pending", razorpayOrderId: data.razorpay_order_id },
      { $set: { paymentStatus: "paid", status: "confirmed", razorpayPaymentId: data.razorpay_payment_id } },
      { new: true },
    );
    if (!paidOrder) throw new Error(`Verified Razorpay payment ${data.razorpay_payment_id} could not be applied to order ${order.orderNumber}.`);
    res.json({ message: "Payment verified.", order: paidOrder });
  }),
);

export default router;
