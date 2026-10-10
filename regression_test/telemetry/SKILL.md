---
name: trace-regression-performance
description: Capture registered operation traces, record end-to-end performance and assert explicit budgets during regression.
---

Reuse the project's tracing registry and provider configuration. Configure regression `telemetry.queryConfigParameter` or `queryConfigEnvironment`; credentials remain in the existing private Trace configuration. Supply legacy attribute mappings only when the project differs from `trace.operation.id` / `trace.outcome`. The registered terminal operation span is the entrance-to-return interval; children are diagnostic breakdowns.

GUI traceparent IDs are captured automatically from page requests. When the host page's own instrumentation rewrites traceparent (so captured IDs belong to the host, not the project), set `telemetry.guiTraceparent: false` and have project code report the trace IDs its operations started with `ctx.traceRef(traceId)`; collection treats them the same. For command entry points, configure the project's existing propagation environment variable with `commandTraceparentEnvironment` and restrict it through `commandPathPrefix`. Source scripts must have the same SDK dependencies as their deployed artifact; bind required runtime environment through `commandEnvironmentParameters` in the private project environment.

Declare budgets with `await ctx.performance(name,{entryId,maximumMs})`. Checks resolve after execution against captured trace samples, not local timers. Missing matching evidence is blocked/inconclusive. Without an explicit budget, record observations without inventing a quality gate.

Case results preserve entry IDs, Trace IDs, root durations, completion phase, Grafana links and source/span breakdowns. Each list cell shows one P90 pooled across all registered end-to-end operation samples in that case result. The drawer retains per-entry samples. Performance budgets remain scoped to their declared entry. Do not pool different rounds, nested spans or unrelated production-window samples. Inspect telemetryDiagnostics when evidence is unavailable. Existing runs lacking IDs cannot be reliably backfilled by time-window searches.
