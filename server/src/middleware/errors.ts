import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ message: "Please check the submitted information.", errors: error.flatten().fieldErrors });
    return;
  }
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    res.status(400).json({ message: "The submitted data is invalid." });
    return;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    res.status(409).json({ message: "A record with that unique value already exists." });
    return;
  }
  if (error instanceof Error) console.error(error.message);
  res.status(500).json({ message: "Something went wrong. Please try again." });
};
