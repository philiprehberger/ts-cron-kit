# @philiprehberger/cron-kit

[![CI](https://github.com/philiprehberger/cron-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/philiprehberger/cron-kit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@philiprehberger/cron-kit.svg)](https://www.npmjs.com/package/@philiprehberger/cron-kit)
[![License](https://img.shields.io/github/license/philiprehberger/cron-kit)](LICENSE)

Cron job scheduler with overlap prevention, timezones, and job management

## Installation

```bash
npm install @philiprehberger/cron-kit
```

## Usage

### Basic

```ts
import { createScheduler } from '@philiprehberger/cron-kit';

const scheduler = createScheduler();

scheduler.addJob({
  name: 'cleanup',
  schedule: '0 3 * * *', // daily at 3am
  handler: async () => {
    await db.sessions.deleteExpired();
  },
});

scheduler.start();
```

### With Options

```ts
scheduler.addJob({
  name: 'report',
  schedule: '0 9 * * 1', // every Monday at 9am
  timezone: 'Europe/Vienna',
  allowOverlap: false,    // skip if previous run still active
  handler: async () => { /* ... */ },
  onStart: () => console.log('Report started'),
  onComplete: (duration) => console.log(`Done in ${duration}ms`),
  onError: (err) => console.error('Report failed:', err),
  onOverlap: () => console.warn('Skipped — still running'),
});
```

### Cron Expressions

Standard 5-field format: `minute hour day-of-month month day-of-week`

```
*     *     *     *     *
│     │     │     │     └── Day of week (0–6, Sun=0)
│     │     │     └──────── Month (1–12)
│     │     └────────────── Day of month (1–31)
│     └──────────────────── Hour (0–23)
└────────────────────────── Minute (0–59)
```

Supports: `*`, values (`5`), ranges (`1-5`), steps (`*/5`), lists (`1,3,5`)

When both day-of-month and day-of-week are specified (not `*`), the job runs when **either** field matches (OR logic), following standard cron behavior.

### Preview Next Runs

```ts
import { nextRuns } from '@philiprehberger/cron-kit';

nextRuns('0 9 * * 1', 3);
// [Date, Date, Date] — next 3 Mondays at 9am

// Or from a job
scheduler.getJob('cleanup').nextRuns(5);
```

### Job Management

```ts
scheduler.getJob('cleanup');   // job info
scheduler.getJobs();           // all jobs
scheduler.removeJob('cleanup');

// Update a job's schedule, handler, or other options
scheduler.updateJob('cleanup', {
  schedule: '0 4 * * *',      // change to 4am
  handler: async () => { /* new logic */ },
});
```

### Job Info

```ts
const job = scheduler.getJob('cleanup');
job.name;         // 'cleanup'
job.running;      // boolean
job.lastRunAt;    // Date | null
job.lastDuration; // number | null (ms)
job.lastError;    // Error | null
job.runCount;     // number
```

### Graceful Shutdown

```ts
scheduler.stop();               // stop scheduling (active jobs keep running)
await scheduler.shutdown();     // stop + wait for active jobs to finish
```

## API

### `createScheduler(): Scheduler`

Creates a new scheduler instance.

| Method | Signature | Description |
|--------|-----------|-------------|
| `addJob` | `(config: JobConfig) => void` | Register a job. Throws if name already exists. |
| `updateJob` | `(name: string, updates: Partial<Omit<JobConfig, 'name'>>) => void` | Update a job's config. Re-parses schedule if changed. Throws if not found. |
| `removeJob` | `(name: string) => void` | Remove a job by name. Throws if not found. |
| `getJob` | `(name: string) => JobInfo` | Get info for a single job. Throws if not found. |
| `getJobs` | `() => JobInfo[]` | Get info for all registered jobs. |
| `start` | `() => void` | Start the scheduler tick loop. |
| `stop` | `() => void` | Stop scheduling (active jobs keep running). |
| `shutdown` | `() => Promise<void>` | Stop and wait for all active jobs to finish. |

### `JobConfig`

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Unique job identifier. |
| `schedule` | `string` | Yes | Cron expression (5 fields). |
| `handler` | `() => Promise<void> \| void` | Yes | Function to execute. |
| `timezone` | `string` | No | IANA timezone (e.g. `"America/Denver"`). |
| `allowOverlap` | `boolean` | No | Skip execution if previous run is still active. Default: `true`. |
| `onStart` | `() => void` | No | Called when job execution begins. |
| `onComplete` | `(duration: number) => void` | No | Called on success with duration in ms. |
| `onError` | `(error: Error) => void` | No | Called when handler throws. |
| `onOverlap` | `() => void` | No | Called when execution is skipped due to overlap. |

### `JobInfo`

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Job name. |
| `schedule` | `string` | Cron expression. |
| `timezone` | `string \| undefined` | Configured timezone. |
| `running` | `boolean` | Whether the job is currently executing. |
| `lastRunAt` | `Date \| null` | When the job last completed. |
| `lastDuration` | `number \| null` | Last run duration in ms. |
| `lastError` | `Error \| null` | Last error thrown by handler. |
| `runCount` | `number` | Total completed executions. |
| `nextRuns` | `(count?: number) => Date[]` | Preview upcoming run times. |

### `nextRuns(expression: string, count?: number, timezone?: string): Date[]`

Returns an array of upcoming dates matching the cron expression.

### `parseCronExpression(expression: string): ParsedCron`

Parses a 5-field cron expression into a structured object.

### `matchesCron(cron: ParsedCron, date: Date): boolean`

Tests whether a date matches a parsed cron expression.

## Limitations

- **Minute-level precision**: The scheduler ticks every 30 seconds to check for matching jobs. All scheduling has minute-level granularity — second-level precision is not supported.
- **Timezone handling**: Timezone conversion uses `Date.toLocaleString()` internally, which may have subtle differences across runtimes.
- **In-memory only**: Job state is not persisted. Restarting the process resets all job counters and history.


## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
