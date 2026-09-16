"use client";

import { useState } from "react";
import type { CandidateProfile } from "@/lib/types";

interface Props {
  initial: {
    profile: CandidateProfile;
    notificationThreshold: string;
    minRelevanceScore: number;
  };
}

export function PreferencesForm({ initial }: Props) {
  const [profileJson, setProfileJson] = useState(
    JSON.stringify(initial.profile, null, 2),
  );
  const [threshold, setThreshold] = useState(initial.notificationThreshold);
  const [minScore, setMinScore] = useState(initial.minRelevanceScore);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    setMessage(null);
    try {
      const profile = JSON.parse(profileJson) as CandidateProfile;
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          notificationThreshold: threshold,
          minRelevanceScore: minScore,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMessage("Saved successfully");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Invalid JSON");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Notification threshold</label>
        <select
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
        >
          <option value="exceptional">Exceptional only</option>
          <option value="strong">Strong and above</option>
          <option value="potential">Potential and above</option>
        </select>
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">
          Minimum relevance score (0–1)
        </label>
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={minScore}
          onChange={(e) => setMinScore(parseFloat(e.target.value))}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Profile (JSON)</label>
        <textarea
          value={profileJson}
          onChange={(e) => setProfileJson(e.target.value)}
          rows={20}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-200"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save preferences"}
      </button>

      {message && <p className="text-sm text-zinc-400">{message}</p>}
    </div>
  );
}
