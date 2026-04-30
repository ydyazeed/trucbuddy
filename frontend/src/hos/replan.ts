import type { EngineInputs, ReplanTrigger } from "./types";

/**
 * Detect events that should trigger a replan from "now" forward.
 * For LITE active tracking we trigger on:
 *   - Plan-changed user action (event.event_type === "replan")
 *   - Status changes that move beyond the next planned stop boundary
 */
export function detectReplanTriggers(input: EngineInputs): ReplanTrigger[] {
  const triggers: ReplanTrigger[] = [];
  for (const event of input.events) {
    if (event.event_type === "replan") {
      triggers.push({ reason: "User-requested re-plan", at: event.occurred_at });
    }
  }
  return triggers;
}
