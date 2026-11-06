import { Product, ProductVariant } from "../models/index.js";

export type InventoryMode = "product" | "variant";

export async function reserveInventory(
  productId: string,
  size: string,
  color: string,
  quantity: number,
): Promise<InventoryMode | null> {
  const variantsConfigured = await ProductVariant.exists({ product: productId });
  if (!variantsConfigured) {
    const result = await Product.updateOne({ _id: productId, stock: { $gte: quantity } }, { $inc: { stock: -quantity } });
    return result.modifiedCount === 1 ? "product" : null;
  }

  const variant = await ProductVariant.updateOne(
    { product: productId, size, color, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
  );
  if (variant.modifiedCount !== 1) return null;
  try {
    const product = await Product.updateOne({ _id: productId, stock: { $gte: quantity } }, { $inc: { stock: -quantity } });
    if (product.modifiedCount === 1) return "variant";
  } catch (error) {
    await ProductVariant.updateOne({ product: productId, size, color }, { $inc: { stock: quantity } });
    throw error;
  }
  await ProductVariant.updateOne({ product: productId, size, color }, { $inc: { stock: quantity } });
  return null;
}

export async function restockInventory(
  productId: string,
  size: string,
  color: string,
  quantity: number,
  mode: InventoryMode = "product",
): Promise<void> {
  if (!(await Product.exists({ _id: productId }))) {
    throw new Error("Cannot restock an order item whose product no longer exists.");
  }
  if (mode === "variant") {
    const result = await ProductVariant.updateOne({ product: productId, size, color }, { $inc: { stock: quantity } });
    if (result.matchedCount !== 1) throw new Error("Cannot restock an order item whose inventory variant no longer exists.");
  }
  const product = await Product.updateOne({ _id: productId }, { $inc: { stock: quantity } });
  if (product.matchedCount !== 1) throw new Error("Cannot restock an order item whose product no longer exists.");
}
