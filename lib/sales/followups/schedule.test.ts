import { describe, it, expect } from 'vitest';
import {
  isBusinessDay,
  calculateDayNDue,
  calculateNextStepDue,
  toTorontoDate,
  isTaskOverdue,
  formatWhenFuture,
  formatWhenPast,
} from './schedule';
import { TZDate } from '@date-fns/tz';

describe('schedule & Rule R8', () => {
  it('identifies Ontario statutory holidays as non-business days', () => {
    // 2026-10-12 is Thanksgiving in config
    const thanksgiving = new TZDate(2026, 9, 12, 10, 0, 0, 0, 'America/Toronto');
    expect(isBusinessDay(thanksgiving)).toBe(false);

    // 2026-12-25 is Christmas
    const christmas = new TZDate(2026, 11, 25, 10, 0, 0, 0, 'America/Toronto');
    expect(isBusinessDay(christmas)).toBe(false);

    // 2026-10-13 Tuesday is a normal business day
    const tuesday = new TZDate(2026, 9, 13, 10, 0, 0, 0, 'America/Toronto');
    expect(isBusinessDay(tuesday)).toBe(true);
  });

  it('moves target from Saturday/Sunday to Monday', () => {
    // Anchor on Wed Oct 7, 2026; Day 3 is Saturday Oct 10 -> moves to Mon Oct 12? Wait, Oct 12 is Thanksgiving! -> moves to Tue Oct 13!
    const anchor = new TZDate(2026, 9, 7, 14, 0, 0, 0, 'America/Toronto');
    const day3 = calculateDayNDue(anchor, 3);
    const day3Tz = toTorontoDate(day3);
    expect(day3Tz.getFullYear()).toBe(2026);
    expect(day3Tz.getMonth()).toBe(9); // October
    expect(day3Tz.getDate()).toBe(13); // Tuesday Oct 13 (since Sat 10 -> Sun 11 -> Mon 12 holiday -> Tue 13)
    expect(day3Tz.getHours()).toBe(9);
  });

  it('preserves 9:00 AM Toronto time across Daylight Saving Time boundary on Nov 1, 2026', () => {
    // Anchor before DST change: Friday Oct 30, 2026 (EDT, UTC-4)
    // Target Day 4: Tuesday Nov 3, 2026 (EST, UTC-5)
    const anchor = new TZDate(2026, 9, 30, 11, 0, 0, 0, 'America/Toronto');
    const day4 = calculateDayNDue(anchor, 4);
    const day4Tz = toTorontoDate(day4);
    expect(day4Tz.getDate()).toBe(3); // Nov 3
    expect(day4Tz.getMonth()).toBe(10); // November
    expect(day4Tz.getHours()).toBe(9);
    expect(day4Tz.getMinutes()).toBe(0);
  });

  it('applies spacing when an email is sent late (scenario 7)', () => {
    // Anchor Day 0 on Monday Oct 5, 2026
    const anchor = new TZDate(2026, 9, 5, 10, 0, 0, 0, 'America/Toronto');
    // Email 1 completed 2 days late: Wed Oct 7, 2026
    const completedAt = new TZDate(2026, 9, 7, 15, 0, 0, 0, 'America/Toronto');
    // Step 2 offset is Day 4
    const nextDue = calculateNextStepDue(anchor, completedAt, 0, 4);
    const nextDueTz = toTorontoDate(nextDue);
    // Completion (Oct 7) + 4 days = Sunday Oct 11 -> Monday Oct 12 holiday -> Tuesday Oct 13!
    expect(nextDueTz.getDate()).toBe(13);
    expect(nextDueTz.getHours()).toBe(9);
  });

  it('determines task overdue states correctly', () => {
    const now = new TZDate(2026, 9, 7, 15, 0, 0, 0, 'America/Toronto');

    // Call task due 40 minutes ago -> overdue (call cutoff is 30m)
    const callDue40mAgo = new Date(now.getTime() - 40 * 60 * 1000);
    expect(isTaskOverdue({ kind: 'call', due_at: callDue40mAgo }, now)).toBe(true);

    // Call task due 10 minutes ago -> not overdue yet
    const callDue10mAgo = new Date(now.getTime() - 10 * 60 * 1000);
    expect(isTaskOverdue({ kind: 'call', due_at: callDue10mAgo }, now)).toBe(false);

    // pickup_recap due 3 hours ago -> overdue (2h cutoff)
    const recapDue3hAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    expect(isTaskOverdue({ kind: 'email', step_key: 'pickup_recap', due_at: recapDue3hAgo }, now)).toBe(true);

    // Email due today at 9:00 AM -> not overdue at 3:00 PM (end of day is 11:59 PM)
    const emailToday9am = new TZDate(2026, 9, 7, 9, 0, 0, 0, 'America/Toronto');
    expect(isTaskOverdue({ kind: 'email', due_at: emailToday9am }, now)).toBe(false);

    // Email due yesterday -> overdue
    const emailYesterday = new TZDate(2026, 9, 6, 9, 0, 0, 0, 'America/Toronto');
    expect(isTaskOverdue({ kind: 'email', due_at: emailYesterday }, now)).toBe(true);
  });

  it('formats relative future and past strings accurately', () => {
    const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto'); // Wednesday Oct 7

    const today230 = new TZDate(2026, 9, 7, 14, 30, 0, 0, 'America/Toronto');
    expect(formatWhenFuture(today230, now)).toBe('today at 2:30 PM');
    expect(formatWhenPast(today230, now)).toBe('today at 2:30 PM');

    const tomorrow230 = new TZDate(2026, 9, 8, 14, 30, 0, 0, 'America/Toronto');
    expect(formatWhenFuture(tomorrow230, now)).toBe('tomorrow at 2:30 PM');

    const thursOct15 = new TZDate(2026, 9, 15, 14, 30, 0, 0, 'America/Toronto');
    expect(formatWhenFuture(thursOct15, now)).toBe('Thursday, October 15 at 2:30 PM');
  });
});
