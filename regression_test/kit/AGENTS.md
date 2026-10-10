# Project Kit development

kit/SKILL.md tells agents how to write project-owned Kits with what Trace executes today: ctx.step, the environment adapter, cleanup(ctx), META.locks, ctx.resources. Trace owns no selectors, project actions or data models; a Kit is the project's code. Keep Kit-specific behavior out of the worker.

Today a project composes its Kit through a forwarding case entry (setup/finish) and an environment.adapter entry. Planned Trace support, not task-facing until implemented and verified:

- index `kit: {use: <registered platform Kit>, project: <project Kit path>}` and a local `kit-register <name> <dir>`, replacing the forwarding files;
- injected ctx.kit, ctx.data and ctx.flow, so cases stop importing setup;
- data lifecycle hooks: Trace generates the marker, calls data.bind before run and data.cleanup after it, records the cleanup report beside the result; after a timeout or cancellation it starts a separate process and calls data.cleanup with the same marker;
- teardown hook, called before data cleanup in the worker; after a timeout Trace closes the tab instead;
- `kit prepare` for shared fixtures, writing bindings to the ignored environment profile;
- `kit check`: manifest against implementation, flow covers against the registry;
- Kit file digests in run records, so results from an older Kit are recognizable;
- browser profile queueing: wait (bounded, recorded) when another Run holds the profile instead of failing at once;
- GUI rendering of step info and depth.

The cleanup report fields (complete, removed, restored, retained, remaining, reason) are defined in kit/SKILL.md because the GUI will render them; keep them stable.

2026-10-10 evidence behind the run-cost, concurrency and documentation rules: two agents generating suites at once on one browser profile, one blocked for five consecutive repair rounds by the other's full run; a deployment check of about five seconds repeated before each of 70 cases doubled the Run (319 s of scripts, 618 s of Run) and its one transient failure was reported only as an exit code; 65 of 70 cases declared an exclusive account lock because the generation guide counted every list assertion as account-wide; project Kits reimplemented created-session IDs, preference restore and parameter-matched response waits that the platform layer should provide; case authors read Kit source to learn layer composition, required flow descriptions and returned object fields; a guide described --timeoutMs as per Run.

2026-10-10 scope review against the existing design: environment adapter and REQUIREMENTS, shared fixture preparation, lock semantics, request-specific waits, distinct identities, profile ownership, per-case timeouts and scoped reruns were already specified in design.md and the environment/execution skills. kit/SKILL.md links to them and adds only Kit structure, data and cleanup reports, check cost, operation rules and lock choice. The earlier field failures came from a platform guide restating run options incorrectly, not from missing Trace guidance; Kit documentation therefore links to execution instead of restating it. L1 anchors follow design.md: registered entry targets and regions, data-test-target, or markers the UI renders from its own declarations; no Kit-owned selector map.

Platform layering (for example Omni's platform and application layers) is that platform's design and lives in its own Kit documentation. The generic contract only covers extending a shared Kit and requires the shared Kit to document its composition.
