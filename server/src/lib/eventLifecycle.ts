export const FINISHED_AFTER_MS = 10 * 60 * 60 * 1000;

export function hasEventFinished(startsAt: Date, now = Date.now()) {
  return startsAt.getTime() + FINISHED_AFTER_MS <= now;
}
