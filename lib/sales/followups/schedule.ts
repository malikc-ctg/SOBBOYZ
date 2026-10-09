import { TZDate } from '@date-fns/tz';
import { FOLLOWUP_CONFIG } from './config';

export const TORONTO_TZ = FOLLOWUP_CONFIG.timezone; // 'America/Toronto'

/**
 * Returns a TZDate in America/Toronto.
 */
export function toTorontoDate(d: Date | string | number): TZDate {
  if (d instanceof TZDate) return d;
  const time = typeof d === 'number' ? d : d instanceof Date ? d.getTime() : new Date(d).getTime();
  return new TZDate(time, TORONTO_TZ);
}


/**
 * Formats a Date as 'YYYY-MM-DD' in America/Toronto.
 */
export function formatTorontoDateKey(d: Date | string | number): string {
  const tz = toTorontoDate(d);
  const y = tz.getFullYear();
  const m = String(tz.getMonth() + 1).padStart(2, '0');
  const day = String(tz.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Checks if a date is a business day (Mon-Fri and not an Ontario statutory holiday).
 */
export function isBusinessDay(d: Date | string | number): boolean {
  const tz = toTorontoDate(d);
  const dayOfWeek = tz.getDay(); // 0 is Sunday, 6 is Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  const key = formatTorontoDateKey(tz);
  return !FOLLOWUP_CONFIG.holidays.includes(key);
}

/**
 * Moves forward to the next business day if the date is not a business day,
 * or returns the same date if it is already a business day.
 * Sets the time to the specified hour and minute in Toronto time.
 */
export function moveToBusinessDayAt(d: Date | string | number, hour: number, minute: number = 0): Date {
  let tz = toTorontoDate(d);
  tz = new TZDate(tz.getFullYear(), tz.getMonth(), tz.getDate(), hour, minute, 0, 0, TORONTO_TZ);

  while (!isBusinessDay(tz)) {
    tz = new TZDate(tz.getFullYear(), tz.getMonth(), tz.getDate() + 1, hour, minute, 0, 0, TORONTO_TZ);
  }
  return new Date(tz.getTime());
}

/**
 * Next business day strictly after the given date at HH:MM.
 */
export function nextBusinessDayAt(d: Date | string | number, hour: number, minute: number = 0): Date {
  let tz = toTorontoDate(d);
  tz = new TZDate(tz.getFullYear(), tz.getMonth(), tz.getDate() + 1, hour, minute, 0, 0, TORONTO_TZ);

  while (!isBusinessDay(tz)) {
    tz = new TZDate(tz.getFullYear(), tz.getMonth(), tz.getDate() + 1, hour, minute, 0, 0, TORONTO_TZ);
  }
  return new Date(tz.getTime());
}

/**
 * Adds N business days after the given date at HH:MM.
 */
export function addBusinessDaysAt(d: Date | string | number, businessDays: number, hour: number, minute: number = 0): Date {
  let tz = toTorontoDate(d);
  let added = 0;
  while (added < businessDays) {
    tz = new TZDate(tz.getFullYear(), tz.getMonth(), tz.getDate() + 1, hour, minute, 0, 0, TORONTO_TZ);
    if (isBusinessDay(tz)) {
      added++;
    }
  }
  return new Date(tz.getTime());
}

/**
 * Previous business day strictly before the given date at HH:MM.
 */
export function prevBusinessDayAt(d: Date | string | number, hour: number, minute: number = 0): Date {
  let tz = toTorontoDate(d);
  tz = new TZDate(tz.getFullYear(), tz.getMonth(), tz.getDate() - 1, hour, minute, 0, 0, TORONTO_TZ);

  while (!isBusinessDay(tz)) {
    tz = new TZDate(tz.getFullYear(), tz.getMonth(), tz.getDate() - 1, hour, minute, 0, 0, TORONTO_TZ);
  }
  return new Date(tz.getTime());
}

/**
 * Calculates due date for a Day N step:
 * Target is the anchor's Toronto date plus N calendar days at 9:00 AM, moved forward to next business day.
 * Day 0 is due immediately at anchor time and is never moved.
 */
export function calculateDayNDue(anchor: Date, dayOffset: number, hour: number = FOLLOWUP_CONFIG.emailHour): Date {
  if (dayOffset === 0) {
    return new Date(anchor.getTime());
  }
  const anchorTz = toTorontoDate(anchor);
  const targetTz = new TZDate(anchorTz.getFullYear(), anchorTz.getMonth(), anchorTz.getDate() + dayOffset, hour, 0, 0, 0, TORONTO_TZ);
  return moveToBusinessDayAt(targetTz, hour, 0);
}

/**
 * Spacing rule (spec 5.2):
 * Step n+1 is due at the later of:
 * (a) its own target (from anchor)
 * (b) step n's completion date plus (offset of n+1 minus offset of n) calendar days at 9:00 AM.
 * Then move forward to a business day.
 */
export function calculateNextStepDue(
  anchor: Date,
  prevCompletedAt: Date,
  prevOffset: number,
  nextOffset: number,
  hour: number = FOLLOWUP_CONFIG.emailHour
): Date {
  const ownTarget = calculateDayNDue(anchor, nextOffset, hour);

  const deltaDays = Math.max(0, nextOffset - prevOffset);
  const prevCompTz = toTorontoDate(prevCompletedAt);
  const completionTargetTz = new TZDate(
    prevCompTz.getFullYear(),
    prevCompTz.getMonth(),
    prevCompTz.getDate() + deltaDays,
    hour,
    0,
    0,
    0,
    TORONTO_TZ
  );
  const spacedTarget = moveToBusinessDayAt(completionTargetTz, hour, 0);

  const finalTime = Math.max(ownTarget.getTime(), spacedTarget.getTime());
  return new Date(finalTime);
}

/**
 * Checks whether a task is overdue relative to `now`.
 */
export function isTaskOverdue(task: { kind: string; step_key?: string; due_at: string | Date }, now: Date = new Date()): boolean {
  const due = new Date(task.due_at);
  const nowMs = now.getTime();
  const dueMs = due.getTime();

  // Per-step overrides (Appendix A):
  if (task.step_key === 'pickup_recap') {
    return nowMs > dueMs + 2 * 60 * 60 * 1000; // 2 hours after due
  }
  if (task.step_key === 'wt_visit') {
    return nowMs > dueMs + 4 * 60 * 60 * 1000; // 4 hours after due
  }
  if (task.step_key === 'wt_quote') {
    return nowMs > dueMs; // overdue at that moment
  }

  // Call tasks: 30 minutes after due
  if (task.kind === 'call') {
    return nowMs > dueMs + 30 * 60 * 1000;
  }

  // Email and to-do: end of due day (11:59:59 PM Toronto time)
  const dueTz = toTorontoDate(due);
  const endOfDay = new TZDate(dueTz.getFullYear(), dueTz.getMonth(), dueTz.getDate(), 23, 59, 59, 999, TORONTO_TZ);
  return nowMs > endOfDay.getTime();
}

/**
 * Returns the column bucket for the follow-up view:
 * 'overdue' | 'due_today' | 'upcoming' | 'later'
 */
export function getDueBucket(task: { kind: string; step_key?: string; due_at: string | Date }, now: Date = new Date()): string {
  if (isTaskOverdue(task, now)) {
    return 'overdue';
  }

  const due = new Date(task.due_at);
  const nowTz = toTorontoDate(now);
  const dueTz = toTorontoDate(due);

  const sameDay =
    nowTz.getFullYear() === dueTz.getFullYear() &&
    nowTz.getMonth() === dueTz.getMonth() &&
    nowTz.getDate() === dueTz.getDate();

  if (sameDay || due.getTime() <= now.getTime()) {
    return 'due_today';
  }

  // Next 7 days
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (due.getTime() <= sevenDaysLater.getTime()) {
    return 'upcoming';
  }

  return 'later';
}

/**
 * Formatters for email merge fields (Appendix C.0):
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * {time}: "10:00 AM", minutes always shown.
 */
export function formatTorontoTime(d: Date | string | number): string {
  const tz = toTorontoDate(d);
  let h = tz.getHours();
  const m = String(tz.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * {day}: "Thursday, October 8"
 */
export function formatTorontoDay(d: Date | string | number): string {
  const tz = toTorontoDate(d);
  const dayName = DAYS[tz.getDay()];
  const monthName = MONTHS[tz.getMonth()];
  return `${dayName}, ${monthName} ${tz.getDate()}`;
}

/**
 * Mon d: "Oct 8"
 */
export function formatTorontoShortDay(d: Date | string | number): string {
  const tz = toTorontoDate(d);
  const m = MONTHS[tz.getMonth()].slice(0, 3);
  return `${m} ${tz.getDate()}`;
}

/**
 * {when_future}, relative to `now`:
 * "today at 2:30 PM", "tomorrow at 2:30 PM", "Thursday at 2:30 PM" (2 to 6 days ahead),
 * "Thursday, October 22 at 2:30 PM" (7 or more days ahead).
 */
export function formatWhenFuture(target: Date | string | number, now: Date = new Date()): string {
  const tTz = toTorontoDate(target);
  const nTz = toTorontoDate(now);

  const tStart = new TZDate(tTz.getFullYear(), tTz.getMonth(), tTz.getDate(), 0, 0, 0, 0, TORONTO_TZ);
  const nStart = new TZDate(nTz.getFullYear(), nTz.getMonth(), nTz.getDate(), 0, 0, 0, 0, TORONTO_TZ);
  const diffDays = Math.round((tStart.getTime() - nStart.getTime()) / (24 * 60 * 60 * 1000));
  const timeStr = formatTorontoTime(target);

  if (diffDays <= 0) {
    return `today at ${timeStr}`;
  }
  if (diffDays === 1) {
    return `tomorrow at ${timeStr}`;
  }
  if (diffDays >= 2 && diffDays <= 6) {
    const dayName = DAYS[tTz.getDay()];
    return `${dayName} at ${timeStr}`;
  }
  return `${formatTorontoDay(target)} at ${timeStr}`;
}

/**
 * {when_past}, relative to `now`:
 * "today at 2:30 PM", "yesterday at 2:30 PM", "on Thursday at 2:30 PM" (2 to 6 days ago),
 * "on Thursday, October 8 at 2:30 PM" (older).
 */
export function formatWhenPast(target: Date | string | number, now: Date = new Date()): string {
  const tTz = toTorontoDate(target);
  const nTz = toTorontoDate(now);

  const tStart = new TZDate(tTz.getFullYear(), tTz.getMonth(), tTz.getDate(), 0, 0, 0, 0, TORONTO_TZ);
  const nStart = new TZDate(nTz.getFullYear(), nTz.getMonth(), nTz.getDate(), 0, 0, 0, 0, TORONTO_TZ);
  const diffDays = Math.round((nStart.getTime() - tStart.getTime()) / (24 * 60 * 60 * 1000));
  const timeStr = formatTorontoTime(target);

  if (diffDays <= 0) {
    return `today at ${timeStr}`;
  }
  if (diffDays === 1) {
    return `yesterday at ${timeStr}`;
  }
  if (diffDays >= 2 && diffDays <= 6) {
    const dayName = DAYS[tTz.getDay()];
    return `on ${dayName} at ${timeStr}`;
  }
  return `on ${formatTorontoDay(target)} at ${timeStr}`;
}

/**
 * Same day rule: Toronto date of target equals Toronto date of anchor.
 */
export function isSameTorontoDate(d1: Date | string | number, d2: Date | string | number): boolean {
  return formatTorontoDateKey(d1) === formatTorontoDateKey(d2);
}

/**
 * Returns simple past day string relative to now:
 * "today", "yesterday", "Monday" .. "Sunday" (2-6 days ago), or "October 8"
 */
export function formatPastDaySimple(target: Date | string | number, now: Date = new Date()): string {
  const tTz = toTorontoDate(target);
  const nTz = toTorontoDate(now);

  const tStart = new TZDate(tTz.getFullYear(), tTz.getMonth(), tTz.getDate(), 0, 0, 0, 0, TORONTO_TZ);
  const nStart = new TZDate(nTz.getFullYear(), nTz.getMonth(), nTz.getDate(), 0, 0, 0, 0, TORONTO_TZ);
  const diffDays = Math.round((nStart.getTime() - tStart.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return 'today';
  }
  if (diffDays === 1) {
    return 'yesterday';
  }
  if (diffDays >= 2 && diffDays <= 6) {
    return DAYS[tTz.getDay()];
  }
  return formatTorontoDay(target);
}

