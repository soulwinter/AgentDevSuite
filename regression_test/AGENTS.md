# Regression test development

This capability belongs inside Trace at regression_test. Design and delivery gates live in design.md and implementation-plan.md. Keep verified status in the implementation plan. Add consumer SKILL.md only with executable capabilities; never route consumers to development plans.

Own case discovery, execution planning, runner context and regression results. Reuse Trace's live registry, provider queries and standard page locator. CLI, MCP and GUI must consume one shared service contract. Case text and scripts share a project-owned file. Do not copy scripts into result archives or compile duplicate case registries.

Use owned subcapability directories when complexity requires them (cases, execution, record_store), each with its own AGENTS.md and consumer SKILL.md when ready. Keep shared code in lib. Product copy is English; project-authored case names/descriptions retain their language.

Discovery must parse literal metadata without importing/executing case scripts. Inspection/highlighting never runs a business action. Running a test is a distinct explicit action. Record red/blocked/error outcomes without masking them by reruns or automatic case-status changes. Agent diagnosis determines whether a failure is product behavior, test rot or removal of a feature.

## Runtime boundaries

Generic modules have no Colab imports or defaults. Runtime and generated outputs are ignored. Use live AST-discovered project cases; tracing integration is an optional adapter, never a prerequisite for discovery or functional execution. No copying from unlicensed Omni source; browser lifecycle is implemented with the same reviewed boundaries using Playwright.

Ownership: cases/ holds parser code, record_store/ holds record persistence code, catalog/ui/ holds rendering. Business scripts and real run outputs belong to the configured target repository. Scheduler completion must not imply test success.

Consumer routing is regression_test/SKILL.md -> cases, environment, execution, kit, record_store SKILL.md. Keep architecture, development status and rationale here or the implementation plan. GUI agent guidance is extracted verbatim from the Run regression section; do not maintain a second prompt template with different instructions.

One-run handoff is not a CLI manual: Run regression is a short consumer instruction plus one quoted command. Metadata syntax, alternative profiles/transports and lifecycle options live in execution/SKILL.md for on-demand reading. Avoid duplicate target/filter descriptions and equivalent plan/run command blocks. Omit default flags without changing selection semantics.

Case review can precede execution implementation. The parser exposes runnable separately from lifecycle; absence of run means a visible draft that every plan excludes, including explicit-ID requests. Never synthesize placeholder runners. Module hierarchy derives from slash-separated case metadata, and all selection surfaces match ancestors only at slash boundaries.
