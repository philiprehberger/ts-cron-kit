import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { createScheduler, parseCronExpression, matchesCron, nextRuns } = await import('../../dist/index.js');

describe('parseCronExpression', () => {
  it('parses wildcard expression', () => {
    const cron = parseCronExpression('* * * * *');
    assert.equal(cron.minute.type, 'wildcard');
    assert.equal(cron.minute.values.length, 60);
    assert.equal(cron.hour.values.length, 24);
  });

  it('parses specific values', () => {
    const cron = parseCronExpression('0 9 15 6 3');
    assert.deepEqual(cron.minute.values, [0]);
    assert.deepEqual(cron.hour.values, [9]);
    assert.deepEqual(cron.dayOfMonth.values, [15]);
    assert.deepEqual(cron.month.values, [6]);
    assert.deepEqual(cron.dayOfWeek.values, [3]);
  });

  it('parses ranges', () => {
    const cron = parseCronExpression('0 9 * * 1-5');
    assert.deepEqual(cron.dayOfWeek.values, [1, 2, 3, 4, 5]);
    assert.equal(cron.dayOfWeek.type, 'range');
  });

  it('parses steps', () => {
    const cron = parseCronExpression('*/5 * * * *');
    assert.deepEqual(cron.minute.values, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    assert.equal(cron.minute.type, 'step');
  });

  it('parses lists', () => {
    const cron = parseCronExpression('0 9,12,18 * * *');
    assert.deepEqual(cron.hour.values, [9, 12, 18]);
    assert.equal(cron.hour.type, 'list');
  });

  it('parses step with range', () => {
    const cron = parseCronExpression('0-30/10 * * * *');
    assert.deepEqual(cron.minute.values, [0, 10, 20, 30]);
  });

  it('throws on invalid field count', () => {
    assert.throws(() => parseCronExpression('* * *'), /expected 5 fields/);
  });

  it('throws on invalid value', () => {
    assert.throws(() => parseCronExpression('60 * * * *'), /Invalid value/);
  });

  it('throws on invalid range', () => {
    assert.throws(() => parseCronExpression('5-3 * * * *'), /Invalid range/);
  });

  it('throws on invalid step', () => {
    assert.throws(() => parseCronExpression('*/0 * * * *'), /Invalid step/);
  });
});

describe('matchesCron', () => {
  it('matches wildcard against any date', () => {
    const cron = parseCronExpression('* * * * *');
    assert.equal(matchesCron(cron, new Date(2026, 0, 1, 12, 30)), true);
  });

  it('matches specific minute and hour', () => {
    const cron = parseCronExpression('30 9 * * *');
    assert.equal(matchesCron(cron, new Date(2026, 0, 1, 9, 30)), true);
    assert.equal(matchesCron(cron, new Date(2026, 0, 1, 9, 31)), false);
  });

  it('matches day of week', () => {
    // 2026-03-09 is a Monday (day 1)
    const cron = parseCronExpression('0 9 * * 1');
    assert.equal(matchesCron(cron, new Date(2026, 2, 9, 9, 0)), true);
    assert.equal(matchesCron(cron, new Date(2026, 2, 10, 9, 0)), false);
  });
});

describe('nextRuns', () => {
  it('returns requested number of dates', () => {
    const runs = nextRuns('* * * * *', 3);
    assert.equal(runs.length, 3);
  });

  it('returns dates in the future', () => {
    const runs = nextRuns('* * * * *', 1);
    assert.ok(runs[0] > new Date());
  });

  it('returns correct count for hourly job', () => {
    const runs = nextRuns('0 * * * *', 5);
    assert.equal(runs.length, 5);
    for (const run of runs) {
      assert.equal(run.getMinutes(), 0);
    }
  });
});

describe('createScheduler', () => {
  it('adds and retrieves a job', () => {
    const scheduler = createScheduler();
    scheduler.addJob({ name: 'test', schedule: '* * * * *', handler: () => {} });
    const job = scheduler.getJob('test');
    assert.equal(job.name, 'test');
    assert.equal(job.running, false);
    assert.equal(job.runCount, 0);
    assert.equal(job.lastRunAt, null);
  });

  it('throws on duplicate job name', () => {
    const scheduler = createScheduler();
    scheduler.addJob({ name: 'test', schedule: '* * * * *', handler: () => {} });
    assert.throws(() => {
      scheduler.addJob({ name: 'test', schedule: '* * * * *', handler: () => {} });
    }, /already exists/);
  });

  it('removes a job', () => {
    const scheduler = createScheduler();
    scheduler.addJob({ name: 'test', schedule: '* * * * *', handler: () => {} });
    scheduler.removeJob('test');
    assert.throws(() => scheduler.getJob('test'), /not found/);
  });

  it('throws when removing non-existent job', () => {
    const scheduler = createScheduler();
    assert.throws(() => scheduler.removeJob('nope'), /not found/);
  });

  it('lists all jobs', () => {
    const scheduler = createScheduler();
    scheduler.addJob({ name: 'a', schedule: '* * * * *', handler: () => {} });
    scheduler.addJob({ name: 'b', schedule: '0 * * * *', handler: () => {} });
    const jobs = scheduler.getJobs();
    assert.equal(jobs.length, 2);
  });

  it('start and stop without error', () => {
    const scheduler = createScheduler();
    scheduler.addJob({ name: 'test', schedule: '* * * * *', handler: () => {} });
    scheduler.start();
    scheduler.stop();
  });

  it('shutdown resolves immediately when no jobs running', async () => {
    const scheduler = createScheduler();
    scheduler.addJob({ name: 'test', schedule: '* * * * *', handler: () => {} });
    scheduler.start();
    await scheduler.shutdown();
  });

  it('job info has nextRuns function', () => {
    const scheduler = createScheduler();
    scheduler.addJob({ name: 'test', schedule: '0 9 * * *', handler: () => {} });
    const job = scheduler.getJob('test');
    const runs = job.nextRuns(3);
    assert.equal(runs.length, 3);
  });
});
