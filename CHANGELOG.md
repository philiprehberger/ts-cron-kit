# Changelog

## 0.3.3

- Add Development section to README
- Fix CI badge to reference publish.yml

## 0.3.0

- Fix day-of-month / day-of-week OR logic: when both fields are restricted, the job now runs when either matches (standard cron behavior)
- Improve tick deduplication key to use a readable string format instead of a numeric composite
- Add `updateJob()` method to modify a job's schedule, handler, or other options in-place

## 0.2.3

- Fix npm package name references in README

## 0.2.2

- Fix npm package name (restore original name without ts- prefix)

## 0.2.1

- Update repository URLs to new ts-prefixed GitHub repo

## 0.2.0

- Add comprehensive test suite (24 tests covering cron parsing, matching, nextRuns, scheduler lifecycle)
- Add CI workflow for push/PR testing
- Add test step to publish workflow
- Document 30-second tick interval precision in source and README
- Add API reference tables and limitations section to README

## 0.1.0
- Initial release
