// =============================
// components/utils/time-ui.ts
// =============================
import { MINUTES_IN_DAY, Day, DAY_NAMES } from "../../lib/types";
import { fmtHHMM } from "../../lib/time";

export function minutesToDayTime(mins: number) {
  const day = (Math.floor(mins / MINUTES_IN_DAY) % 7) as Day;
  const time = fmtHHMM(mins % MINUTES_IN_DAY);
  return { day, time };
}

export function dayTimeLabel(mins: number) {
  const { day, time } = minutesToDayTime(mins);
  return `${DAY_NAMES[day]} ${time}`;
}
