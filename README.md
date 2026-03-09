# @philiprehberger/cron-kit

Cron job scheduler with overlap prevention, timezones, and job management.

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

Supports: `*`, values (`5`), ranges (`1-5`), steps (`*/5`), lists (`1,3,5`).

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

## License

MIT
