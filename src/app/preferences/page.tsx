import { PreferencesForm } from "@/components/preferences-form";
import { getDb } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { DEFAULT_PROFILE } from "@/lib/defaults/profile";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  let data = {
    profile: DEFAULT_PROFILE,
    notificationThreshold: "strong",
    minRelevanceScore: 0.55,
  };

  try {
    const db = getDb();
    const rows = await db.select().from(preferences).where(eq(preferences.id, "default")).limit(1);
    if (rows[0]) {
      data = {
        profile: rows[0].profile as typeof DEFAULT_PROFILE,
        notificationThreshold: rows[0].notificationThreshold,
        minRelevanceScore: rows[0].minRelevanceScore,
      };
    }
  } catch {
    // use defaults
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-white">Candidate DNA</h1>
        <p className="mt-1 text-zinc-400">
          Edit your profile. Matching uses rules only — no LLM calls.
        </p>
      </div>
      <PreferencesForm initial={data} />
    </div>
  );
}
