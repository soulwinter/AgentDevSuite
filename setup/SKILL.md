---
name: trace-setup
description: Install, check or update the trace tool's local runtime dependencies and MCP App build.
---

For first installation, run `curl -fsSL https://raw.githubusercontent.com/kwgjjeffrey/trace/main/setup/install.sh | sh`. It downloads a verified release and installs missing runtime dependencies privately. Use `TRACE_INSTALL_DIR` for another agent host.

Run `sh <trace-skill>/setup/run.sh setup/setup.mjs check` before first use or when startup fails. When Node is absent from PATH, use this launcher for setup commands and `sh <trace-skill>/setup/run.sh trace.mjs <command>` for Trace commands.

Run `node <trace-skill>/setup/setup.mjs install` to install locked dependencies and build the MCP App locally. It does not register an MCP server, install project dependencies, or change credentials. Python Honeycomb queries have an optional separate dependency in analysis/scripts/requirements.txt; install it in a dedicated Python environment only when needed.

For an authorized source update, run `node <trace-skill>/setup/setup.mjs update --from <trusted-source-directory>`. It validates a staged installation and tests before applying managed source files, preserves backups, and restores prior source if installation fails. Restart the MCP connection after updating. Use `release-check` to inspect GitHub Releases and `upgrade` to install a verified newer release. Git development checkouts reject artifact upgrades. The MCP App provides the same check/upgrade actions.

To distribute source, run `npm pack --ignore-scripts` from the skill directory. Dependencies and generated App bundles are excluded; the recipient runs setup install.

Configure provider endpoints and tokens by piping private JSON to `setup/setup.mjs configure`; required fields are project, queryEndpoint, queryInstanceId and token. Optional fields are grafanaUrl, datasourceUid, otlpEndpoint and instanceId. It writes protected per-project files outside the installation. Never put tokens in command arguments or tool output. A Tempo on this machine's loopback (for example `http://127.0.0.1:3200`) may be configured with only queryEndpoint and an optional otlpEndpoint; HTTP and missing tenant/token are accepted for loopback hosts only.

To connect an existing repository, run `sh <trace-skill>/setup/run.sh trace.mjs project-setup --repo <repo>`. This adds or refreshes only a marked Trace dependency/install block in root AGENTS.md. Add `--regression true` to create the project-owned registry, local instructions, ignored case-only example and run-output ignore rule. Existing registries, cases and surrounding instructions are preserved; re-running is safe. It does not install project dependencies, run tests, configure providers or alter business code.
