import { buildDailyLogs } from "./logs";
import { detectReplanTriggers } from "./replan";
import { buildSchedule } from "./schedule";
import type { EngineInputs, EngineOutputs } from "./types";

export function runEngine(input: EngineInputs): EngineOutputs {
  const sched = buildSchedule(input);
  const dailyLogs = buildDailyLogs(sched.schedule);
  return {
    schedule: sched.schedule,
    dailyLogs,
    hosClocks: sched.clocks,
    feasibility: sched.feasibility,
    upcoming: sched.upcoming,
    replanTriggers: detectReplanTriggers(input),
    totals: sched.totals,
  };
}

export * from "./types";
export { RULES, classifyZone } from "./rules";
export { buildDailyLogs, validateDailyLog } from "./logs";
