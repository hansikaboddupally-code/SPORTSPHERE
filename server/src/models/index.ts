import mongoose, { Schema, model } from "mongoose";
import bcrypt from "bcryptjs";

const { models } = mongoose;

const addressSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    postalCode: { type: String, required: true, trim: true, maxlength: 16 },
    country: { type: String, required: true, default: "India", trim: true },
  },
);

export interface IUser extends mongoose.Document {
  name: string;
  email: string;
  password: string;
  role: "customer" | "admin";
  phone?: string;
  addresses: Array<{ _id?: mongoose.Types.ObjectId; fullName: string; phone: string; line1: string; line2?: string; city: string; state: string; postalCode: string; country: string }>;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  emailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ["customer", "admin"], default: "customer", immutable: true },
    phone: { type: String, trim: true, maxlength: 20 },
    addresses: { type: [addressSchema], default: [] },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    emailVerified: { type: Boolean, default: true },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 12);
});
userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

const categorySchema = new Schema(
  { name: { type: String, required: true, unique: true, trim: true }, slug: { type: String, required: true, unique: true }, image: String },
  { timestamps: true },
);
const brandSchema = new Schema(
  { name: { type: String, required: true, unique: true, trim: true }, slug: { type: String, required: true, unique: true }, logo: String },
  { timestamps: true },
);

export interface IProduct extends mongoose.Document {
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
  specifications: Record<string, string>;
  featured: boolean;
}

interface ICartItem {
  _id?: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  quantity: number;
  size: string;
  color: string;
  kitId?: string;
}

interface ICart extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  items: ICartItem[];
  couponCode: string;
}

interface IWishlist extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  products: mongoose.Types.ObjectId[];
}

interface ICatalogEntity extends mongoose.Document {
  name: string;
  slug: string;
  image?: string;
  logo?: string;
}

interface IOrder extends mongoose.Document {
  createdAt: Date;
  user: mongoose.Types.ObjectId;
  orderNumber: string;
  items: Array<{ product: mongoose.Types.ObjectId; name: string; image: string; quantity: number; unitPrice: number; size?: string; color?: string; inventoryMode?: "product" | "variant" }>;
  shippingAddress: Record<string, string>;
  subtotal: number;
  savings: number;
  couponCode?: string;
  couponSavings: number;
  shipping: number;
  total: number;
  paymentMethod: "razorpay" | "cod";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
}

interface IPayment extends mongoose.Document {
  order: mongoose.Types.ObjectId;
  provider: "razorpay";
  providerOrderId: string;
  providerPaymentId?: string;
  status: "created" | "paid" | "failed";
  amount: number;
  signature?: string;
}

interface IReview extends mongoose.Document {
  product: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  rating: number;
  title?: string;
  body: string;
  approved: boolean;
}

interface ICoupon extends mongoose.Document {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minimumSpend: number;
  active: boolean;
  expiresAt?: Date;
}

interface IProductVariant extends mongoose.Document {
  product: mongoose.Types.ObjectId;
  sku: string;
  size: string;
  color: string;
  stock: number;
  priceAdjustment: number;
}

interface IKitBundle extends mongoose.Document {
  name: string;
  sport: string;
  products: mongoose.Types.ObjectId[];
  discountPercent: number;
}

interface INewsletter extends mongoose.Document {
  email: string;
  subscribedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, index: true },
    brand: { type: String, required: true, trim: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    sport: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, maxlength: 2000 },
    images: { type: [String], required: true, validate: [(items: string[]) => items.length > 0, "At least one image is required"] },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, required: true, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    sizes: { type: [String], default: [] },
    colors: { type: [String], default: [] },
    specifications: { type: Map, of: String, default: {} },
    featured: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);
productSchema.index({ name: "text", brand: "text", description: "text" });

const cartItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, max: 20 },
    size: { type: String, default: "" },
    color: { type: String, default: "" },
    kitId: { type: String, default: "" },
  },
  { _id: true },
);
const cartSchema = new Schema({ user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true }, items: { type: [cartItemSchema], default: [] }, couponCode: { type: String, uppercase: true, trim: true, default: "" } }, { timestamps: true });
const wishlistSchema = new Schema({ user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true }, products: [{ type: Schema.Types.ObjectId, ref: "Product" }] }, { timestamps: true });

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    size: String,
    color: String,
    kitId: String,
    inventoryMode: { type: String, enum: ["product", "variant"], default: "product" },
  },
  { _id: false },
);
const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderNumber: { type: String, required: true, unique: true, index: true },
    items: { type: [orderItemSchema], required: true, validate: [(items: unknown[]) => items.length > 0, "An order must contain items"] },
    shippingAddress: { type: addressSchema, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    savings: { type: Number, required: true, min: 0, default: 0 },
    couponCode: { type: String, uppercase: true, trim: true, default: "" },
    couponSavings: { type: Number, required: true, min: 0, default: 0 },
    shipping: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["razorpay", "cod"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    status: { type: String, enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"], default: "pending" },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    carrier: { type: String, trim: true, maxlength: 80 },
    trackingNumber: { type: String, trim: true, maxlength: 120 },
    trackingUrl: { type: String, trim: true, maxlength: 500 },
    shippedAt: Date,
    deliveredAt: Date,
  },
  { timestamps: true },
);
const paymentSchema = new Schema(
  { order: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true }, provider: { type: String, enum: ["razorpay"], required: true }, providerOrderId: { type: String, required: true }, providerPaymentId: String, status: { type: String, enum: ["created", "paid", "failed"], default: "created" }, amount: { type: Number, required: true, min: 0 }, signature: String },
  { timestamps: true },
);

const reviewSchema = new Schema(
  { product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true }, user: { type: Schema.Types.ObjectId, ref: "User", required: true }, rating: { type: Number, required: true, min: 1, max: 5 }, title: { type: String, trim: true, maxlength: 100 }, body: { type: String, required: true, trim: true, maxlength: 1500 }, approved: { type: Boolean, default: false } },
  { timestamps: true },
);
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
const couponSchema = new Schema(
  { code: { type: String, required: true, unique: true, uppercase: true, trim: true }, type: { type: String, enum: ["percent", "fixed"], required: true }, value: { type: Number, required: true, min: 0 }, minimumSpend: { type: Number, default: 0 }, active: { type: Boolean, default: true }, expiresAt: Date },
  { timestamps: true },
);
const productVariantSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    size: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    priceAdjustment: { type: Number, default: 0 },
  },
  { timestamps: true },
);
productVariantSchema.index({ product: 1, size: 1, color: 1 }, { unique: true });
const kitBundleSchema = new Schema(
  { name: { type: String, required: true }, sport: { type: String, required: true, index: true }, products: [{ type: Schema.Types.ObjectId, ref: "Product" }], discountPercent: { type: Number, min: 0, max: 50, default: 0 } },
  { timestamps: true },
);
const newsletterSchema = new Schema({ email: { type: String, required: true, unique: true, lowercase: true, trim: true }, subscribedAt: { type: Date, default: Date.now } }, { timestamps: true });

export const User = (models.User as mongoose.Model<IUser> | undefined) ?? model<IUser>("User", userSchema);
export const Category = (models.Category as mongoose.Model<ICatalogEntity> | undefined) ?? model<ICatalogEntity>("Category", categorySchema);
export const Brand = (models.Brand as mongoose.Model<ICatalogEntity> | undefined) ?? model<ICatalogEntity>("Brand", brandSchema);
export const Product = (models.Product as mongoose.Model<IProduct> | undefined) ?? model<IProduct>("Product", productSchema);
export const Cart = (models.Cart as mongoose.Model<ICart> | undefined) ?? model<ICart>("Cart", cartSchema);
export const Wishlist = (models.Wishlist as mongoose.Model<IWishlist> | undefined) ?? model<IWishlist>("Wishlist", wishlistSchema);
export const Order = (models.Order as mongoose.Model<IOrder> | undefined) ?? model<IOrder>("Order", orderSchema);
export const Payment = (models.Payment as mongoose.Model<IPayment> | undefined) ?? model<IPayment>("Payment", paymentSchema);
export const Review = (models.Review as mongoose.Model<IReview> | undefined) ?? model<IReview>("Review", reviewSchema);
export const Coupon = (models.Coupon as mongoose.Model<ICoupon> | undefined) ?? model<ICoupon>("Coupon", couponSchema);
export const ProductVariant = (models.ProductVariant as mongoose.Model<IProductVariant> | undefined) ?? model<IProductVariant>("ProductVariant", productVariantSchema);
export const KitBundle = (models.KitBundle as mongoose.Model<IKitBundle> | undefined) ?? model<IKitBundle>("KitBundle", kitBundleSchema);
export const Newsletter = (models.Newsletter as mongoose.Model<INewsletter> | undefined) ?? model<INewsletter>("Newsletter", newsletterSchema);
export const AddressSchema = addressSchema;
