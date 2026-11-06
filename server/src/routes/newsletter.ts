import { Router } from "express";
import { z } from "zod";
import { Newsletter } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().email().max(254).transform((value) => value.toLowerCase()) }).parse(req.body);
    try {
      await Newsletter.create({ email });
      res.status(201).json({ message: "You’re on the list. Watch your inbox for the good stuff." });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        res.status(409).json({ message: "That email is already signed up." });
        return;
      }
      throw error;
    }
  }),
);

export default router;
