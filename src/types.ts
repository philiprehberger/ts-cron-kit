export interface CronField {
  type: 'wildcard' | 'value' | 'range' | 'step' | 'list';
  values: number[];
}

export interface ParsedCron {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

export interface JobConfig {
  name: string;
  schedule: string;
  handler: () => Promise<void> | void;
  timezone?: string;
  allowOverlap?: boolean;
  onStart?: () => void;
  onComplete?: (duration: number) => void;
  onError?: (error: Error) => void;
  onOverlap?: () => void;
}

export interface JobInfo {
  name: string;
  schedule: string;
  timezone?: string;
  running: boolean;
  lastRunAt: Date | null;
  lastDuration: number | null;
  lastError: Error | null;
  runCount: number;
  nextRuns: (count?: number) => Date[];
}

export interface Scheduler {
  addJob(config: JobConfig): void;
  updateJob(name: string, updates: Partial<Omit<JobConfig, 'name'>>): void;
  removeJob(name: string): void;
  getJob(name: string): JobInfo;
  getJobs(): JobInfo[];
  start(): void;
  stop(): void;
  shutdown(): Promise<void>;
}
