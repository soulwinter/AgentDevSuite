---
name: trace-regression-kit
description: Write or extend a project Kit, the shared operations, environment checks, test data, flows and cleanup that regression cases call, so each case states only actions and expectations.
---

A Kit is project-owned code next to the cases. It holds how to act in this project: locating controls, waiting for readiness, creating and reading back data, cleaning up. Cases call it and only state what to do and what to expect. Without a Kit, cases either use ctx.action (recorded, but only click and fill) or drive ctx.page directly (invisible in the record, a failure shows one timeout). Write the Kit once per project, or once per platform shared by all its projects.

Agents write the Kit and then write cases from its documentation. Four rules keep both stable: anchors come from the project's own declarations, never guesses; the data model is derived from existing declarations (migrations, schemas, interface descriptions), never a parallel copy; an operation's name is a promise it verifies; a case author must not need to read Kit source.

## Shape

One module exports a literal `KIT` manifest and any of `operations(ctx, base)`, `environment {resolve, check}`, `data {bind, cleanup}`, `flows`, `teardown(ctx)`. Omit what the project does not need. A Kit is not limited to web UI: an operation can run a command, call an interface, control a process or cut a network link, as long as it is recorded with ctx.step.

## Connect it to Trace

Trace runs the case's `run(ctx)` and optional `cleanup(ctx)`; it does not load a Kit itself. Add two forwarding files beside the index and keep logic out of them:

- a case entry exporting `setup(ctx)` and `finish(ctx)`. setup composes the layers, derives the case marker from `ctx.runId` and `ctx.caseId` (so another process can rebuild it), binds data and flows, and returns `{kit, data, flow}`. finish runs teardown, then data cleanup, and records the cleanup report as a step;
- an `environment.adapter` entry re-exporting the Kit's `resolve` and `check` (see [environment](../environment/SKILL.md)).

```js
import {setup, finish} from '../../kit-entry.mjs';
export async function run(ctx) {
  const {kit, data, flow} = await setup(ctx);
  const {saved, id} = await flow('task.create', {title: data.title('weekly'), priority: 'high'});
  ctx.assert('[Expected 1] saved', saved.status, 200);
  ctx.assert('[Expected 2] priority read back', (await data.task.row(id)).priority, 'high');
}
export async function cleanup(ctx) { await finish(ctx); }
```

A timeout or cancellation terminates the worker before cleanup(ctx) runs. Cleanup must therefore work from the marker and resources alone, and anything it needs from the case (for example created keys) must already be on disk.

## Layers

A platform Kit may have layers, each knowing only the one below: a platform layer (shell, navigation, generic reads and clicks, request waits, fault injection), an optional application layer (views, fields, tables, interface calls, deployment checks, data), then the project Kit (business flows, data declarations, few private operations). The project selects its base with `KIT.extends`; a project testing the platform itself extends the platform layer directly.

Compose and document these rules:

| Part | Composition |
|---|---|
| operations | bottom-up; each layer receives the merged lower operations as `base` and returns base plus its own. A higher name wins; an override calls the base operation rather than rewriting it |
| KIT.operations | merged like operations; each operation is declared in its own layer |
| data | the highest layer exporting `data`; platform hooks receive the project module, so the project only declares entities |
| flows | merged, higher layer wins; each layer's manifest and implementations are validated separately |
| teardown | every layer's teardown, project first, then the items operations registered, last first |
| environment | the highest layer's; requirements it does not know go to the layer below; unknown everywhere blocks |

Promote what is not business-specific. If replacing the app, view and interface names leaves a function useful, it belongs in a lower layer. Two projects writing the same helper is proof.

## Manifest

`KIT` is a literal so tools can read it without executing code: `name`, `extends`, `operations: {<name>: {kind, anchor?, description?}}`, `flows: {<name>: {description, covers}}`. Common kinds are navigate, act, observe, wait, api and command; a Kit may add its own such as inject. `anchor` is the weakest locator tier the operation relies on. `description` states what the operation or flow returns, because case authors assert on it. Enforce at load time and document:

1. every flow has a description;
2. `KIT.flows` and exported `flows` match one to one;
3. an operation missing from its layer's `KIT.operations` fails when called;
4. `covers` is an array of registered operation IDs.

## Operations

Wrap every operation in `ctx.step(name, info, fn)` with a name a user understands. info is JSON evidence; Trace reads `kind` for grouping and `operation` (the registered operation ID) for coverage, and redacts credential-like keys. Steps nest. An action outside ctx.step does not appear in the record.

For UI operations:

1. Choose anchors by tier: L1 markers rendered from project declarations (data-field, data-trace-target, interface paths, landmark labels); L2 role and name inside an L1 scope; L3 text inside an L1 scope. Never CSS classes, element order or page-wide text.
2. Give regions their own markers (tab bar, view actions, results) so equal labels in different regions stay distinct.
3. Reads and clicks require exactly one match; fail and ask for a narrower scope instead of taking the first.
4. Wait for conditions (a response, an element, a run state), never fixed sleeps or network idle.
5. Wait for the request the action triggered. Matching only the interface name can catch the previous page or filter's response; let waits match request parameters and have the case pass the expected ones.
6. Generic reads do not imply semantic roles: an editable region is not necessarily a textbox, a header not a banner. Offer a role-based operation when a role is asserted.

For every operation:

1. The name is a promise. Verify the promised outcome and fail otherwise; never swallow a wait failure. If it cannot be verified, do not promise it.
2. Return the IDs of what it created (sessions, tabs, files, processes) and register their release for teardown; counts are not enough for a case that must act only on its own resources.
3. Before changing shared state (preferences, local storage, account settings), save the original and register a teardown item that restores it and reads it back.
4. Cache keys contain every input that changes the verdict: address, identity, model, version. Cache failures for less time than successes.
5. Document the fields of every returned object.

Commands, interfaces, processes and network controls record the command name, path or target in info. Use `ctx.command(..., {capture: false})` when output may contain secrets or private content.

## Environment

The adapter contract is in [environment](../environment/SKILL.md). A Kit's checks cover: the running version is the current source (otherwise failures are misattributed); external services a case declares in REQUIREMENTS (agents, models, third-party APIs) are usable; required identities exist (bind references in the ignored profile, never credentials; a second user is a second identity, not a second device); unknown requirements block.

check runs before every case. Its cost multiplies by the case count:

1. Cache expensive checks on every input that decides the verdict (for a deployment: app, environment, bundle hash, deployed commit, source commit) for a few minutes, in a temp file other processes can read.
2. Retry a transient failure (timeout, indeterminate status) once before blocking. Do not retry a definite mismatch.
3. Make the reason specific: what was checked, exit code and the last output lines, expected and actual versions.
4. Leave no side effects. If the underlying command writes receipts, caching is mandatory.

## Data

`data.bind({ctx, kit, marker, resources})` returns the case's `data` object, shaped by the project: marked text for UI input (`data.title(suffix)`), create, read back, query, before/after comparison, other-owner records. `data.cleanup({marker, resources})` removes or restores this marker's data, recounts, and returns a report:

| Field | Meaning |
|---|---|
| complete | everything except intentionally retained data is handled and recounted |
| removed | per entity, deleted, withdrawn or archived |
| restored | per entity, shared data returned to its original state |
| retained | per entity, kept on purpose, with the reason |
| remaining | per entity, still present though it should not be; required when complete is false |
| reason | why cleanup is incomplete, such as no administrative connection |

Report incomplete cleanup as complete: false, never as cleaned; a hook that throws is a cleanup error. Neither changes the case verdict.

- Every record a case creates, including through the UI, must be findable by the marker.
- Separate the application channel (the test user through the project's interfaces) from an administrative channel (direct storage access for exact read-back, other-owner records and deletion). Without the administrative channel, declare a marker count per entity (for example a list interface searching the marker) so cleanup can report the real residue; never report complete without counting zero.
- Without a writable marker column, mark through a marked parent; otherwise record created keys on disk and delete by key.
- Choose removal by nature: delete or withdraw what the case created, restore what it changed (restored), keep evidence on purpose (retained).

## Shared fixtures

Data many read cases share (a channel with known messages, a fixed file, more than one page of rows) is prepared by a script outside the run. It checks existing bindings, repairs or recreates only what is missing or stale, never deletes, and writes bindings to the ignored environment profile; the adapter exposes them and cases declare them in REQUIREMENTS. Cases that need fresh data (create, empty state, withdrawal) make their own. Do not top up shared data from a flow on every run.

## Flows

Steps shared by two or more cases become a flow. Flows call only `kit` and `data`, run as one step with their operations nested, and return what their description says. Steps used by one case stay in that case.

## Teardown

Release non-data resources here: fault injection routes, sessions, listeners, extra tabs, changed preferences. It runs after the case and before data cleanup, so an active fault injection cannot intercept cleanup requests. Undo registered items in reverse, record each as a step, continue past a failing item and rethrow the first error.

## Concurrency and runs

Declare `META.locks` by what the assertions need to stay stable, not by whether the case writes:

| Case | Locks |
|---|---|
| reads and writes only its own marked data and asserts only on it, with no aggregate-asserting cases in the project | `[]` |
| the same, when other cases assert account-wide aggregates | `["read:account"]` (shared with other such cases) |
| asserts account-wide aggregates: totals, unfiltered lists, no additional records | `["write:account"]` |
| changes account-wide settings or preferences | `["write:account"]`, and restore them |

Treating every list assertion as account-wide serializes the whole suite; a list filtered by the case marker is not affected by other cases.

One browser profile serves one Run at a time; a second Run on it fails immediately. Run projects one after another, or give each index its own browser profileDir and sign in to each once. `--timeoutMs` is per case; keep Kit waits well below it so a slow step reports what it waited for. After repairing a case, rerun it with `--ids` before the full suite.

## Documentation

The Kit README is what case authors read. Include: a minimal project Kit for each layer, including one extending the lowest layer, and the forwarding files; the composition rules; each operation's signature, return fields, and what it verifies or does not; the manifest rules; locks, profile and timeout rules; supported REQUIREMENTS, what each checks and how long it is cached. Describe parameters as the runtime behaves; change both together. Put any rule that can be checked into load-time validation as well as the README.

## Verify

1. Manifest validation passes.
2. A platform Kit has fixture tests on local mock pages covering each operation kind, independent of real environments.
3. One real-environment case uses every new operation and flow; inspect each recorded step, read-back value and the cleanup report. With an administrative connection, expect complete: true; without one, expect the real residue; retained data names its reason.
4. Running the fixture script twice changes nothing the second time.
5. Compare the sum of case script durations with the Run's duration; a large gap means check, queueing or lock overhead.
6. Look for business-independent helpers in project Kits and promote them.
7. Have an agent without context write a few cases from the documentation alone; what it had to read in source or guessed wrong is a documentation gap.
