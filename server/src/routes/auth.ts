import { Router } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { User, type IUser } from "../models/index.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { emailIsConfigured, sendEmailVerification, sendPasswordReset, tokenHash } from "../services/email.js";

const router = Router();
const credentialsSchema = z.object({
  email: z.string().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(72),
});
const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).optional(),
});
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

function issueSession(user: { id: string; role: "customer" | "admin" }, res: Parameters<typeof router.post>[1] extends never ? never : import("express").Response): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"];
  const token = jwt.sign({ role: user.role }, secret, { subject: user.id, expiresIn });
  res.cookie("sportsphere_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

async function normalizeLegacyEmailVerification(user: IUser): Promise<void> {
  if (typeof user.emailVerified !== "boolean") {
    user.emailVerified = true;
    await user.save();
  }
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    if (await User.exists({ email: data.email })) {
      res.status(409).json({ message: "An account with this email already exists." });
      return;
    }
    let user: IUser;
    try {
      user = await User.create({ name: data.name, email: data.email, password: data.password, phone: data.phone, emailVerified: !emailIsConfigured() });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        res.status(409).json({ message: "An account with this email already exists." });
        return;
      }
      throw error;
    }
    if (emailIsConfigured()) await sendEmailVerification(user);
    issueSession({ id: user.id, role: user.role }, res);
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified }, verificationRequired: emailIsConfigured() });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = credentialsSchema.parse(req.body);
    const user = await User.findOne({ email: data.email }).select("+password");
    if (!user || !(await user.comparePassword(data.password))) {
      res.status(401).json({ message: "Email or password is incorrect." });
      return;
    }
    await normalizeLegacyEmailVerification(user);
    issueSession({ id: user.id, role: user.role }, res);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified } });
  }),
);

router.post("/logout", (_req, res) => {
  res.clearCookie("sportsphere_token", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  res.json({ message: "You have been signed out." });
});

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().email().max(254).transform((value) => value.toLowerCase()) }).parse(req.body);
    if (!emailIsConfigured()) {
      res.status(503).json({ message: "Password reset email is not configured on this server yet." });
      return;
    }

    const user = await User.findOne({ email }).select("+passwordResetTokenHash +passwordResetExpires");
    if (user) {
      await sendPasswordReset(user);
    }
    res.json({ message: "If an account exists for that email, a password reset link is on its way." });
  }),
);

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const data = z.object({ token: z.string().regex(/^[a-f\d]{64}$/i), password: z.string().min(8).max(72) }).parse(req.body);
    const hash = tokenHash(data.token);
    const user = await User.findOne({ passwordResetTokenHash: hash, passwordResetExpires: { $gt: new Date() } })
      .select("+password +passwordResetTokenHash +passwordResetExpires");
    if (!user) {
      res.status(400).json({ message: "This password reset link is invalid or has expired." });
      return;
    }
    user.password = data.password;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.json({ message: "Your password has been updated. You can now sign in." });
  }),
);

router.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().regex(/^[a-f\d]{64}$/i) }).parse(req.body);
    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash(token),
      emailVerificationExpires: { $gt: new Date() },
    }).select("+emailVerificationTokenHash +emailVerificationExpires");
    if (!user) {
      res.status(400).json({ message: "This verification link is invalid or has expired. Request a new one and try again." });
      return;
    }
    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    res.json({ message: "Your email is verified." });
  }),
);

router.post(
  "/me/verification-email",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!emailIsConfigured()) {
      res.status(503).json({ message: "Email verification is not configured on this server." });
      return;
    }
    const user = await User.findById(req.user?.id).select("+emailVerificationTokenHash +emailVerificationExpires");
    if (!user) {
      res.status(404).json({ message: "Account not found." });
      return;
    }
    if (user.emailVerified) {
      res.json({ message: "Your email is already verified." });
      return;
    }
    if (user.emailVerificationExpires && user.emailVerificationExpires.getTime() > Date.now() + 23 * 60 * 60 * 1000) {
      res.status(429).json({ message: "A verification email was sent recently. Check your inbox before requesting another." });
      return;
    }
    await sendEmailVerification(user);
    res.json({ message: "A new verification link has been sent to your email." });
  }),
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?.id).select("name email role phone emailVerified");
    if (!user) {
      res.clearCookie("sportsphere_token", { path: "/" });
      res.status(401).json({ message: "Account not found. Please sign in again." });
      return;
    }
    await normalizeLegacyEmailVerification(user);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, emailVerified: user.emailVerified } });
  }),
);

router.patch(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const data = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().max(20).optional() }).parse(req.body);
    const user = await User.findByIdAndUpdate(req.user?.id, data, { new: true, runValidators: true }).select("name email role phone emailVerified");
    if (!user) {
      res.status(404).json({ message: "Account not found." });
      return;
    }
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, emailVerified: user.emailVerified } });
  }),
);

router.get(
  "/me/addresses",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?.id).select("addresses");
    if (!user) {
      res.status(404).json({ message: "Account not found." });
      return;
    }
    res.json({ addresses: user.addresses });
  }),
);

router.post(
  "/me/addresses",
  authenticate,
  asyncHandler(async (req, res) => {
    const address = addressInput.parse(req.body);
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ message: "Account not found." });
      return;
    }
    if (user.addresses.length >= 10) {
      res.status(409).json({ message: "You can save up to 10 delivery addresses." });
      return;
    }
    user.addresses.push(address);
    await user.save();
    res.status(201).json({ addresses: user.addresses });
  }),
);

router.delete(
  "/me/addresses/:addressId",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ message: "Account not found." });
      return;
    }
    const nextAddresses = user.addresses.filter((address) => address._id?.toString() !== req.params.addressId);
    if (nextAddresses.length === user.addresses.length) {
      res.status(404).json({ message: "Address not found." });
      return;
    }
    user.addresses = nextAddresses;
    await user.save();
    res.json({ addresses: user.addresses });
  }),
);

export default router;
