# Capability development

Keep consumer procedures in SKILL.md. Record implementation decisions and invariants here. Business cases and output data remain in the target repository.

2026-10-07 Colab full-suite practice: structured functional assertions use Node isDeepStrictEqual. Strict object identity would reject independently read receipts even when every value matches. Preserve actual/expected snapshots, and keep unequal nested values non-green. Project adapters own selectors, API contracts, resource preparation and isolation; do not move those into the generic worker.

Full-suite reruns exposed two project-script defects: persistent mutation of a common Canvas fixture, and selecting file text that matched both a tree item and a breadcrumb. Consumer guidance now requires repeatable fixture cleanup and request-specific readiness. Keep selectors and fixture repositories in the project; generic tooling only supplies lifecycle/assertion interfaces.

2026-10-08 trajectory audit: bounded scheduler defaults to exclusive execution for undeclared cases. Reviewed cases opt in; locks and the implicit browser lock prevent shared-state races. Worker input/output filenames are case-specific and cancellation terminates every active process group. Keep fixture preparation in the project, never in generic scheduling.

Browser concurrency boundary: the Run owns Chrome, its profile lock and the default context. Workers receive independently leased tabs over CDP. Auxiliary pages are allocated by the parent through IPC, so an abrupt worker exit cannot orphan a second-client page. Per-case finally closes its whole lease, including auxiliary tabs; Run finalization closes remaining leases and waits for an owned Chrome process to exit. Never use newContext for routine parallelism: headed Chrome creates extra windows. Shared cookies/localStorage alone do not justify serializing cases. Require evidence of actual contention before declaring a named resource lock; a solo rerun passing does not establish causality. Maturity does not determine scheduling.

2026-10-09 project helper steps: ctx.step(name,{info},fn) exposes the same step recorder used by action/observe/command, so project-owned helper libraries (Kits) record their own operations instead of acting on ctx.page invisibly. Steps nest (depth on inner rows); info must be a JSON object and credential-like keys are redacted. The worker still owns no selectors or project actions; what a step does is the project's code.
