import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

function isLocalDatabase(url: string): boolean {
  return (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("@postgres:")
  );
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  if (isLocalDatabase(url)) {
    const pool = new pg.Pool({ connectionString: url });
    return drizzlePg(pool, { schema });
  }

  const sql = neon(url);
  return drizzleNeon(sql, { schema });
}

export type Db = ReturnType<typeof getDb>;
