import axios from "axios";

const defaultApiUrl = import.meta.env.DEV && typeof window !== "undefined"
  ? `http://${window.location.hostname}:5000/api`
  : "http://localhost:5000/api";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? defaultApiUrl,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export interface Product {
  _id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  sport: string;
  description: string;
  images: string[];
  price: number;
  compareAtPrice: number;
  rating: number;
  reviewCount: number;
  stock: number;
  sizes: string[];
  colors: string[];
  specifications?: Record<string, string>;
  featured?: boolean;
}

export interface ProductVariant {
  sku: string;
  size: string;
  color: string;
  stock: number;
}

export interface CartItem {
  _id: string;
  product: Product;
  quantity: number;
  size?: string;
  color?: string;
  kitId?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
  phone?: string;
  emailVerified: boolean;
}

export interface Order {
  _id: string;
  orderNumber: string;
  items: Array<{ product: string; name: string; image: string; quantity: number; unitPrice: number; size?: string; color?: string; inventoryMode?: "product" | "variant" }>;
  total: number;
  subtotal: number;
  savings: number;
  shipping: number;
  status: string;
  paymentStatus: string;
  paymentMethod: "razorpay" | "cod";
  createdAt: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
  shippingAddress?: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message ?? "The server could not be reached. Please try again.";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default api;
