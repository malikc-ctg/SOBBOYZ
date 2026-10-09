// ============================================================
// Sea of Blue - Recurring Services Utility Engine
// Pure functions for schedule calculations, MRR, and job generation
// ============================================================

import { addDays, addMonths, format, isBefore, isAfter, parseISO, startOfDay } from 'date-fns';
import type { DayOfWeek, RecurringFrequency } from '@/types';
import { format12Hour } from './time-utils';

export const DAY_NAMES: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export const FREQUENCY_TITLE_MAP: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-Weekly',
  monthly: 'Monthly',
};

/**
 * Calculates the next calendar run date (YYYY-MM-DD) for a recurring agreement.
 */
export function calculateNextRunDate(
  fromDate: Date | string,
  frequency: RecurringFrequency,
  daysOfWeek: string[] = [],
  preferredDay?: string | null
): string {
  const base = typeof fromDate === 'string' ? parseISO(fromDate) : fromDate;
  const start = startOfDay(base);

  // If specific days of week are given (e.g. ['monday', 'wednesday', 'friday'])
  if (daysOfWeek.length > 0) {
    const targetDays = daysOfWeek.map(d => d.toLowerCase());
    for (let i = 1; i <= 35; i++) {
      const candidate = addDays(start, i);
      const dayName = DAY_NAMES[candidate.getDay()];
      if (targetDays.includes(dayName)) {
        return format(candidate, 'yyyy-MM-dd');
      }
    }
  }

  // If single preferredDay is provided
  if (preferredDay) {
    const targetDay = preferredDay.toLowerCase();
    for (let i = 1; i <= 14; i++) {
      const candidate = addDays(start, i);
      if (DAY_NAMES[candidate.getDay()] === targetDay) {
        if (frequency === 'biweekly') {
          return format(addDays(candidate, 7), 'yyyy-MM-dd');
        }
        return format(candidate, 'yyyy-MM-dd');
      }
    }
  }

  // Default jump based on frequency
  if (frequency === 'weekly') {
    return format(addDays(start, 7), 'yyyy-MM-dd');
  }
  if (frequency === 'biweekly') {
    return format(addDays(start, 14), 'yyyy-MM-dd');
  }
  if (frequency === 'monthly') {
    return format(addMonths(start, 1), 'yyyy-MM-dd');
  }

  return format(addDays(start, 7), 'yyyy-MM-dd');
}

/**
 * Calculates Monthly Recurring Revenue (MRR) from price per clean, frequency, and days per week.
 */
export function calculateMonthlyMRR(
  pricePerVisit: number,
  frequency: RecurringFrequency,
  daysOfWeek: string[] = []
): number {
  if (!pricePerVisit || pricePerVisit <= 0) return 0;

  // If multiple days per week (e.g. 3x/week Mon/Wed/Fri)
  if (daysOfWeek.length > 0) {
    const visitsPerWeek = daysOfWeek.length;
    // 4.33 weeks per month average
    return Math.round(pricePerVisit * visitsPerWeek * 4.33 * 100) / 100;
  }

  switch (frequency) {
    case 'weekly':
      return Math.round(pricePerVisit * 4.33 * 100) / 100;
    case 'biweekly':
      return Math.round(pricePerVisit * 2.165 * 100) / 100;
    case 'monthly':
      return Math.round(pricePerVisit * 100) / 100;
    default:
      return pricePerVisit;
  }
}

/**
 * Returns human-readable schedule summary, e.g. "Mon, Wed, Fri @ 6:00 PM (3x/week)"
 */
export function formatRecurrenceSchedule(
  frequency: RecurringFrequency,
  daysOfWeek: string[] = [],
  preferredDay?: string | null,
  startTime: string = '09:00'
): string {
  const formattedTime = format12Hour(startTime) || startTime;

  if (daysOfWeek.length > 0) {
    const dayLabels = daysOfWeek.map(d => DAY_LABELS[d.toLowerCase() as DayOfWeek] || d).join(', ');
    return `${dayLabels} @ ${formattedTime} (${daysOfWeek.length}x/wk)`;
  }

  if (preferredDay) {
    const dayLabel = DAY_LABELS[preferredDay.toLowerCase() as DayOfWeek] || preferredDay;
    return `${FREQUENCY_TITLE_MAP[frequency] || frequency} on ${dayLabel} @ ${formattedTime}`;
  }

  return `${FREQUENCY_TITLE_MAP[frequency] || frequency} @ ${formattedTime}`;
}

/**
 * Generates all candidate job dates (YYYY-MM-DD) between startDate and endDate.
 */
export function generateDatesBetween(
  startDate: Date | string,
  endDate: Date | string,
  frequency: RecurringFrequency,
  daysOfWeek: string[] = [],
  preferredDay?: string | null
): string[] {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  const dates: string[] = [];

  let current = startOfDay(start);
  const boundary = startOfDay(end);

  if (isAfter(current, boundary)) {
    return [];
  }

  // Monthly: anchor to the same calendar day each month (e.g. 8th or 20th)
  if (frequency === 'monthly') {
    while (!isAfter(current, boundary)) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addMonths(current, 1);
    }
    return dates;
  }

  // Bi-weekly: step 14 days from start
  if (frequency === 'biweekly') {
    while (!isAfter(current, boundary)) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 14);
    }
    return dates;
  }

  // Weekly with multiple days of week
  if (daysOfWeek.length > 0) {
    const targetDays = daysOfWeek.map(d => d.toLowerCase());
    while (!isAfter(current, boundary)) {
      const dayName = DAY_NAMES[current.getDay()];
      if (targetDays.includes(dayName)) {
        dates.push(format(current, 'yyyy-MM-dd'));
      }
      current = addDays(current, 1);
    }
    return dates;
  }

  // Weekly with single preferred day
  if (preferredDay) {
    const targetDay = preferredDay.toLowerCase();
    // Advance current until it hits targetDay
    while (DAY_NAMES[current.getDay()] !== targetDay && !isAfter(current, boundary)) {
      current = addDays(current, 1);
    }
    while (!isAfter(current, boundary)) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 7);
    }
    return dates;
  }

  // Standard weekly step
  while (!isAfter(current, boundary)) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current = addDays(current, 7);
  }

  return dates;
}

/**
 * Generates all candidate job dates (YYYY-MM-DD) between startDate and lookahead window for a recurring schedule.
 */
export function generateDatesForSchedule(
  startDate: Date | string,
  lookaheadDays: number,
  frequency: RecurringFrequency,
  daysOfWeek: string[] = [],
  preferredDay?: string | null
): string[] {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = addDays(startOfDay(start), lookaheadDays);
  return generateDatesBetween(start, end, frequency, daysOfWeek, preferredDay);
}

