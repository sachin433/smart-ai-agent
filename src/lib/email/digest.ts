import { Resend } from "resend";
import { eq, and, inArray, gte } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { jobs, notifications, preferences } from "@/lib/db/schema";
import { tierMeetsThreshold } from "@/lib/scoring/relevance";
import { randomId } from "@/lib/utils/hash";
import type { RelevanceTier } from "@/lib/types";

export async function sendDigestIfNeeded(db: Db): Promise<{
  sent: boolean;
  count: number;
  reason?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFICATION_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  if (!apiKey || !toEmail) {
    return { sent: false, count: 0, reason: "Email not configured (optional)" };
  }

  const prefs = await db.select().from(preferences).limit(1);
  const threshold = (prefs[0]?.notificationThreshold ?? "strong") as RelevanceTier;

  const matchedJobs = await db
    .select()
    .from(jobs)
    .where(
      and(
        inArray(jobs.status, ["matched", "discovered"]),
        gte(jobs.relevanceScore, prefs[0]?.minRelevanceScore ?? 0.55),
      ),
    );

  const toNotify = matchedJobs.filter((job) => {
    if (!tierMeetsThreshold(job.relevanceTier, threshold)) return false;
    if (job.priorityLane === "P0") return true;
    if (job.priorityLane === "P1" && job.relevanceScore >= 0.75) return true;
    if (job.priorityLane === "P2" && job.relevanceScore >= 0.75) return true;
    return false;
  });

  if (toNotify.length === 0) {
    return { sent: false, count: 0, reason: "No new matches above threshold" };
  }

  const notYetNotified: typeof toNotify = [];
  for (const job of toNotify) {
    const existing = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.jobId, job.id),
          eq(notifications.notificationType, "digest"),
        ),
      )
      .limit(1);
    if (existing.length === 0) notYetNotified.push(job);
  }

  if (notYetNotified.length === 0) {
    return { sent: false, count: 0, reason: "All matches already notified" };
  }

  const exceptional = notYetNotified.filter((j) => j.relevanceTier === "exceptional");
  const strong = notYetNotified.filter((j) => j.relevanceTier === "strong");
  const potential = notYetNotified.filter((j) => j.relevanceTier === "potential");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const html = buildDigestHtml({
    exceptional,
    strong,
    potential,
    appUrl,
  });

  const resend = new Resend(apiKey);
  const subject = `🚀 ${notYetNotified.length} new high-fit infrastructure role${notYetNotified.length > 1 ? "s" : ""}`;

  await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject,
    html,
  });

  for (const job of notYetNotified) {
    await db.insert(notifications).values({
      id: randomId(),
      jobId: job.id,
      notificationType: "digest",
    });
    await db
      .update(jobs)
      .set({ status: "notified" })
      .where(eq(jobs.id, job.id));
  }

  return { sent: true, count: notYetNotified.length };
}

function buildDigestHtml(params: {
  exceptional: Array<{
    title: string;
    companyName: string;
    locations: string[];
    remoteRegions: string[];
    matchReasons: string[];
    concerns: string[];
    canonicalUrl: string;
    id: string;
    firstSeenAt: Date;
  }>;
  strong: typeof params.exceptional;
  potential: typeof params.exceptional;
  appUrl: string;
}): string {
  const sections: string[] = [];

  if (params.exceptional.length > 0) {
    sections.push("<h2>🔥 Exceptional matches</h2>");
    sections.push(...params.exceptional.map(renderJob));
  }
  if (params.strong.length > 0) {
    sections.push("<h2>✅ Strong matches</h2>");
    sections.push(...params.strong.map(renderJob));
  }
  if (params.potential.length > 0) {
    sections.push("<h2>👀 Potential matches</h2>");
    sections.push(...params.potential.map(renderJob));
  }

  return `
    <div style="font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto;">
      <h1>Job Radar Digest</h1>
      <p>Rule-based matching — no AI APIs used. <a href="${params.appUrl}">Open dashboard</a></p>
      ${sections.join("\n")}
      <hr />
      <p style="color: #666; font-size: 12px;">
        Powered by Job Radar. Remotive listings link back per their API terms.
      </p>
    </div>
  `;
}

function renderJob(job: {
  title: string;
  companyName: string;
  locations: string[];
  remoteRegions: string[];
  matchReasons: string[];
  concerns: string[];
  canonicalUrl: string;
  id: string;
  firstSeenAt: Date;
}): string {
  const location = job.locations.join(", ") || "Not specified";
  const remote = job.remoteRegions.join(", ") || "Unknown";
  const reasons = job.matchReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  const concerns = job.concerns.map((c) => `<li>${escapeHtml(c)}</li>`).join("");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return `
    <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <h3>${escapeHtml(job.title)}</h3>
      <p><strong>${escapeHtml(job.companyName)}</strong> · ${escapeHtml(location)} · Remote: ${escapeHtml(remote)}</p>
      ${reasons ? `<p><strong>Why it matches:</strong><ul>${reasons}</ul></p>` : ""}
      ${concerns ? `<p><strong>Potential concerns:</strong><ul>${concerns}</ul></p>` : ""}
      <p>
        <a href="${escapeHtml(job.canonicalUrl)}">Apply</a> ·
        <a href="${escapeHtml(appUrl)}/jobs/${job.id}">View</a>
      </p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
