import type { JobConfig, JobInfo, Scheduler } from './types.js';
import { parseCronExpression, matchesCron, getDateInTimezone, nextRuns as getNextRuns } from './parser.js';
import type { ParsedCron } from './types.js';

interface InternalJob {
  config: JobConfig;
  cron: ParsedCron;
  running: boolean;
  lastRunAt: Date | null;
  lastDuration: number | null;
  lastError: Error | null;
  runCount: number;
  lastMatchedMinute: number;
}

export function createScheduler(): Scheduler {
  const jobs = new Map<string, InternalJob>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let shutdownPromise: Promise<void> | null = null;
  let shutdownResolve: (() => void) | null = null;

  function addJob(config: JobConfig): void {
    if (jobs.has(config.name)) {
      throw new Error(`Job "${config.name}" already exists`);
    }
    const cron = parseCronExpression(config.schedule);
    jobs.set(config.name, {
      config,
      cron,
      running: false,
      lastRunAt: null,
      lastDuration: null,
      lastError: null,
      runCount: 0,
      lastMatchedMinute: -1,
    });
  }

  function removeJob(name: string): void {
    if (!jobs.has(name)) {
      throw new Error(`Job "${name}" not found`);
    }
    jobs.delete(name);
  }

  function toJobInfo(job: InternalJob): JobInfo {
    return {
      name: job.config.name,
      schedule: job.config.schedule,
      timezone: job.config.timezone,
      running: job.running,
      lastRunAt: job.lastRunAt,
      lastDuration: job.lastDuration,
      lastError: job.lastError,
      runCount: job.runCount,
      nextRuns: (count = 5) => getNextRuns(job.config.schedule, count, job.config.timezone),
    };
  }

  function getJob(name: string): JobInfo {
    const job = jobs.get(name);
    if (!job) throw new Error(`Job "${name}" not found`);
    return toJobInfo(job);
  }

  function getJobs(): JobInfo[] {
    return [...jobs.values()].map(toJobInfo);
  }

  async function executeJob(job: InternalJob): Promise<void> {
    if (job.running && job.config.allowOverlap === false) {
      job.config.onOverlap?.();
      return;
    }

    job.running = true;
    job.config.onStart?.();
    const start = Date.now();

    try {
      await job.config.handler();
      job.lastDuration = Date.now() - start;
      job.lastError = null;
      job.config.onComplete?.(job.lastDuration);
    } catch (error) {
      job.lastDuration = Date.now() - start;
      const err = error instanceof Error ? error : new Error(String(error));
      job.lastError = err;
      job.config.onError?.(err);
    } finally {
      job.running = false;
      job.runCount++;
      job.lastRunAt = new Date();
      checkShutdown();
    }
  }

  function tick(): void {
    for (const job of jobs.values()) {
      const now = getDateInTimezone(job.config.timezone);
      const currentMinute = now.getFullYear() * 10000000 + (now.getMonth() + 1) * 100000 +
        now.getDate() * 1000 + now.getHours() * 60 + now.getMinutes();

      if (currentMinute === job.lastMatchedMinute) continue;

      if (matchesCron(job.cron, now)) {
        job.lastMatchedMinute = currentMinute;
        executeJob(job);
      }
    }
  }

  function start(): void {
    if (timer) return;
    tick();
    // Tick every 30 seconds. Jobs have minute-level precision — this interval
    // ensures each minute is checked at least once while keeping CPU usage low.
    timer = setInterval(tick, 30000);
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function checkShutdown(): void {
    if (shutdownResolve) {
      const anyRunning = [...jobs.values()].some((j) => j.running);
      if (!anyRunning) {
        shutdownResolve();
        shutdownResolve = null;
      }
    }
  }

  function shutdown(): Promise<void> {
    stop();

    const anyRunning = [...jobs.values()].some((j) => j.running);
    if (!anyRunning) return Promise.resolve();

    if (!shutdownPromise) {
      shutdownPromise = new Promise<void>((resolve) => {
        shutdownResolve = resolve;
      });
    }
    return shutdownPromise;
  }

  return { addJob, removeJob, getJob, getJobs, start, stop, shutdown };
}
