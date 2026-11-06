import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import type { IUser } from "../models/index.js";

function smtpConfiguration() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }
  return { host, user, password, port };
}

export function emailIsConfigured(): boolean {
  return smtpConfiguration() !== null;
}

async function sendMail(to: string, subject: string, token: string, path: string, description: string): Promise<void> {
  const config = smtpConfiguration();
  if (!config) throw new Error("SMTP email is not configured.");
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
  });
  const url = new URL(path, process.env.CLIENT_ORIGIN ?? "http://localhost:5173");
  url.searchParams.set("token", token);
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? config.user,
    to,
    subject,
    text: `${description}: ${url.toString()}`,
    html: `<p>${description}:</p><p><a href="${url.toString()}">${subject}</a></p>`,
  });
}

export async function sendEmailVerification(user: IUser): Promise<void> {
  const token = randomBytes(32).toString("hex");
  user.emailVerificationTokenHash = createHash("sha256").update(token).digest("hex");
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  try {
    await sendMail(user.email, "Verify your SPORTSPHERE email", token, "/verify-email", "Verify your email within 24 hours");
  } catch (error) {
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    throw error;
  }
}

export async function sendPasswordReset(user: IUser): Promise<void> {
  const token = randomBytes(32).toString("hex");
  user.passwordResetTokenHash = createHash("sha256").update(token).digest("hex");
  user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();
  try {
    await sendMail(user.email, "Reset your SPORTSPHERE password", token, "/reset-password", "Reset your password within 30 minutes");
  } catch (error) {
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    throw error;
  }
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
