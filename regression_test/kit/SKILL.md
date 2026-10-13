---
name: trace-regression-kit
description: Write or extend a project Kit, the primitives, registered-operation execution, data, flows and cleanup that regression cases call, so each case states only actions and expectations.
---

A Kit is project-owned helper code beside the cases (outside the case directories, or in underscore-prefixed paths that discovery skips). It holds how to act in this project: locating controls, waiting for readiness, creating and reading back data, cleaning up. Cases call it and only state what to do and what to expect. When registered targets and `ctx.action`/`ctx.observe` cover a project's cases, it needs no Kit. Write one when cases would otherwise drive `ctx.page` directly, which leaves no record of what ran. Write it once per project, or once per platform and share it.

This skill adds Kit structure to the existing contracts; it does not replace them. Case metadata and lifecycle: [cases](../cases/SKILL.md). Adapter, REQUIREMENTS and identities: [environment](../environment/SKILL.md). ctx API, waits, shared fixtures, locks, timeouts and scoped reruns: [execution](../execution/SKILL.md). Registered targets and regions: [locator](../../instrumentation/locator/SKILL.md).

Agents write the Kit and then write cases from its documentation. Four rules keep both stable: anchors come from the project's registry and declarations, never guesses; the data model is derived from existing declarations (migrations, schemas, interface descriptions), never a parallel copy; an operation's name is a promise it verifies; a case author must not need to read Kit source.

## Shape and connection

One module exports a literal `KIT` manifest and any of `operations(ctx, base)`, `environment {resolve, check}`, `data {bind, cleanup}`, `flows`, `teardown(ctx)`. Omit what the project does not need. Operations are not limited to web UI: running a command, calling an interface, controlling a process or cutting a network link are operations too.

Trace runs the case's `run(ctx)` and optional `cleanup(ctx)`; it does not load a Kit itself. Add two forwarding files beside the index and keep logic out of them:

- a case entry exporting `setup(ctx)` and `finish(ctx)`. setup composes the project Kit with any Kit it extends, derives the case marker from `ctx.runId` and `ctx.caseId` (another process can rebuild it), binds data and flows, and returns `{kit, data, flow}`. finish runs teardown, then data cleanup, and records the cleanup report as a step;
- the `environment.adapter` entry, re-exporting the Kit's `resolve` and `check`.

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

A timeout or cancellation terminates the worker before cleanup(ctx) runs. Cleanup must work from the marker and resources alone; anything it needs from the case, such as created keys, must already be on disk.

## Building on a shared Kit

Projects on one platform can share a Kit and add only their own part. The project names its base with `KIT.extends`. The shared Kit owns the composition and must document it: how its operations reach the project as `base` and whether a project operation may override one (an override calls the base operation rather than rewriting it), which Kit implements data, environment and teardown, and in what order teardown runs. How a platform divides its shared Kit is that platform's design, not part of this contract.

Promote what is not business-specific. If replacing the app, view and interface names leaves a function useful, it belongs in the shared Kit. Two projects writing the same helper is proof.

## Primitives, registered operations and flows

A Kit defines no business actions of its own. Every action has exactly one name, from one of three kinds:

| Kind | Defined by | Named by | Example |
|---|---|---|---|
| Primitive | the Kit, shared by all projects on the platform | the mechanism | open a view, set a field, click, wait for a response, read a cell, inject a fault |
| Registered operation | the project's operation registry (`tracing/registry.yaml` and its unit registries) | the registry ID | `tasks-create.submit` |
| Flow | the project Kit | the test intent | `task.create` |

The registry is the only list of user actions. It is derived from the project's source and reviewed by an agent, and the same IDs key coverage, performance spans and GUI location. The Kit executes any registered operation through one primitive, `perform(id, inputs, options)`: it locates the control from the registry entry, acts with primitives, waits for the completion the entry declares (the calls the control makes, the view it navigates to) and records one step whose `operation` is the ID. A project Kit never wraps a registered control under another name and never maps labels to IDs. When `perform` cannot execute an entry (no anchor, no observable completion), fix the registry or its derivation; do not add a Kit action. An entry whose completion the page cannot observe is refused by `perform` and covered by a dedicated primitive that reports what it can verify.

A registered operation is not composed from primitives in the registry; its execution is. The registry says what the user can do and what completes it; primitives say how a test does it. An entry stays a candidate until it has been performed successfully at least once.

Primitives cover what the registry does not describe: field values (inputs to `perform` or `setField`), reads and assertions, data, faults, environment, teardown. Flows compose `perform` calls and primitives with parameters; their coverage is the `operation` IDs their steps recorded, not a declared list.

## Manifest

`KIT` is a literal so tools can read it without executing code: `name`, `extends`, `operations: {<name>: {kind, anchor?, description?}}` for primitives (in a project Kit, only reads the shared Kit lacks), and `flows: {<name>: {description}}`. Common kinds are navigate, act, observe, wait, api and command; a Kit may add its own such as inject. `anchor` is the weakest tier the primitive relies on. `description` states what the primitive or flow returns, because case authors assert on it. Enforce at load time (each Kit's own manifest when one extends another), and document:

1. every flow has a description;
2. `KIT.flows` and exported `flows` match one to one;
3. a primitive missing from its own Kit's `KIT.operations` fails when called;
4. `perform` accepts only IDs present in the registry.

## Primitives

Wrap every primitive in `ctx.step(name, info, fn)` with a name a user understands. info is JSON evidence; `perform` puts the registered ID in `operation`, so the record shows actual coverage.

Anchors, weakest tier recorded in the manifest:

- L1: markers the registry or the project's own declarations put in the page. Registered GUI entries use `entry.target` (`data-trace-target`) and result regions `data-trace-region`; assertion-only elements use `data-test-target`. A UI that renders markers from its own declarations (for example field names from a schema) is L1 when the Kit reads those declarations instead of copying names. Interface paths are L1 for waits.
- L2: role and accessible name inside an L1 scope.
- L3: text inside an L1 scope.

Never CSS classes, element order or page-wide text, and never a Kit-owned selector map that duplicates the registry. When a control the cases need has no marker, add it to the registry and the UI. Give each region (tab bar, view actions, results) its own marker so equal labels in different regions stay distinct. Reads and clicks require exactly one match. Fail and ask for a narrower scope rather than taking the first.

Rules for every primitive and for `perform`, in addition to the waiting rules in execution:

1. The name is a promise. Verify the promised outcome and fail otherwise; never swallow a wait failure. If it cannot be verified, do not promise it.
2. A wait matches the request its action triggered, by path and request parameters the case passes, not by interface name alone.
3. Return the IDs of what it created (sessions, tabs, files, processes) and register their release for teardown; counts are not enough for a case that must touch only its own resources.
4. Before changing shared state (preferences, local storage, account settings), save the original and register a teardown item that restores it and reads it back.
5. Generic reads do not imply semantic roles; an editable region is not necessarily a textbox. Offer a role-based primitive when a role is asserted.
6. Cache keys contain every input that changes the verdict: address, identity, model, version. Cache failures for less time than successes.
7. Document the fields of every returned object.

## Environment checks

The adapter contract and what to require are in environment. The running artifact must match the source under test. `check` runs again before every case, so its cost multiplies by the case count:

1. Cache an expensive check on every input that decides it (for a deployment: app, environment, bundle hash, deployed commit, source commit) for a few minutes, in a temp file other processes can read.
2. Retry a transient failure (timeout, indeterminate status) once before blocking. Do not retry a definite mismatch.
3. Name what was checked and what came back: exit code and last output lines, expected and actual versions.
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

Incomplete cleanup is complete: false, never reported as cleaned; a hook that throws is a cleanup error. Neither changes the case verdict.

- Every record a case creates, including through the UI, is findable by the marker.
- Separate the application channel (the test user through the project's interfaces) from an administrative channel (direct storage access for exact read-back, other-owner records and deletion). Without the administrative channel, declare a marker count per entity (for example a list interface searching the marker) so cleanup reports the real residue; never report complete without counting zero.
- Without a writable marker column, mark through a marked parent; otherwise record created keys on disk and delete by key.
- Delete or withdraw what the case created, restore what it changed (restored), keep evidence on purpose (retained).

Shared read fixtures follow execution: a preparation script outside the run checks existing bindings and repairs only what is missing or stale, then the adapter exposes them. Do not top up shared data from a flow on every run.

## Flows and teardown

Steps shared by two or more cases become a flow. Flows call only `kit` (registered operations through `perform`, primitives for the rest) and `data`, run as one step with their steps nested, and return what their description says. Steps used by one case stay in that case.

Teardown releases non-data resources: fault injection routes, sessions, listeners, extra tabs, changed preferences. It runs after the case and before data cleanup, so an active fault injection cannot intercept cleanup requests. Undo registered items in reverse, record each as a step, continue past a failing item and rethrow the first error.

## Choosing locks

Lock semantics are in execution. Choose by what the assertions need to stay stable, not by whether the case writes:

| Case | Locks |
|---|---|
| uses and asserts only its own marked data, and no case asserts account-wide aggregates | `[]` |
| the same, while other cases assert account-wide aggregates | `["read:account"]` |
| asserts account-wide aggregates: totals, unfiltered lists, no additional records | `["write:account"]` |
| changes account-wide settings or preferences | `["write:account"]`, and restore them |

A list filtered by the case marker is not account-wide. Treating every list assertion as account-wide serializes the suite.

## Documentation

The Kit README is what case authors read. Include a minimal project Kit with its forwarding files, one for each base a project can extend; the composition rules; each primitive's signature, return fields, and what it verifies or does not; how `perform` locates, acts and waits for each registry kind, and which kinds it refuses; the manifest rules; the lock table; supported REQUIREMENTS, what each checks and how long it is cached. Link to the execution skill for run options instead of restating them; a project guide that restates them drifts. Describe parameters as the runtime behaves and change both together. Put any checkable rule into load-time validation as well.

## Verify

1. Manifest validation passes.
2. A shared Kit has fixture tests on local mock pages covering each primitive kind and `perform` for each registry kind, independent of real environments.
3. One real-environment case uses every new primitive and flow; inspect each recorded step, read-back value and the cleanup report. With an administrative connection expect complete: true; without one, the real residue; retained data names its reason.
4. Running the fixture preparation twice changes nothing the second time.
5. Compare the sum of case script durations with the Run's duration; a large gap means check, queueing or lock overhead.
6. Look for business-independent helpers in project Kits and promote them.
7. Have an agent without context write a few cases from the documentation alone; what it read in source or guessed wrong is a documentation gap.
8. Perform every registry entry at least once (a smoke case per view is enough). An entry `perform` cannot execute points at its anchor or completion in the registry, not at the Kit; entries never performed stay candidates.
