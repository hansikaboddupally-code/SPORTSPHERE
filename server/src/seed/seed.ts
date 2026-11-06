import "dotenv/config";
import mongoose from "mongoose";
import { Brand, Category, Product, User } from "../models/index.js";
import { connectDatabase } from "../config/database.js";

const photoIds = [
  "1461896836934-ffe607ba8211", "1517649763962-0c623066013b", "1579952363873-27f3bade9f55",
  "1531415074968-036ba1b575da", "1540747913346-19e32dc3e97e", "1546519638-68e109498ffc",
  "1574629810360-7efbbe195d2e", "1599058917212-d750089bc07d", "1526506118085-60ce8714f8c5",
  "1552674605-db6ffd4facb5", "1517836357463-d25dfeac3438", "1530549387789-4c1017266635",
  "1571019613454-1cb2f99b2d8b", "1562077772-3fce8e9567a0", "1600185365483-26d7a4cc7519",
  "1560769629-975ec94e6a6f", "1552346154-21d32810aba3", "1596462502278-27bfdc403348",
  "1558618666-fcd25c85cd64", "1605296867424-35fc25c9212a", "1593079831268-3381b0db4a77",
  "1579758629938-03607ccdbaba", "1517838277536-fbc1d1a96b35", "1519861531473-9200262188bf",
  "1594737625785-a6cbdabd333c", "1521412644187-c49fa049e84d", "1526232761682-d26e03ac148e",
  "1517466787929-bc90951d0974", "1483721310020-03333e577078", "1584735935682-2f2c69c90b79",
  "1576678927484-cc907957088c", "1546483875-ad9014c88eba", "1518611012118-696072aa579a",
  "1599058945522-28d584b6f0ff", "1533561052604-c3beb6d55b8d", "1517963628607-235ccdd5476c",
  "1549060279-7e168fcee0c2", "1521805103424-d8f8430e8939", "1517963879433-6ad2b056d712",
  "1583454110551-21f2fa2afe61",
];

const catalogue = [
  ["Velocity Knit Running Tee", "NORTHSTAR", "Sports Clothing", "Running", 1499, 1999, 48, ["S", "M", "L", "XL"], ["Black", "Volt"]],
  ["AeroFlex Training Shorts", "PULSE", "Sports Clothing", "Gym & Fitness", 1299, 1699, 36, ["S", "M", "L", "XL"], ["Navy", "Black"]],
  ["Matchday Football Jersey", "STRIKER", "Sports Clothing", "Football", 1899, 2499, 27, ["S", "M", "L", "XL"], ["Blue", "White"]],
  ["Courtline Basketball Tank", "COURT CO.", "Sports Clothing", "Basketball", 1599, 2099, 22, ["S", "M", "L", "XL"], ["Orange", "Black"]],
  ["PowerMove Training Leggings", "PULSE", "Sports Clothing", "Gym & Fitness", 2199, 2799, 25, ["S", "M", "L", "XL"], ["Black", "Plum"]],
  ["All-Weather Track Jacket", "NORTHSTAR", "Sports Clothing", "Running", 3499, 4499, 19, ["S", "M", "L", "XL"], ["Charcoal", "Blue"]],
  ["Club Cricket Jersey", "STRIKER", "Sports Clothing", "Cricket", 1799, 2299, 42, ["S", "M", "L", "XL"], ["Navy", "Green"]],
  ["Core Training T-Shirt", "PULSE", "Sports Clothing", "Gym & Fitness", 999, 1399, 55, ["S", "M", "L", "XL"], ["White", "Black"]],
  ["Junior Sprint Tee", "NORTHSTAR", "Sports Clothing", "Running", 899, 1199, 31, ["XS", "S", "M"], ["Coral", "Blue"]],
  ["Studio Seamless Sports Bra", "PULSE", "Sports Clothing", "Gym & Fitness", 1899, 2399, 18, ["S", "M", "L"], ["Coral", "Black"]],
  ["PaceRunner 2.0", "NORTHSTAR", "Sports Footwear", "Running", 5499, 6999, 30, ["6", "7", "8", "9", "10"], ["Volt", "Black"]],
  ["Phantom FG Football Boots", "STRIKER", "Sports Footwear", "Football", 6999, 8999, 17, ["7", "8", "9", "10", "11"], ["Black", "Volt"]],
  ["CourtPro Basketball Shoes", "COURT CO.", "Sports Footwear", "Basketball", 7499, 9499, 13, ["7", "8", "9", "10"], ["White", "Red"]],
  ["SmashLite Badminton Shoes", "RALLY", "Sports Footwear", "Badminton", 4299, 5599, 21, ["6", "7", "8", "9", "10"], ["Blue", "White"]],
  ["Baseline Tennis Court Shoes", "RALLY", "Sports Footwear", "Tennis", 4999, 6499, 16, ["7", "8", "9", "10"], ["White", "Green"]],
  ["PowerCricket Spikes", "STRIKER", "Sports Footwear", "Cricket", 5999, 7699, 10, ["7", "8", "9", "10", "11"], ["White", "Navy"]],
  ["Everyday Trainer X", "PULSE", "Sports Footwear", "Gym & Fitness", 3899, 4999, 24, ["6", "7", "8", "9", "10"], ["Grey", "Black"]],
  ["Trailblazer Grip Runner", "NORTHSTAR", "Sports Footwear", "Running", 6299, 7999, 11, ["7", "8", "9", "10"], ["Olive", "Black"]],
  ["ProGrade English Willow Bat", "STRIKER", "Sports Equipment", "Cricket", 8999, 11999, 8, ["SH"], ["Natural"]],
  ["MatchPlay Cricket Ball Set", "STRIKER", "Sports Equipment", "Cricket", 1299, 1699, 40, ["One size"], ["Red"]],
  ["SafeGuard Cricket Helmet", "STRIKER", "Sports Equipment", "Cricket", 3299, 4299, 12, ["M", "L"], ["Navy", "Black"]],
  ["Elite Batting Gloves", "STRIKER", "Sports Equipment", "Cricket", 1899, 2499, 15, ["S", "M", "L"], ["White"]],
  ["ControlPro Football", "STRIKER", "Sports Equipment", "Football", 1799, 2399, 33, ["5"], ["White", "Blue"]],
  ["AeroCarbon Badminton Racket", "RALLY", "Sports Equipment", "Badminton", 3999, 5199, 14, ["One size"], ["Black", "Red"]],
  ["CourtBounce Basketball", "COURT CO.", "Sports Equipment", "Basketball", 2199, 2899, 20, ["7"], ["Orange"]],
  ["Tournament Tennis Ball 3-Pack", "RALLY", "Sports Equipment", "Tennis", 799, 1099, 46, ["One size"], ["Yellow"]],
  ["FeatherFlight Shuttlecock 6-Pack", "RALLY", "Sports Equipment", "Badminton", 699, 899, 38, ["One size"], ["White"]],
  ["Titanium Cricket Pads", "STRIKER", "Sports Equipment", "Cricket", 2999, 3999, 9, ["M", "L"], ["White"]],
  ["ProKeeper Goalkeeper Gloves", "STRIKER", "Sports Equipment", "Football", 2499, 3299, 14, ["8", "9", "10"], ["Lime", "Black"]],
  ["Velocity Resistance Band Kit", "PULSE", "Gym & Fitness", "Gym & Fitness", 999, 1399, 51, ["One size"], ["Multi"]],
  ["BalanceFlow Yoga Mat", "PULSE", "Gym & Fitness", "Gym & Fitness", 1799, 2299, 28, ["One size"], ["Plum", "Sage"]],
  ["Cast Iron Dumbbell Pair 5kg", "PULSE", "Gym & Fitness", "Gym & Fitness", 2499, 3299, 12, ["One size"], ["Black"]],
  ["SpeedRope Pro", "PULSE", "Gym & Fitness", "Gym & Fitness", 899, 1199, 47, ["One size"], ["Black", "Coral"]],
  ["GripMax Training Gloves", "PULSE", "Gym & Fitness", "Gym & Fitness", 1199, 1599, 26, ["S", "M", "L"], ["Black", "Grey"]],
  ["HydroSteel Sports Bottle", "NORTHSTAR", "Accessories", "Running", 1299, 1699, 34, ["750ml"], ["Blue", "Steel"]],
  ["Sprint Performance Socks 3-Pack", "NORTHSTAR", "Accessories", "Running", 699, 999, 62, ["S", "M", "L"], ["White", "Black"]],
  ["CourtSide Adjustable Cap", "COURT CO.", "Accessories", "Basketball", 999, 1399, 23, ["One size"], ["Black", "Orange"]],
  ["TeamCarry Sports Duffel", "STRIKER", "Accessories", "Football", 2799, 3599, 18, ["One size"], ["Black", "Blue"]],
  ["FlexGuard Knee Support Pair", "PULSE", "Accessories", "Gym & Fitness", 1099, 1499, 31, ["S", "M", "L"], ["Black"]],
  ["ActiveTrack GPS Sport Watch", "NORTHSTAR", "Accessories", "Running", 8999, 11499, 7, ["One size"], ["Black", "Coral"]],
];

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI must be set before seeding.");
  await connectDatabase(uri);

  const categories = [...new Set(catalogue.map((item) => item[2] as string))];
  const brands = [...new Set(catalogue.map((item) => item[1] as string))];
  await Promise.all(categories.map((name) => Category.updateOne({ name }, { $setOnInsert: { name, slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-") } }, { upsert: true })));
  await Promise.all(brands.map((name) => Brand.updateOne({ name }, { $setOnInsert: { name, slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-") } }, { upsert: true })));

  for (const [index, item] of catalogue.entries()) {
    const [name, brand, category, sport, price, compareAtPrice, stock, sizes, colors] = item as [string, string, string, string, number, number, number, string[], string[]];
    const slug = name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const image = `https://images.unsplash.com/photo-${photoIds[index]}?auto=format&fit=crop&w=900&q=82`;
    await Product.updateOne(
      { slug },
      {
        $set: {
          name, slug, brand, category, sport,
          description: `${name} brings confident performance and all-day comfort to your ${sport.toLowerCase()} routine. Carefully selected materials and thoughtful details make it ready for training, match day and everything between.`,
          images: [image],
          price,
          compareAtPrice,
          stock,
          sizes,
          colors,
          rating: Number((4.1 + ((index * 7) % 9) / 10).toFixed(1)),
          reviewCount: 18 + ((index * 13) % 180),
          featured: index < 8,
          specifications: {
            Sport: sport,
            Brand: brand,
            Material: category === "Sports Clothing" ? "Moisture-wicking performance knit" : category === "Sports Footwear" ? "Lightweight engineered mesh" : "Durable performance-grade construction",
            Features: "Designed for dependable comfort and control",
            "Care instructions": "Follow label instructions",
          },
        },
      },
      { upsert: true },
    );
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const admin = await User.findOne({ email: adminEmail }).select("+password");
    if (admin && admin.role !== "admin") {
      throw new Error("SEED_ADMIN_EMAIL belongs to a customer account. Use a separate admin email; public profile updates cannot grant admin access.");
    }
    if (!admin) await User.create({ name: "SPORTSPHERE Admin", email: adminEmail, password: adminPassword, role: "admin" });
    console.info(`Admin account available for ${adminEmail}`);
  }
  console.info(`Seeded ${catalogue.length} products, ${categories.length} categories, and ${brands.length} brands.`);
  await mongoose.disconnect();
}

seed().catch(async (error: unknown) => {
  console.error("Seeding failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
