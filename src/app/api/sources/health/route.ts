import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sourceHealth } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/auth/session";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const health = await db.select().from(sourceHealth);
  return NextResponse.json({ sources: health });
}
