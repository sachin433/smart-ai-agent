import type { JobSource } from "@/lib/types";
import { ArbeitnowSource } from "./arbeitnow";
import { AshbySource } from "./ashby";
import { GreenhouseSource } from "./greenhouse";
import { LeverSource } from "./lever";
import { RemoteOkSource } from "./remoteok";
import { RemotiveSource } from "./remotive";
import { WorkdaySource } from "./workday";

/** ATS board adapters + high-leverage aggregator feeds. */
const sources: Record<string, JobSource> = {
  greenhouse: new GreenhouseSource(),
  lever: new LeverSource(),
  ashby: new AshbySource(),
  remotive: new RemotiveSource(),
  arbeitnow: new ArbeitnowSource(),
  remoteok: new RemoteOkSource(),
  workday: new WorkdaySource(),
};

export const AGGREGATOR_SOURCES = ["remotive", "arbeitnow", "remoteok"] as const;

export function getSource(atsType: string): JobSource | null {
  return sources[atsType] ?? null;
}

export function getAllSources(): JobSource[] {
  return Object.values(sources);
}

export {
  GreenhouseSource,
  LeverSource,
  AshbySource,
  RemotiveSource,
  ArbeitnowSource,
  RemoteOkSource,
  WorkdaySource,
};
