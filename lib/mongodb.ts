import mongoose from 'mongoose';
import { autoSeed } from './autoSeed';

let seeded = false;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
   
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        'Please define the MONGODB_URI environment variable inside .env.local'
      );
    }

    const opts = {
      bufferCommands: false,
      // Bound server selection. The driver default is 30s, which outlives the
      // battle routes' maxDuration=30, so their fail-open path could never run.
      // M0 cold connects (TLS + SRV discovery) take 1-3s, so 5s is comfortably
      // above a healthy cold start without risking a false fail-open.
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  if (!seeded) {
    seeded = true;
    autoSeed().catch((err) => {
      console.error('Auto-seed error:', err);
    });
  }

  return cached.conn;
}

export default dbConnect;
