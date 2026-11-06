import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";

async function start(): Promise<void> {
  const port = Number(process.env.PORT ?? 5000);
  const mongoUri = process.env.MONGODB_URI;
  const jwtSecret = process.env.JWT_SECRET;
  if (!mongoUri) throw new Error("MONGODB_URI is required. Copy server/.env.example to server/.env and configure it.");
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith("replace-this")) {
    throw new Error("Set JWT_SECRET to a private random value of at least 32 characters in server/.env.");
  }
  await connectDatabase(mongoUri);
  app.listen(port, () => console.info(`SPORTSPHERE API listening on http://localhost:${port}`));
}

start().catch((error: unknown) => {
  console.error("Could not start SPORTSPHERE API:", error);
  process.exitCode = 1;
});
