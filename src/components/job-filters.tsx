"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const LANES = ["P0", "P1", "P2", "P3"] as const;

export function JobFilters() {
  const searchParams = useSearchParams();
  const currentLane = searchParams.get("lane");
  const currentVisa = searchParams.get("visa");

  function hrefFor(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const q = params.toString();
    return q ? `/jobs?${q}` : "/jobs";
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-zinc-500">Lane:</span>
      <Link
        href="/jobs"
        className={`rounded-md px-2 py-1 ${!currentLane ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"}`}
      >
        All
      </Link>
      {LANES.map((lane) => (
        <Link
          key={lane}
          href={hrefFor({ lane: currentLane === lane ? null : lane })}
          className={`rounded-md px-2 py-1 ${
            currentLane === lane ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
          }`}
        >
          {lane}
        </Link>
      ))}
      <span className="mx-2 text-zinc-700">|</span>
      <span className="text-zinc-500">Visa:</span>
      <Link
        href={hrefFor({ visa: currentVisa === "sponsored" ? null : "sponsored" })}
        className={`rounded-md px-2 py-1 ${
          currentVisa === "sponsored" ? "bg-green-900/50 text-green-300" : "text-zinc-400 hover:text-white"
        }`}
      >
        Sponsored
      </Link>
      <Link
        href={hrefFor({ visa: currentVisa === "verify" ? null : "verify" })}
        className={`rounded-md px-2 py-1 ${
          currentVisa === "verify" ? "bg-amber-900/50 text-amber-300" : "text-zinc-400 hover:text-white"
        }`}
      >
        Verify
      </Link>
    </div>
  );
}
