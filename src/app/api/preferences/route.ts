import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { DEFAULT_PROFILE } from "@/lib/defaults/profile";
import { isAuthenticated } from "@/lib/auth/session";
import type { CandidateProfile } from "@/lib/types";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db.select().from(preferences).where(eq(preferences.id, "default")).limit(1);

  if (rows.length === 0) {
    return NextResponse.json({
      profile: DEFAULT_PROFILE,
      notificationThreshold: "strong",
      minRelevanceScore: 0.55,
    });
  }

  return NextResponse.json(rows[0]);
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const db = getDb();

  await db
    .insert(preferences)
    .values({
      id: "default",
      profile: body.profile as CandidateProfile,
      notificationThreshold: body.notificationThreshold ?? "strong",
      minRelevanceScore: body.minRelevanceScore ?? 0.55,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: preferences.id,
      set: {
        profile: body.profile,
        notificationThreshold: body.notificationThreshold,
        minRelevanceScore: body.minRelevanceScore,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
