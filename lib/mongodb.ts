import mongoose, { Connection, Mongoose } from 'mongoose';

/**
 * Shape of the cached connection object stored on `globalThis`.
 * We keep both the ongoing connection promise and the resolved connection
 * so we can reuse them across hot reloads in development.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

/**
 * Augment the global scope type so TypeScript knows about `global.mongoose`.
 *
 * In Next.js (Node.js runtime), `globalThis` is shared between hot reloads
 * during development, which allows us to cache the database connection and
 * avoid creating multiple connections.
 */
declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

// Initialize the cached object on `globalThis` (or reuse the existing one).
const cached: MongooseCache = global.mongoose ?? { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

/**
 * MongoDB connection URI.
 *
 * You should define this in your environment variables, e.g.
 * - `.env.local` for local development
 * - Deployment-specific env config for production
 */
const MONGODB_URI: string | undefined = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  // Fail fast if the URI is not configured. This error will surface
  // early in both development and production.
  throw new Error('Please define the MONGODB_URI environment variable.');
}

/**
 * Establishes (or reuses) a connection to MongoDB using Mongoose.
 *
 * This function:
 * - Reuses an existing connection if available
 * - Reuses an in-flight connection promise if a connection is already being established
 * - Otherwise, creates a new connection and caches it
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  // If we already have an active connection, reuse it.
  if (cached.conn) {
    return cached.conn;
  }

  // If a connection is already in progress, reuse the promise.
  if (!cached.promise) {
    const options: Parameters<typeof mongoose.connect>[1] = {
      // Add any mongoose options you need here, for example:
      // dbName: 'my-database-name',
      // autoIndex: true,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI!, options)
      .then((mongooseInstance) => {
        return mongooseInstance;
      });
  }

  // Wait for the connection to complete and cache it.
  cached.conn = await cached.promise;

  return cached.conn;
}

/**
 * Optional helper to access the underlying Mongoose connection instance.
 *
 * Useful if you want to check connection state or access the native driver.
 */
export function getMongooseConnection(): Connection | null {
  if (!cached.conn) return null;
  return cached.conn.connection;
}
