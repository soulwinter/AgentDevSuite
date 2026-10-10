---
name: trace-regression-execution
description: Implement regression script steps, functional assertions and explicit timing checks.
---

For selecting and running cases, use [Run regression](../SKILL.md#run-regression).

Scripts use ctx.page, ctx.action(name,{target,action,value}), ctx.observe(name,{target,read}), ctx.assert(name,actual,expected), ctx.command(name,executable,args,{input,capture}), ctx.measure(name,fn,{maximumMs}), ctx.screenshot(name), ctx.step(name,{info},fn), ctx.traceRef(traceId) and ctx.block(reason). Wrap each project helper operation (open a view, choose an option, wait for a response) in ctx.step so the record shows which step ran and which one failed; info is JSON evidence such as the anchor or registered operation ID. Steps may nest. How to organize those helpers as a project Kit is in [kit/SKILL.md](../kit/SKILL.md). Optional cleanup(ctx) runs after success or failure. Give operations and assertions meaningful names. Create case-owned fixtures or restore shared fixtures in finally/cleanup so a second run starts with the same preconditions. Await request-specific committed results and UI readiness before asserting.

Configure GUI baseUrl, unique readiness selector, named targets, browser profile and prerequisite flags in the project index. Use one business landmark for readiness; broad selectors matching several controls fail strict locator resolution. A dedicated Chrome profile needs its initial login. Keep cookie handling and browser lifecycle out of case scripts.

measure includes the explicitly measured runner scope and its overhead. For provider timing use ctx.performance(name,{traceId,maximumMs}) with a configured project telemetryAdapter exporting performance(args) and real durationMs. Missing telemetry blocks the assertion; do not substitute runner timing for provider spans. Keep secrets out of assertions, command arguments and screenshots.

## Selection and execution options

Discover cases with `cases` and available metadata values with `filter_options`. Select the smallest useful scope, then call `plan` before `run` with exactly the same filters. Check selected cases, exclusion reasons and discovery diagnostics; fix diagnostics before execution.

Use `--meta '<JSON object>'` to select metadata: for example `{"module":["channels"],"surface":["gui","skill"],"priority":["critical"],"effects":["read-only"]}`. Different fields are combined with AND; values within one field use OR. Array fields such as covers, requires and affectedPaths match any selected member. Every registered metadata field can be selected; unknown keys are errors. `filter_options` returns the project's actual fields and values, also used by the GUI.

Choose `--profile full|release|change`: full uses all matching trial and active cases; release uses critical cases plus explicitly changed modules; change requires `--changedModules <comma-separated modules>` or explicit IDs. `--ids <comma-separated IDs>`, `--modules <modules>` and `--surface <entry>` remain available. Explicit IDs select those cases instead of the profile's default priority/impact scope; other filters still apply.

Trial and active cases run by default. Validate a rotten case only with explicit `--ids` or `meta.id`, together with `--validateInactive true`. Obsolete cases stay excluded. External writes remain blocked unless explicitly authorized with `--allowExternalWrites true`; metadata selection alone never grants permission to write. Optional `--timeoutMs` sets the per-case timeout and `--name` labels the regression.

Standalone CLI `run` waits and exits nonzero for failures, errors, blockers or cancellation. To use the running GUI service, add `--server http://127.0.0.1:<port>`; then `run` returns an ID. Poll `record --id <run-id>` and cancel through that same server with `cancel --id <run-id>`. Interrupt a standalone CLI process to cancel it. MCP equivalents are regression_filter_options, regression_plan, regression_run, regression_record and regression_cancel, with the same filters in args.

Analyze `record --id <run-id> --problems`, report expected/actual evidence and performance boundaries, and preserve failed runs. Diagnose product defects separately from script rot or removed features; do not change case lifecycle merely to make a regression green.

Use command input for stdin data. Set capture:false when output contains capabilities or private prompts; avoid recording those values in assertions or command arguments.

Before writing assertions, inspect the actual public response and the owning interface contract. Use committed resource IDs to scope GUI assertions; quoted text and navigation labels are not proof of the intended result. For asynchronous publication, verify eventual restored bytes during cleanup. Cross-member scenarios require distinct authenticated identities; a second device of the same owner proves only cross-device behavior. Diagnose unavailable prerequisites separately from product assertions.

Verify the running artifact version and response schema when they differ from repository source. Diagnose a failed GUI mutation from its actual HTTP response and failure screenshot before retrying it. Interrupt standalone CLI runs normally so the runner releases its worker and browser profile; do not terminate only the parent process.

## Efficient scoped execution

Use `cases --meta '{"module":["<path>"]}'` to discover the affected cases, then `plan --selectedOnly true` with that selection. Routine changes use explicit IDs or changed modules; release/installation and diagnostics suites run when those boundaries change. Keep existing failure evidence and rerun only repaired or newly affected cases in the same Run.

Use `--concurrency 2` (1–8) to run independent cases together. Declare literal `META.locks` for shared resources, e.g. `["read:account", "write:shared-document"]`. Readers may overlap; a writer excludes readers and writers of the same resource. Plain lock names retain exclusive semantics. An explicit empty list means the case uses only owned resources. Missing declarations use a conservative exclusive fallback; trial/active maturity does not affect scheduling. The Run owns one browser and leases independent tabs and browser storage contexts; scripts simply use `ctx.page`. Declare OS clipboard/focus/native-dialog dependencies explicitly. Plan, run, GUI and agent prompts use the same concurrency option.

When implementing read cases, prepare representative data and expose its resource IDs, expected contents and client bindings through the project environment adapter. Scripts consume ctx.resources and ctx.parameters. Fixture preparation checks existing bindings and repairs missing/stale data; it can also prepare a fresh dataset when the scenario needs one. Creation, mutation, withdrawal and empty-state cases bind or create their own targets. Validate image fixtures by decoding them; wait for the completed submit state before reusing a composer; reveal hover controls before clicking; assert the whole intended UI region rather than a convenient child.

The Run owns one Chrome window and allocates one tab per GUI case. Project multi-client adapters use `ctx.newPage()` for auxiliary tabs; the Run closes all allocated tabs after each case, including failures and cancellation. Do not create browser contexts or manage Chrome in case scripts. Do not lock ordinary GUI cases merely because tabs share a browser. Declare a specific lock only for demonstrated contention on a named shared resource.

Provider performance adapters must return `boundary: "operation-end-to-end"`, `entryId`, `traceId`, and `durationMs` for the operation entrance-to-completion interval. Do not return individual child span duration, sum spans, or measure min/max timestamps across unrelated asynchronous work. Span durations remain diagnostic breakdowns. The list shows one P90 across all registered operation samples in a case result; the drawer preserves individual samples.

## Registered trace performance in regressions

Configure `telemetry.queryConfigParameter` (a private provider-config file path supplied by the project environment) or `queryConfigEnvironment` (defaults to TRACE_CONFIG). The runner captures GUI request traceparent IDs, and can propagate command context using `commandTraceparentEnvironment` with a project `commandPathPrefix`. It queries those exact executions through the existing Trace analysis layer and stores registered terminal operation samples and span breakdowns in the case record. No global time-window fallback is used. For source scripts, declare required runtime dependencies through `commandEnvironmentParameters` and project environment bindings; never vendor the Trace skill into the project.

Use `await ctx.performance("<budget name>", {entryId:"<registered operation>", maximumMs:<explicit budget>})`. It declares a check evaluated against collected samples after execution; missing trace evidence is inconclusive/blocked, never a pass. Registered entry roots provide entrance-to-return duration; layers are diagnostics. Repeated samples for the same entry in the same case result produce P90; single samples retain their value. The list uses a pooled case P90; assertions use only the declared entry. Both use `record_store/performance.mjs`. Never combine different rounds, child spans or runner timers. Existing runs without captured Trace IDs cannot be reliably backfilled by searching a time window.
