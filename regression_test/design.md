# Regression testing inside Trace

Status: agreed design, implementation pending. This document defines the capability; none of its proposed commands are available yet.

## Scope and ownership

Add regression_test to the existing Trace skill and App. Keep tracing instrumentation and analysis intact. Test cases, test scripts and regression records are three separate concepts: a case describes the intended check; its script executes that check; a regression record captures one selected run. A case and its script reside in the same source file.

The App has three navigation destinations: Performance registry (the existing page), Test cases, Regression records. GUI and agent tools use the same case discovery, planning and results services. No independent GUI case catalog.

Do not save script snapshots. Records reference the owning script's repository-relative path and digest to detect that it has since changed, not to impose audit/reproducibility infrastructure. A source revision may be recorded when available, but a run requires no release/iteration association. Changing scripts never rewrites previous results.

## Project layout and discovery

Use one project-owned index at regression_test/regression.config.yaml; paths resolve relative to the index and must remain inside the repository.

```yaml
schemaVersion: 1
caseDirectories:
  - ../desktop/tests/regression
  - ../skills/colab/tests/regression
regressionDirectory: ../.regressions
```

Recursively discover *.mjs files under the declared roots. Each case file exports literal USECASE and META plus async run(ctx). Helpers live outside those roots or in underscore-prefixed paths excluded from discovery. Duplicate IDs, invalid literals or malformed discovered scripts are catalog diagnostics, never silent omissions. Trees remain available in list responses so agents can inspect only relevant files.

Initial script language: JavaScript ES modules (.mjs). Reuse the existing Node runtime and Playwright/CDP infrastructure discovered in Omni; do not add a Python runner or cross-language Page bridge in the first delivery. Static discovery uses a maintained JavaScript AST parser: accept literal object/string/array values in exported USECASE/META, reject computed metadata and never import modules during listing. Execute scripts in a worker process only after selection.

```js
export const USECASE = {
  name: 'Send a Channel message',
  description: `Preconditions: signed in with an accessible Channel.
Steps: enter a unique message and send it.
Expected: the message appears and the composer becomes available.`,
};
export const META = {
  id: 'messages.send.success', module: 'messages', surface: 'gui',
  priority: 'critical', origin: 'requirement', status: 'active',
  covers: ['messages.send'],
  affectedPaths: ['desktop/ui/src/features/messages/**'],
  requires: ['signed-in', 'test-channel'],
  effects: 'isolated-write', cost: 'fast',
};

export async function run(ctx) {
  // Illustrative interface, to be implemented and verified.
  const text = ctx.uniqueText();
  await ctx.action('Enter message', {target: 'message.composer', action: 'fill', value: text});
  await ctx.action('Send', {entry: 'messages.send', action: 'click'});
  await ctx.assertion('Message is rendered', {target: 'message.list', check: 'contains', expected: text});
  await ctx.performance('Submit to render', {entry: 'messages.send', maximumMs: 1200});
}
```

USECASE contains only a name and free-form description. No mandatory structured representation of preconditions/steps/expected results. META is machine-readable selection data. Case files are the source of truth; discovery produces a runtime catalog, never a second editable registry.

## Selection metadata

| Field | Values / meaning |
|---|---|
| id | Stable project-wide case ID |
| module | Project-owned business capability |
| surface | gui / skill / integration |
| priority | critical / normal / extended |
| origin | requirement / bug / acceptance-gap |
| status | active / rotten / obsolete |
| covers | Existing Trace entry IDs; empty is permitted and exposes an observation gap |
| affectedPaths | Repository-relative glob paths influencing this case |
| requires | Named environment/data prerequisites resolved by project fixtures |
| effects | read-only / isolated-write / external-write |
| cost | fast / normal / slow; actual historical durations can guide ordering |
| statusReason | Required when rotten/obsolete; include the evidence or feature decision |
| reviewPending | Optional boolean while a repaired rotten case awaits human acceptance |

Origin describes why the case exists, not a release source or runtime entry. Business modules and surfaces serve different filtering needs. User-defined tags may supplement these fields without replacing the core semantics.

Selection profiles live alongside the index, not in hardcoded Colab rules. Initial defaults:

- change: impacted active cases; fast cases run first. Include module dependencies declared by the project. Unknown impact mapping is shown as uncertain, not treated as unaffected.
- release: all active critical cases plus impacted normal cases and relevant defect regression cases. Run independent of a version identifier.
- full: every active case, including extended/slow cases.

Plan accepts explicit modules/cases/surfaces and profile overrides; returns every included/excluded case with its reason and unresolved prerequisites. Missing fixtures yield blocked results, not green or silently skipped cases. A named fixture supplies resources/credentials without placing secrets in metadata or results.

Default execution selects only active cases. An explicit validation run may execute rotten cases so they can be repaired. Keep a repaired case rotten with reviewPending=true until human acceptance restores active. Confirmed retired behavior becomes obsolete. Do not introduce a fourth lifecycle state.

## Runner and trace association

The runner owns run ID, case ID and attempt ID, per-case timeout, prerequisite setup, cleanup, and cancellation. Defaults to sequential cases until fixtures explicitly support isolation/parallelism. Reattempts remain distinct results; never overwrite a failed attempt with a passing one.

Use a worker process per case. Execution errors, prerequisite failures, product assertion failures and cancellation remain distinguishable. Capture cleanup failures separately; preserve the primary failure. A visible GUI run action calls the real runner and displays progress and cancellation.

ctx offers named action, observation, assertion and performance operations. It provides the browser/session or command transport, fixture resources and trace identity. Function assertions may evaluate project logic when declarative checks are insufficient; such checks remain named and their recorded result is available to GUI/agent consumers.

Action/observation targets reference registered Trace entry targets or explicit test DOM markers. Additional assertion-only elements may use data-test-target; project registration owns navigation/target mapping. No duplicate copied DOM selector map. Unsupported custom operations are allowed through the underlying tool but have no automatic location preview unless they record an explicit target.

Test execution identity is passed through a small project-owned diagnostic intake hook for GUI calls and per-invocation command environment for Skill calls. Reuse W3C traceparent and approved context propagation; put regression.run.id, regression.case.id and regression.attempt.id on relevant spans. Do not require every step or trace in a case to share a single business root. One case can produce multiple actual business traces, associated by execution identity. Avoid thread-global identity or credentials in baggage.

Timing separates executor overhead from actual business durations. End-to-end performance uses the registered terminal completion boundary, not HTTP response headers. Per-layer checks use relevant span durations; nested spans are not summed as independent elapsed time. Reuse monotonic durations and existing calibration/uncertainty for cross-host timestamp comparisons.

Functional assertions execute during the case. Performance assertions may enter awaiting-telemetry until spans are queryable, with a bounded deadline. Missing/incomplete telemetry is an explicit inconclusive/error outcome, never a passing performance assertion. Records retain provider/query identity, measurement boundary, units, actual/threshold, sample count and any uncertainty. First delivery supports single-run limits; repeated sampling, prewarming, percentile/baseline regression checks are a later explicit capability.

## Preview: explicit targets, not code guessing

Do not attempt to infer every click/selector/assertion from arbitrary JavaScript code. Dynamic loops, fixtures and callbacks make that unreliable.

First delivery provides script opening and recorded action/assertion targets. The context API records a step's name, action/observation type, target, navigation prerequisites and outcome while executing. These records let the App show what was actually tested, screenshots and the corresponding GUI target. Unexecuted cases retain their human description and script view; no fabricated step preview.

When previewing a recorded target, use the standard Trace page locator with an entry ID, or extend its shared protocol to accept project-registered test-only targets. Preview may perform safe navigation and highlight; it never replays input/click operations or executes an assertion's side effects. Resource-specific targets may be unavailable in the present session and must say so. Screenshots remain useful evidence when the live target no longer exists.

Optional future static preview can be supported for literal ctx calls, marked incomplete when dynamic calls exist. It is not a prerequisite or substitute for actual execution records.

## Regression records

One invocation creates one directory named UTC timestamp plus short ID, e.g. .regressions/20261006T083012Z-a7c9/. Human-readable run name defaults to timestamp plus profile; an optional supplied name is allowed. Sorting uses the parsed UTC timestamp; elapsed time uses a monotonic clock.

```text
.regressions/20261006T083012Z-a7c9/
  regression.yaml
  evidence/                 # screenshots and larger outputs, only when present
```

regression.yaml fields:

- schemaVersion, id, name, startedAt, finishedAt, durationMs, state.
- environment summary, optional code revision, selection profile/filters and plan reasons.
- Per-case id, name, description and selection metadata as at execution; script path/digest; selected/excluded reason.
- Per-attempt state, duration, named steps, functional/performance assertions, safe input/output summaries, errors and cleanup outcome.
- Associated trace/span IDs, Grafana links derived through existing provider helpers, and performance measurements used for assertions.
- Repository-relative evidence references for screenshots/larger logs.

Run states: running / completed / cancelled / interrupted. Case outcomes: passed / failed / blocked / error / cancelled. An assertion may additionally be inconclusive; a case cannot be passed if a required assertion is inconclusive. Separate case lifecycle from run outcome.

For a terminal case, steps whose last snapshot is running are displayed as interrupted, with completion and cleanup explicitly unknown. This is a read-only presentation of the snapshot; retain the recorded status, errors, durations and YAML unchanged. Running steps in a live or pending case retain their live presentation.

Write progress atomically to YAML during execution; seal the result once terminal. On restart identify abandoned running records as interrupted, preserving completed attempts. A seal is a writer invariant, not an audit/signing system. Later agent diagnosis goes in a separate analysis.yaml referencing case/attempt IDs, preserving the original recorded facts.

Store needed performance values and bounded span summaries because provider traces expire; do not duplicate entire cloud trace storage. Keep prompts/business output only under the project's capture policy and redact tokens. No scripts/ archive, release snapshots or compulsory audit trail.

## GUI

Shared persistent navigation: Performance registry / Test cases / Regression records. Use the shared React/shadcn catalog shell, with registered source/provider metrics/GUI locator behaviors preserved. Public product copy is English.

Test cases:

- List shows name, metadata (including lifecycle/module/surface/priority) and a View script entry. Filter by metadata/status; default active, with rotten/obsolete discoverable.
- Clicking a case opens a drawer with the authored USECASE description. Do not force a rigid form or expose internal schema jargon.
- View script resolves the real repository file and requests host file opening where supported. Browser fallback serves a read-only source view at that file path; no misleading success when an OS/editor bridge is unavailable. GUI and agent source APIs use the same containment validation.
- Recorded step targets may expose location preview when available. Static script preview is deferred rather than required in the initial page.

Regression records:

- Left sidebar lists run name and elapsed duration only; ordered newest first.
- Right detail contains run metadata, counts and per-case outcomes. Default problem filter hides passed cases but allows all results.
- Case detail exposes named failed assertions, expected/actual, script location, evidence, measurements and related Trace/Grafana links. Do not recreate Grafana's span inspector.
- Run controls use the shared plan/run/cancel service; show scope before executing. Diagnosis/status changes use real shared operations.

## Agent-facing service contract

Proposed CLI namespace: trace.mjs regression <action> --repo <repo>. MCP tool names map to the same actions; HTTP App routes share dispatch/service logic. These are contracts to implement, not commands available now.

| Action | Result / mutation |
|---|---|
| cases list/show | Filterable metadata/text; include discoverability diagnostics |
| cases source | Resolve case file and return script contents/location |
| cases set-status | Explicit lifecycle change with reason; repair review metadata |
| plan | Selected/excluded cases, reasons and prerequisites; no execution |
| run | Create a run from a validated plan, report run ID/progress |
| cancel | Stop a chosen run and finish cleanup |
| records list/show | Metadata and result filters; problems-only excludes green |
| records evidence | Read bounded, validated evidence references |
| analyze | Read failures, assertions, measurements and trace references; persist diagnosis via shared results service |

Agents edit scripts through ordinary repository file tools, validate static discovery, then execute selected cases. Scaffold commands should initialize the project index and a working example case, and detect/setup runner dependencies. Consumer skill guidance covers case design, script implementation, targeted validation, regression execution, diagnosis and lifecycle maintenance. Development guidance stays in AGENTS.md/design documents.

A pending failure is not automatically test rot. Agent investigation uses the evidence and trace tools; fix product bugs, confirmed false positives or removed-feature cases appropriately. Improve observation gaps through instrumentation only within the task scope. Human findings add acceptance-gap cases to the same catalog.

## Delivery acceptance

Implement and validate in this order: literal case discovery and plan; runner and persisted results; navigation and pages; execution/trace correlation and performance assertions; agent workflow validation on Colab GUI and Skill paths. Each delivery must expose only working actions. Validate the packaged installation, not only development imports. Cross-origin preview reuses the installed standard locator; no new Colab-specific highlighter.

## Browser infrastructure reuse decision (2026-10-06)

Inspected source: omni_assistant/regression_test/tools/browser.ts, browser-task.ts, diagnostics.ts, auth-state.ts, app-readiness.ts, scripts/run-browser-task.sh, and browser selftests. This is source inspection, not fresh runtime/CDP validation.

Reuse the browser.ts lifecycle and its browser selftests as the starting point for regression_test/browser; extract generic diagnostics/evidence code selectively. Do not make distributed Trace depend on the Omni checkout or installed Omni skill. Preserve source provenance and establish the redistribution/license basis before copying code into the public release. This inspection did not establish a license grant from a repository LICENSE file.

Keep three owned capabilities:

- browser: system Chrome discovery, dedicated persistent profiles, profile locks, DevToolsActivePort discovery, loopback CDP connection, page lifecycle and diagnostics. No test catalog, Omni URL or application login assumptions.
- execution: case selection/worker, ctx actions/assertions/performance, fixtures, regression identity and result persistence. Adapt the useful execution ordering/error/cleanup behavior from browser-task.ts; do not copy its entire import graph.
- project adapter: base URL, login readiness check, route/readiness helper and fixture resources. The owning project supplies these hooks; /api/auth/me, Module Federation data-view, asset_path/view and dev01/dev02 mappings are Omni-specific and must not become Trace defaults.

Device mode uses the default BrowserContext of a dedicated Chrome user-data directory. Preserve cookies/localStorage there, open a run-owned Page and bring it to the foreground. No cookies()/storageState() export, browser database reading, auth-token argument or default-personal-profile copying. A fresh profile requires an initial interactive login; session expiry is blocked/auth-required until renewed. An already authenticated compatible dedicated profile may be explicitly configured and reused, subject to its ownership lock. Do not promise automatic reuse of the user's ordinary Chrome default profile.

Configure profile root/name, executable, base URL, environment, mode and startup timeout in protected local project connection configuration. Prefer ~/.local/share/trace/browser-profiles/<profile>, not Omni paths/environment names. Profiles can share a login session across intentional project environments; parallel runs cannot share one profile lock. Setup checks system Chrome for device mode, installs locked Playwright dependencies, and downloads a managed Chromium only when headless execution is requested and needed. Headless is an explicit CI/fixture alternative with its own authenticated setup; it cannot inherit desktop login by implication.

Own browser lifetime separately from Page lifetime. Close only run-owned Pages, disconnect a reused browser, and terminate only processes the runner launched. Per-case keep-open observation time is excluded from duration assertions. Preserve device limitations (shared session state, no per-case context isolation, limited existing-context video/CDP support). Do not certify read-only safety solely because a case opens a new tab.

Scripts receive ctx.page (real Playwright Page), ctx.baseUrl, ctx.input, fixture resources and the named action/assertion/evidence interface. They never launch Chrome/connect CDP/create their own browser contexts or transfer cookies. Navigation readiness checks wait for a meaningful visible business landmark; neither fixed sleeps nor global networkidle define application readiness. Optional project route helpers resolve actual routes. ctx.action and assertion target references support GUI location records; arbitrary direct Page use is permitted where necessary but must explicitly record targets if preview is desired.

Distinguish Playwright trace.zip (browser execution diagnostic artifact) from OpenTelemetry trace IDs/spans (business performance). The former is optional evidence; performance assertions query the latter. Neither is an automatic substitute for the other.

Before accepting reuse: run generic lifecycle tests in an isolated profile, verify reuse/disconnect and foreground Page cleanup, establish session persistence without cookie export, and test a project with no Omni auth/route assumptions. Then run Colab GUI and Skill cases from the packaged Trace installation. Existing Omni selftest files are reusable test inputs, not proof that the extracted module already works.
