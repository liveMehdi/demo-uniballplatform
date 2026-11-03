const FINISHED_AFTER_MS = 10 * 60 * 60 * 1000;

export function hasEventFinished(startsAt: string, now: number) {
  return new Date(startsAt).getTime() + FINISHED_AFTER_MS <= now;
}
