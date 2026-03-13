import type { CronField, ParsedCron } from './types.js';

const FIELD_RANGES: Array<{ name: string; min: number; max: number }> = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'dayOfMonth', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'dayOfWeek', min: 0, max: 6 },
];

function expandField(field: string, min: number, max: number): CronField {
  if (field === '*') {
    const values: number[] = [];
    for (let i = min; i <= max; i++) values.push(i);
    return { type: 'wildcard', values };
  }

  if (field.includes(',')) {
    const parts = field.split(',');
    const values: number[] = [];
    for (const part of parts) {
      const sub = expandField(part.trim(), min, max);
      values.push(...sub.values);
    }
    return { type: 'list', values: [...new Set(values)].sort((a, b) => a - b) };
  }

  if (field.includes('/')) {
    const [range, stepStr] = field.split('/');
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step <= 0) {
      throw new Error(`Invalid step value: ${stepStr}`);
    }
    let start = min;
    let end = max;
    if (range !== '*') {
      if (range.includes('-')) {
        [start, end] = range.split('-').map(Number);
      } else {
        start = parseInt(range, 10);
      }
    }
    const values: number[] = [];
    for (let i = start; i <= end; i += step) values.push(i);
    return { type: 'step', values };
  }

  if (field.includes('-')) {
    const [startStr, endStr] = field.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
      throw new Error(`Invalid range: ${field}`);
    }
    const values: number[] = [];
    for (let i = start; i <= end; i++) values.push(i);
    return { type: 'range', values };
  }

  const value = parseInt(field, 10);
  if (isNaN(value) || value < min || value > max) {
    throw new Error(`Invalid value: ${field} (expected ${min}-${max})`);
  }
  return { type: 'value', values: [value] };
}

export function parseCronExpression(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
  }

  const fields = parts.map((part, i) => expandField(part, FIELD_RANGES[i].min, FIELD_RANGES[i].max));

  return {
    minute: fields[0],
    hour: fields[1],
    dayOfMonth: fields[2],
    month: fields[3],
    dayOfWeek: fields[4],
  };
}

export function matchesCron(cron: ParsedCron, date: Date): boolean {
  const minuteMatch = cron.minute.values.includes(date.getMinutes());
  const hourMatch = cron.hour.values.includes(date.getHours());
  const monthMatch = cron.month.values.includes(date.getMonth() + 1);
  const domMatch = cron.dayOfMonth.values.includes(date.getDate());
  const dowMatch = cron.dayOfWeek.values.includes(date.getDay());

  // Standard cron behavior: when both day-of-month and day-of-week are
  // restricted (not wildcards), the job runs when *either* field matches (OR).
  // When only one is restricted, it acts as a normal AND condition.
  const domIsWild = cron.dayOfMonth.type === 'wildcard';
  const dowIsWild = cron.dayOfWeek.type === 'wildcard';

  let dayMatch: boolean;
  if (!domIsWild && !dowIsWild) {
    dayMatch = domMatch || dowMatch;
  } else {
    dayMatch = domMatch && dowMatch;
  }

  return minuteMatch && hourMatch && monthMatch && dayMatch;
}

export function getDateInTimezone(timezone?: string): Date {
  if (!timezone) return new Date();
  const str = new Date().toLocaleString('en-US', { timeZone: timezone });
  return new Date(str);
}

export function nextRuns(expression: string, count: number = 5, timezone?: string): Date[] {
  const cron = parseCronExpression(expression);
  const results: Date[] = [];
  const now = getDateInTimezone(timezone);
  const current = new Date(now);
  current.setSeconds(0, 0);
  current.setMinutes(current.getMinutes() + 1);

  const maxIterations = 525600; // 1 year of minutes
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    if (matchesCron(cron, current)) {
      results.push(new Date(current));
    }
    current.setMinutes(current.getMinutes() + 1);
    iterations++;
  }

  return results;
}
