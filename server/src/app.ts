import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import cartRoutes from "./routes/cart.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payments.js";
import productRoutes from "./routes/products.js";
import newsletterRoutes from "./routes/newsletter.js";
import { errorHandler, notFound } from "./middleware/errors.js";

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const allowedClientOrigins = new Set([clientOrigin]);
if (process.env.NODE_ENV !== "production") {
  try {
    const configuredOrigin = new URL(clientOrigin);
    if (configuredOrigin.hostname === "localhost" || configuredOrigin.hostname === "127.0.0.1") {
      const alternateHost = configuredOrigin.hostname === "localhost" ? "127.0.0.1" : "localhost";
      allowedClientOrigins.add(`${configuredOrigin.protocol}//${alternateHost}${configuredOrigin.port ? `:${configuredOrigin.port}` : ""}`);
    }
  } catch {
    throw new Error("CLIENT_ORIGIN must be an absolute URL.");
  }
}

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedClientOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Request origin is not allowed by CORS."));
  },
  credentials: true,
}));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "sportsphere-api" }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
