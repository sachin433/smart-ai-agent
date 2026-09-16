"use client";

import { useState } from "react";

export function JobActions({
  jobId,
  status,
}: {
  jobId: string;
  status: string;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [loading, setLoading] = useState(false);

  async function action(name: string, reason?: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: name, reason }),
      });
      if (!res.ok) throw new Error("Action failed");
      const map: Record<string, string> = {
        save: "saved",
        reject: "rejected",
        applied: "applied",
      };
      setCurrentStatus(map[name] ?? currentStatus);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-sm text-zinc-500">Status: {currentStatus}</span>
      <button
        disabled={loading}
        onClick={() => action("save")}
        className="rounded-md bg-emerald-600/20 px-3 py-1 text-sm text-emerald-300 hover:bg-emerald-600/30"
      >
        Save
      </button>
      <button
        disabled={loading}
        onClick={() => action("reject")}
        className="rounded-md bg-red-600/20 px-3 py-1 text-sm text-red-300 hover:bg-red-600/30"
      >
        Reject
      </button>
      <button
        disabled={loading}
        onClick={() => action("applied")}
        className="rounded-md bg-blue-600/20 px-3 py-1 text-sm text-blue-300 hover:bg-blue-600/30"
      >
        Applied
      </button>
    </div>
  );
}
