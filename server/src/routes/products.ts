import { Router } from "express";
import { z } from "zod";
import { Product, ProductVariant, Review, Category } from "../models/index.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  sport: z.string().trim().max(40).optional(),
  brand: z.string().trim().max(80).optional(),
  size: z.string().trim().max(40).optional(),
  color: z.string().trim().max(40).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  inStock: z.enum(["true", "false"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "rating", "discount", "popular"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuery.parse(req.query);
    const filter: Record<string, unknown> = {};
    if (query.q) filter.$text = { $search: query.q };
    if (query.category) filter.category = query.category;
    if (query.sport) filter.sport = query.sport;
    if (query.brand) filter.brand = query.brand;
    if (query.size) filter.sizes = query.size;
    if (query.color) filter.colors = query.color;
    if (query.minRating !== undefined) filter.rating = { $gte: query.minRating };
    if (query.inStock === "true") filter.stock = { $gt: 0 };
    if (query.inStock === "false") filter.stock = 0;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }
    const sort: Record<string, 1 | -1> =
      query.sort === "price-asc" ? { price: 1 } :
      query.sort === "price-desc" ? { price: -1 } :
      query.sort === "rating" ? { rating: -1 } :
      query.sort === "discount" ? { compareAtPrice: -1 } :
      query.sort === "popular" ? { reviewCount: -1, rating: -1 } : { createdAt: -1 };
    const [products, total] = await Promise.all([
      query.sort === "discount"
        ? Product.aggregate([
            { $match: filter },
            { $addFields: { discountRatio: { $cond: [{ $gt: ["$compareAtPrice", "$price"] }, { $divide: [{ $subtract: ["$compareAtPrice", "$price"] }, "$compareAtPrice"] }, 0] } } },
            { $sort: { discountRatio: -1, createdAt: -1 } },
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
          ])
        : Product.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      Product.countDocuments(filter),
    ]);
    res.json({ products, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
  }),
);

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await Category.find().sort({ name: 1 }).lean();
    res.json({ categories });
  }),
);

router.get(
  "/recommendations",
  asyncHandler(async (req, res) => {
    const { viewed } = z.object({
      viewed: z.string().max(800).optional(),
    }).parse(req.query);
    const ids = [...new Set((viewed ?? "").split(",").filter(Boolean))].slice(0, 8);
    if (ids.some((id) => !/^[a-f\d]{24}$/i.test(id))) {
      res.status(400).json({ message: "Recent product identifiers are invalid." });
      return;
    }
    const recentProducts = ids.length ? await Product.find({ _id: { $in: ids } }).lean() : [];
    const productsById = new Map(recentProducts.map((product) => [product._id.toString(), product]));
    const recentlyViewed = ids.flatMap((id) => {
      const product = productsById.get(id);
      return product ? [product] : [];
    });
    const sports = [...new Set(recentlyViewed.map((product) => product.sport))];
    const categories = [...new Set(recentlyViewed.map((product) => product.category))];
    const filter: Record<string, unknown> = { _id: { $nin: ids } };
    if (sports.length || categories.length) {
      filter.$or = [
        ...(sports.length ? [{ sport: { $in: sports } }] : []),
        ...(categories.length ? [{ category: { $in: categories } }] : []),
      ];
    }
    const products = await Product.find(filter).sort({ featured: -1, rating: -1, reviewCount: -1 }).limit(8).lean();
    res.json({ products, recentlyViewed });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const identifier = req.params.id;
    if (typeof identifier !== "string") {
      res.status(400).json({ message: "The product identifier is invalid." });
      return;
    }
    const filter = /^[a-f\d]{24}$/i.test(identifier) ? { _id: identifier } : { slug: identifier };
    const product = await Product.findOne(filter).lean();
    if (!product) {
      res.status(404).json({ message: "This product could not be found." });
      return;
    }
    const [related, reviews, variants] = await Promise.all([
      Product.find({ _id: { $ne: product._id }, sport: product.sport }).limit(4).lean(),
      Review.find({ product: product._id, approved: true }).populate("user", "name").sort({ createdAt: -1 }).limit(10).lean(),
      ProductVariant.find({ product: product._id }).select("sku size color stock").sort({ size: 1, color: 1 }).lean(),
    ]);
    res.json({ product, related, reviews, variants });
  }),
);

router.post(
  "/:id/reviews",
  authenticate,
  asyncHandler(async (req, res) => {
    const data = z.object({ rating: z.number().int().min(1).max(5), title: z.string().trim().max(100).optional(), body: z.string().trim().min(10).max(1500) }).parse(req.body);
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: "This product could not be found." });
      return;
    }
    try {
      await Review.create({ ...data, product: product.id, user: req.user?.id });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        res.status(409).json({ message: "You have already reviewed this product." });
        return;
      }
      throw error;
    }
    res.status(201).json({ message: "Thanks! Your review will appear after moderation." });
  }),
);

export default router;
