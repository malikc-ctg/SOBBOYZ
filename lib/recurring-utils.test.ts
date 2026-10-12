import { describe, it, expect } from 'vitest';
import {
  calculateNextRunDate,
  calculateMonthlyMRR,
  formatRecurrenceSchedule,
  generateDatesForSchedule,
  generateDatesBetween,
} from './recurring-utils';

describe('Recurring Services Utilities', () => {
  it('calculates monthly MRR correctly for multi-day schedules', () => {
    // 3 days a week at $225/visit -> 225 * 3 * 4.33 = $2,922.75
    const mrr = calculateMonthlyMRR(225, 'weekly', ['monday', 'wednesday', 'friday']);
    expect(mrr).toBe(2922.75);
  });

  it('calculates monthly MRR for biweekly service', () => {
    // Biweekly at $200 -> 200 * 2.165 = $433.00
    const mrr = calculateMonthlyMRR(200, 'biweekly', []);
    expect(mrr).toBe(433);
  });

  it('formats recurrence schedule cleanly', () => {
    const schedule = formatRecurrenceSchedule(
      'weekly',
      ['monday', 'wednesday', 'friday'],
      undefined,
      '18:00'
    );
    expect(schedule).toBe('Mon, Wed, Fri @ 6:00 PM (3x/wk)');
  });

  it('generates candidate dates within lookahead window for multi-day schedule', () => {
    const start = new Date('2026-09-14T00:00:00Z'); // Monday
    const dates = generateDatesForSchedule(start, 7, 'weekly', ['monday', 'wednesday', 'friday']);
    expect(dates.length).toBe(3); // Mon, Wed, Fri
    expect(dates[0]).toBe('2026-09-14');
    expect(dates[1]).toBe('2026-09-16');
    expect(dates[2]).toBe('2026-09-18');
  });

  it('calculates next run date advancing to the next scheduled weekday', () => {
    const monday = new Date('2026-09-14T12:00:00');
    const nextDate = calculateNextRunDate(monday, 'weekly', ['monday', 'wednesday', 'friday']);
    expect(nextDate).toBe('2026-09-16'); // Wednesday
  });

  it('generates dates between start and end for monthly recurring (e.g. 20th of every month)', () => {
    const dates = generateDatesBetween('2026-07-20', '2026-10-25', 'monthly');
    expect(dates).toEqual(['2026-07-20', '2026-08-20', '2026-09-20', '2026-10-20']);
  });

  it('generates dates between start and end for monthly recurring (e.g. 8th of every month)', () => {
    const dates = generateDatesBetween('2026-06-08', '2026-10-10', 'monthly');
    expect(dates).toEqual([
      '2026-06-08',
      '2026-07-08',
      '2026-08-08',
      '2026-09-08',
      '2026-10-08',
    ]);
  });

  it('generates dates between start and end for biweekly recurring', () => {
    const dates = generateDatesBetween('2026-10-07', '2026-11-05', 'biweekly');
    expect(dates).toEqual(['2026-10-07', '2026-10-21', '2026-11-04']);
  });

  it('generates dates between start and end for weekly Mondays (e.g. PS740)', () => {
    const dates = generateDatesBetween('2026-07-06', '2026-08-03', 'weekly', ['monday']);
    expect(dates).toEqual([
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
      '2026-07-27',
      '2026-08-03',
    ]);
  });

  it('correctly anchors biweekly schedule during rolling cron lookahead window (e.g. Erin Legary)', () => {
    // Contract starts on Wednesday Oct 7.
    // Cron runs on Friday Oct 9 with a 14-day lookahead (Oct 9 to Oct 23).
    // It must ONLY generate Oct 21 (every 2 weeks from Oct 7), NEVER Oct 9 or Oct 23!
    const datesOct9 = generateDatesBetween('2026-10-09', '2026-10-23', 'biweekly', [], null, '2026-10-07');
    expect(datesOct9).toEqual(['2026-10-21']);

    // Cron runs on Sunday Oct 11 with 14-day lookahead (Oct 11 to Oct 25).
    // It must STILL only generate Oct 21, NEVER Oct 11 or Oct 25!
    const datesOct11 = generateDatesBetween('2026-10-11', '2026-10-25', 'biweekly', [], null, '2026-10-07');
    expect(datesOct11).toEqual(['2026-10-21']);

    // Next run date calculation from Oct 11 anchored to Oct 7 is Oct 21
    const nextDate = calculateNextRunDate('2026-10-11', 'biweekly', [], null, '2026-10-07');
    expect(nextDate).toBe('2026-10-21');
  });

  it('correctly anchors monthly schedule during rolling cron lookahead window (e.g. Nathan, 8th of month)', () => {
    // Contract starts on 8th of month. On Oct 9 with 14-day lookahead (up to Oct 23),
    // Oct 8 has passed and Nov 8 is outside window -> 0 candidate dates.
    const dates = generateDatesBetween('2026-10-09', '2026-10-23', 'monthly', [], null, '2026-06-08');
    expect(dates).toEqual([]);

    const nextDate = calculateNextRunDate('2026-10-11', 'monthly', [], null, '2026-06-08');
    expect(nextDate).toBe('2026-11-08');
  });
});

