---
name: trace-regression-test
description: Author project-owned regression cases, select them by metadata, run tests and investigate recorded failures.
---

Resolve the target repository. Its `regression_test/regression.config.yaml` registers case directories and the run directory. Use `sh <trace-skill>/setup/run.sh regression_test/cli.mjs <action> --repo <repo> [--index <relative-index>]`. For first use, run `init`; it installs the registry, case-only example and project instructions without replacing existing cases or settings; for missing dependencies, read [../setup/SKILL.md](../setup/SKILL.md), then run `doctor`.

Load only the instructions needed:

- Author, discover or classify cases: [cases/SKILL.md](cases/SKILL.md).
- Configure resources and investigate environment blockers: [environment/SKILL.md](environment/SKILL.md).
- Implement executable steps and assertions: [execution/SKILL.md](execution/SKILL.md).
- Write or extend the project Kit that cases share (operations, environment checks, test data, flows, cleanup): [kit/SKILL.md](kit/SKILL.md).
- Investigate regression records: [record_store/SKILL.md](record_store/SKILL.md).

## Run regression

Preview with `plan`, then execute `run` using the same arguments. Inspect `record --id <run-id> --problems` and report failures or blockers. Preserve the original results.

## Selection and execution options

For metadata filters, execution modes or cancellation, read [execution/SKILL.md](execution/SKILL.md#selection-and-execution-options).

For registered operation performance capture and budgets, load [Trace performance](telemetry/SKILL.md).
