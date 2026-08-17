/** Punctuality scoring math. Always calculated; only surfaced when the team toggle is on. */

export const SESSION_WINDOW_MS = 60 * 60 * 1000; // 1 hour (close job window)
export const WINDOW_BEFORE_MS = 3 * 60 * 60 * 1000; // scan may come 3 hours before start
export const WINDOW_AFTER_MS = 60 * 60 * 1000; // and up to 1 hour after
export const UNEXCUSED_POINTS = -45;
export const MAX_SESSION_POINTS = 22.5;
export const MIN_SCANNED_POINTS = -30;

/** Points for a scan, given the scheduled time and the actual scan time. */
export function punctualityPoints(scheduledTime: Date | string, scanTime: Date | string): number {
  const scheduled = new Date(scheduledTime).getTime();
  const scan = new Date(scanTime).getTime();
  const minutesEarly = (scheduled - scan) / 60000;

  if (minutesEarly < 0) {
    const minutesLate = -minutesEarly;
    if (minutesLate > 30) return MIN_SCANNED_POINTS;
    return round(-minutesLate);
  }
  if (minutesEarly < 5) return 0;
  if (minutesEarly <= 15) return round(minutesEarly);
  if (minutesEarly <= 30) return round(15 + (minutesEarly - 15) * 0.5);
  return MAX_SESSION_POINTS;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatPoints(points: number): string {
  const sign = points > 0 ? "+" : points < 0 ? "−" : "";
  return `${sign}${Math.abs(points).toFixed(1)}`;
}

/** True when the scan falls inside a session's check-in window. */
export function inWindow(scheduledTime: string | Date, scanTime: Date): boolean {
  const scheduled = new Date(scheduledTime).getTime();
  const scan = scanTime.getTime();
  return scan >= scheduled - WINDOW_BEFORE_MS && scan <= scheduled + WINDOW_AFTER_MS;
}

/**
 * Pick the session whose scheduled time is nearest the scan, within the window.
 * Strictly group-siloed: a session only matches when its expected groups include
 * the athlete's group, or when it has no expected groups (whole-team session).
 */
export function matchSession<
  T extends {
    scheduled_time: string;
    is_cancelled: boolean;
    expected_group_ids?: string[] | null;
  },
>(sessions: T[], scanTime: Date, groupId: string | null): T | null {
  const scan = scanTime.getTime();
  let best: T | null = null;
  let bestDelta = Infinity;
  for (const session of sessions) {
    if (session.is_cancelled) continue;
    const groups = (session.expected_group_ids ?? []) as string[];
    if (groups.length > 0 && (!groupId || !groups.includes(groupId))) continue;
    if (!inWindow(session.scheduled_time, scanTime)) continue;
    const delta = Math.abs(new Date(session.scheduled_time).getTime() - scan);
    if (delta < bestDelta) {
      best = session;
      bestDelta = delta;
    }
  }
  return best;
}