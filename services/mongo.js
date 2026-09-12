// services/mongo.js
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error("Missing MONGO_URI in environment variables");
}

// Reuse connection in dev/hot-reload
let cached = global.__mongoose_cache__;
if (!cached) {
  cached = global.__mongoose_cache__ = { conn: null, promise: null };
}

export async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGO_URI, {
        bufferCommands: false,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
