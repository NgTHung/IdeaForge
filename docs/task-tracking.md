# Task Tracking

The `.tasks/` directory stores IdeaForge development work as markdown files with YAML frontmatter. `taskroot` validates metadata, links, criteria sections, prefixes, and rule references so task state stays useful during large roadmap migrations.

Adapted from Filer's task tracking guide, this document describes the installed `taskroot` CLI. The [task project contract](task-project-contract.md) defines portable domains, qualified identities, and configuration. IdeaForge uses explicit policy in `.tasks/config.json`.

Use these commands before and after task changes:

```bash
taskroot validate
taskroot validate --format json
taskroot list
taskroot summary
taskroot list --format json
```

## Project Discovery

`taskroot` starts at your current working directory and selects the nearest
ancestor that directly contains a `.tasks` directory. You can run commands from
the project root or any nested path. A nested project takes precedence over an
outer project.

Use `--root <path>` on any command to start discovery somewhere else. Relative
paths resolve from your current working directory, and the path may point to a
project root, a nested directory, or an existing file inside the project.

```bash
taskroot list --root ../another-project/src --format json
taskroot validate --root C:\work\another-project
```

The `.tasks` directory alone marks a project. It does not need
`task.schema.json`. Discovery does not inspect task contents, so malformed task
files produce validation errors for the nearest project instead of causing a
search for an outer project.

If no `.tasks` directory exists at or above the starting path, the command exits
unsuccessfully and reports both the searched path and the required `.tasks`
directory.

Create a new project with `init`. The command fails if the target already has a
`.tasks` directory. It writes `.tasks/config.json` and leaves domain directories
absent until the first task is added.

```bash
taskroot init --root C:\work\new-project --domain work --prefix WORK
taskroot init --root ../new-project --domain work --prefix WORK,BUG
```

## Project Configuration

`taskroot` loads `.tasks/config.json` once after project discovery and before
it reads or writes task files. The file must use version 1. Every object is
strict. Unknown fields, nulls, duplicate keys or list values, empty required
collections, invalid portable names, conflicting milestone roles, and invalid
tag policy combinations stop the command. JSON syntax errors report the file,
line, and column.

A minimal single-domain policy looks like this:

```json
{
  "version": 1,
  "domains": {
    "work": {
      "prefixes": ["WORK"]
    }
  },
  "task_types": {
    "Feature": {
      "criteria": "acceptance"
    }
  },
  "tags": {
    "policy": "open"
  }
}
```

This example defines separate domain prefixes, custom checklist behavior, one
milestone role, and a strict tag catalog:

```json
{
  "version": 1,
  "domains": {
    "backend": {
      "prefixes": ["API", "WORK"]
    },
    "release": {
      "prefixes": ["REL", "WORK"]
    }
  },
  "task_types": {
    "Feature": {
      "criteria": "acceptance"
    },
    "Container": {
      "criteria": "exit"
    },
    "ReleaseGate": {
      "criteria": "exit",
      "role": "milestone"
    }
  },
  "tags": {
    "policy": "strict",
    "allowed": ["backend", "needs-triage", "ready-for-agent", "release"],
    "exclusive_groups": {
      "triage-state": ["needs-triage", "ready-for-agent"]
    }
  }
}
```

`exclusive_groups` is optional and requires a strict tag policy. Every group
member must appear in `allowed`. A task may carry zero or one tag from each
group. Validation rejects conflicting group members on stored tasks, direct
creation, imports, and edits.

A present configuration defines the complete project policy. It does not inherit domains, types, or tags from the [compatibility profile](task-project-contract.md#compatibility-profile). IdeaForge uses `work` with `WORK` and `BUG` prefixes, and `milestones` with the `MILESTONE` prefix. The configured task types and triage tags are listed in `.tasks/config.json`.

Library callers open an explicit root. Discovery stays a separate host or CLI
step:

```rust
use taskroot::project::{CriteriaPolicy, TaskProject};

let project = TaskProject::open(root)?;
let policy = project.policy();
let feature = policy.task_type("Feature");
assert_eq!(feature.map(|value| value.criteria()), Some(CriteriaPolicy::Acceptance));
# Ok::<(), taskroot::error::TaskError>(())
```

`TaskProject` owns the canonical root and its immutable `ProjectPolicy`.
Opening two roots produces independent policies. Configuration errors expose a
stable code and structured context through `TaskError::code` and
`TaskError::context`.

## Task Files

Each domain in project configuration maps to one direct child directory under
`.tasks`. The `default` name is an ordinary domain. Commands do not select it
when you omit a domain. When configuration is absent, the compatibility policy
keeps `.tasks/core`, `.tasks/app`, `.tasks/ecosystem`, and `.tasks/milestones`
readable.

File names must start with the task ID:

```text
.tasks/work/WORK-001-merge-source-snapshots.md
.tasks/work/WORK-002-first-task.md
.tasks/milestones/MILESTONE-003-demo-readiness.md
```

Every task uses frontmatter followed by markdown body sections:

```yaml
---
id: WORK-001
title: Merge source snapshots
status: To Do
priority: High
type: Feature
parent: WORK-000
milestone: "0.3.0"
depends_on: [WORK-000]
risk: High
impact: Touches merge acceptance and source snapshots.
tags: [enhancement]
last_updated: 2026-06-05
---
```

Milestone tasks are project references, not domain-local IDs. In IdeaForge's policy, a milestone file uses the `MILESTONE` prefix and stores the shared milestone value in `milestone`:

```yaml
---
id: MILESTONE-003
title: Demo readiness
status: In Progress
priority: High
type: Milestone
milestone: "0.3.0"
last_updated: 2026-06-05
---
```

```markdown
## Summary

Explain why this work exists and what outcome it should produce.

## Acceptance Criteria

- [ ] Merge source snapshots accepts reconstructable references.
- [ ] Editing a source note preserves the accepted snapshot.
- [ ] Tests cover accepting a merge and editing its source notes.
```

## Frontmatter

Required fields:

| Field | Values |
| --- | --- |
| `id` | `PREFIX-NUMBER`, for example `WORK-001` |
| `title` | At least 5 characters |
| `status` | `To Do`, `In Progress`, `Blocked`, `Done`, `Deferred`, `Obsolete` |
| `priority` | `High`, `Medium`, `Low` |
| `type` | A name declared in `task_types`; compatibility names are `Milestone`, `Epic`, `Feature`, `Bug`, `Refactor`, `TechDebt`, `TestDebt`, `Design`, `Docs` |

Status and type are separate. Status records lifecycle state. Type classifies the work and selects its criteria heading. A configured project accepts the names in `task_types`; a compatibility project accepts the nine built-in names shown in the table. `Deferred` and `Obsolete` are statuses, not task types. They require `## Rationale` and may omit criteria. `Blocked` is also a status; it requires `## Blocked Reason` in addition to the criteria selected by the task type.

Task type values are stored and emitted as strings. You can add a type in configuration without recompiling `taskroot`. The type's `criteria` value selects `## Acceptance Criteria` or `## Exit Criteria`. The optional `milestone` role, not the type name or directory, enables milestone validation, readiness blocking, context relations, and milestone commands.

Optional fields:

| Field | Purpose |
| --- | --- |
| `parent` | Same-domain local ID or cross-domain qualified parent identity |
| `milestone` | Project milestone value, for example `0.3.0` |
| `depends_on` | Same-domain local IDs or qualified task identities that must not form cycles |
| `rules` | Architecture rule IDs from `docs/architecture/invariants.md` |
| `risk` | `High`, `Medium`, or `Low` |
| `impact` | Short description of what the work can affect |
| `tags` | Query labels |
| `whitepaper` | Design reference |
| `last_updated` | `YYYY-MM-DD` |

Only add `rules` after defining the referenced IDs in `docs/architecture/invariants.md`. IdeaForge's product invariants are recorded in `AGENTS.md` and `docs/decisions.md`; they are not a taskroot rule registry.

## Criteria Sections

Criteria stay in the markdown body because they are human work instructions, not query metadata.

Types configured with `"criteria": "exit"` must include:

```markdown
## Exit Criteria
```

Types configured with `"criteria": "acceptance"` must include the following section unless their status is `Deferred` or `Obsolete`:

```markdown
## Acceptance Criteria
```

Tasks whose status is `Deferred` or `Obsolete` may omit criteria, but they must include:

```markdown
## Rationale
```

`Blocked` tasks must include:

```markdown
## Blocked Reason
```

`Done` tasks must not have unchecked checklist items in `## Acceptance Criteria` or `## Exit Criteria`.

## Prefixes

Every task ID must use a prefix allowed by its domain in `.tasks/config.json`.

| Domain | Prefixes | Purpose |
| --- | --- | --- |
| `work` | `WORK`, `BUG` | Product, verification, and maintenance work |
| `milestones` | `MILESTONE` | Release gates |

## Validation

`taskroot validate` checks:

- YAML frontmatter parses into the strict task model.
- Task IDs use `PREFIX-NUMBER`; relationship references use local IDs or `domain:LOCAL-ID`.
- File names start with the task ID.
- The task ID prefix is allowed by its configured domain.
- The task type exists and its configured criteria section is present.
- Tags use portable lowercase syntax and satisfy the open or strict tag policy.
- Parent tasks exist.
- Every milestone-role task has a non-empty milestone value and milestone values are unique project-wide.
- Every task milestone matches exactly one milestone-role task across all domains.
- Dependencies exist, do not duplicate IDs, do not reference self, and do not form cycles.
- Rule IDs exist in `docs/architecture/invariants.md`.
- `last_updated` is a real `YYYY-MM-DD` date.
- `impact` has useful content when present.
- Required criteria, blocked reason, or rationale sections exist.
- `Done` tasks have no unchecked criteria items.

Local `parent` and `depends_on` values resolve in the task's own domain. Use
`domain:LOCAL-ID` for a cross-domain relationship. Compatibility projects also
accept a legacy local reference when it has one project-wide match outside the
source domain. Validation reports this fallback as a
`legacy_global_reference` warning. Multiple project-wide matches are
ambiguous and fail validation.

Taxonomy failures remain machine-readable. Direct add, import, ready, and list preflight return `unknown_type`, `tag_rejected`, or `prefix_not_allowed`. Stored-task validation returns `validation_failed`; each entry in `context.issues` keeps the original reason code, rejected value, field, domain, task identity, allowed values, and project root.

Use this order when changing taxonomy:

1. Inventory every domain, prefix, type, milestone binding, and tag in the existing task files.
2. Add a configuration that accepts the current repository without changing task files.
3. Run `taskroot validate` and resolve every taxonomy issue.
4. Update task files and configuration together for the intended rename or restriction.
5. Validate again before removing old prefixes, types, or tags from configuration.

This sequence keeps reads and writes available during migration. A present configuration replaces the compatibility profile, so adding a partial configuration before the inventory step can make existing tasks invalid.

## Workflow

Create tasks when work introduces a feature, capability, significant refactor, architectural bug fix, or whitepaper implementation. Do not create tasks for routine formatting, trivial fixes, existing-doc edits, or dependency bumps.

When starting work, move the task to `In Progress`. When complete, verify the implementation, tests, and criteria before marking it `Done`. Use `Blocked` only when progress depends on a missing decision, external state, or unresolved dependency. Use `Deferred` or `Obsolete` with a clear rationale so future readers know why the work is not active.

Commands that select one task require its exact `domain:LOCAL-ID` identity.
This applies to `show`, `context`, `deps`, every lifecycle command, and the
`list --parent` filter. An unqualified selector fails and lists matching
qualified candidates.

List focused task sets with filters:

```bash
taskroot list --status "In Progress"
taskroot list --priority High
taskroot list --domain work
taskroot list --parent work:WORK-000
taskroot list --tag enhancement
taskroot list --milestone 0.3.0
taskroot list --blocked
```

Use JSON output when another tool needs structured data:

```bash
taskroot list --format json
```

### Triage tags

IdeaForge defines `triage-category` and `triage-state` as exclusive tag groups.
Triage tags classify work without replacing its lifecycle `status`.

Set or clear one group through the CLI. The command removes the previous value
from that group, preserves unrelated tags, validates the result, and writes the
task atomically:

```bash
taskroot tag set work:WORK-042 triage-category enhancement
taskroot tag set work:WORK-042 triage-state ready-for-agent
taskroot tag clear work:WORK-042 triage-state
```

Use `list` to inspect a triage queue. Use `ready` when you need triaged tasks
that also satisfy taskroot's lifecycle, dependency, hierarchy, and milestone
rules:

```bash
taskroot list --tag needs-triage
taskroot ready --tag ready-for-agent --format json
```

## Agent Workflow

Use `ready` to select executable work. A ready task is `To Do`, is not a milestone, has no child tasks, has only `Done` dependencies, and has only `To Do` or `In Progress` ancestors. Results sort by priority and then qualified identity.

Read [decisions](decisions.md) before changing scope, architecture, or access policy. Use the [roadmap](roadmap.md) for priorities and `.tasks/` for individual task status and criteria. Initialization creates policy only; add approved work with `taskroot add` before querying or starting a task.

Use the project queue to select work within the user's request:

```bash
taskroot ready --domain work --tag ready-for-agent --format json
taskroot list --domain work --tag needs-triage --format json
```

Readiness records lifecycle eligibility. The `ready-for-agent` tag records that a task is specified for implementation. An empty queue calls for refinement or a progress report. IDs and milestone values in examples below illustrate usage; referenced tasks and milestones must exist before running those commands.

Use `show` when you need one task's full metadata and body sections:

```bash
taskroot show work:WORK-001
taskroot show work:WORK-001 --format json
```

Use `context` before implementation. It returns the target task, readiness blockers, direct task relationships, the root-first `ancestors` chain, milestone, referenced architecture rule text, and whitepaper path. It does not infer source files.

```bash
taskroot context work:WORK-001
taskroot context work:WORK-001 --format json
```

The `show`, `ready`, and `context` JSON envelopes use `schema_version: 2` and
include validation warnings. Every task object retains its local `id` and
`domain`, and adds `qualified_id` as its canonical key. Parent, dependency,
relation, and readiness blocker identities in these envelopes are qualified.

Unversioned task-array JSON from `list`, `deps`, and milestone views also adds
`qualified_id`. This is a semantic break for consumers that used local `id` as
a project-wide key. Key tasks by `qualified_id`, or by the `domain` and `id`
pair.

An agent should use this sequence:

```bash
taskroot ready --domain work --tag ready-for-agent --limit 5 --format json
taskroot context work:WORK-021 --format json
taskroot start work:WORK-021
# Implement and test the task.
taskroot criterion-toggle work:WORK-021 0
# Toggle any remaining criteria only after verifying them.
taskroot validate
taskroot done work:WORK-021
taskroot validate
```

Inspect dependencies that still need work:

```bash
taskroot deps --incomplete work:WORK-042
taskroot deps --incomplete work:WORK-042 --format json
```

Inspect milestone exit criteria and progress:

```bash
taskroot milestone 0.3.0 --exit-checklist
taskroot milestone 0.3.0 --exit-checklist --format json
```

Generate progress summaries:

```bash
taskroot summary
taskroot summary --milestone 0.3.0
taskroot summary --format json
```

Use lifecycle commands to keep status and rationale sections consistent. Create referenced milestones before their member tasks. The following commands illustrate separate transitions; verify and check all criteria before `done`:

```bash
taskroot add --domain milestones --id MILESTONE-003 --title "Demo readiness" --priority High --type Milestone --milestone 0.3.0 --criterion "The demo shows shared notes and preserved merge ancestry."
taskroot add --id work:WORK-042 --title "Merge timeout feedback" --priority High --type Feature --milestone 0.3.0 --criterion "A timed-out merge displays a retryable error."
taskroot add --domain work --id WORK-043 --title "Proposal editing" --priority High --type Feature --criterion "You can edit a proposal before accepting it."
taskroot start work:WORK-042
taskroot done work:WORK-042
taskroot criterion-toggle work:WORK-042 0
taskroot block work:WORK-042 "Waiting for a merge retry policy decision."
taskroot defer work:WORK-042 "No longer needed for the current milestone."
taskroot obsolete work:WORK-042 "Replaced by work:WORK-044."
```

`add` accepts either `--id domain:LOCAL-ID` or an unqualified `--id` with an
explicit `--domain`. A matching domain in both inputs is valid. Conflicting
domains fail, and an unqualified ID without `--domain` never falls back to
`default`.

Successful human output uses the same headings, labels, and path format across commands. Paths are relative to the repository and use `/` separators:

```text
Task Started
Task: work:WORK-042
Path: .tasks/work/WORK-042-merge-timeout-feedback.md
```

Validation and imports use labeled summaries:

```text
Validation
Status: Passed
Tasks: 23
Warnings: 0
```

```text
Import
Mode: Dry Run
Tasks: 2

Paths
.tasks/milestones/MILESTONE-003-demo-readiness.md
.tasks/work/WORK-042-merge-timeout-feedback.md
```

`add` can scaffold richer task files when a migration already knows the metadata:

```bash
taskroot add --domain work --id WORK-042 --title "Merge timeout feedback" --priority High --type Feature --parent milestones:MILESTONE-003 --milestone 0.3.0 --risk High --impact "Touches merge requests and error feedback." --tag enhancement --summary "Show actionable feedback when a merge request times out." --criterion "A timed-out merge displays a retryable error."
```

Use `--criterion` for open checklist items and `--checked-criterion` when creating a `Done` task with completed criteria. `Blocked` tasks need `--blocked-reason`. `Deferred` and `Obsolete` tasks need `--rationale`.

Use `criterion-toggle` to flip one zero-based checklist item in the criteria
section selected by the task type:

```bash
taskroot criterion-toggle work:WORK-042 0
```

## Batch Import

Use `import` when migrating curated roadmap items into `.tasks/` without writing each markdown file by hand. The input is JSON and uses the same field names as task frontmatter, plus `summary`, `criteria`, `rationale`, and `blocked_reason` for body sections:

```json
[
  {
    "domain": "milestones",
    "id": "MILESTONE-003",
    "title": "Demo readiness",
    "priority": "High",
    "type": "Milestone",
    "milestone": "0.3.0",
    "criteria": [{ "text": "The demo shows a shared board and preserved merge ancestry." }]
  },
  {
    "domain": "work",
    "id": "WORK-042",
    "title": "Merge timeout feedback",
    "priority": "High",
    "type": "Feature",
    "parent": "milestones:MILESTONE-003",
    "milestone": "0.3.0",
    "risk": "High",
    "impact": "Touches merge requests and error feedback.",
    "tags": ["enhancement"],
    "summary": "Show actionable feedback when a merge request times out.",
    "criteria": [{ "text": "A timed-out merge displays a retryable error." }]
  }
]
```

Validate the batch before writing:

```bash
taskroot import docs/roadmap-migration.tasks.json --dry-run
```

Write the batch once dry run passes:

```bash
taskroot import docs/roadmap-migration.tasks.json
```

Use `--skip-existing` for reruns after a partial manual migration. Import validates the whole batch before writing files, including parent, dependency, milestone, and rule references.

Creation never uses compatibility fallback. An unqualified parent or dependency
must exist in the new task's explicit domain. Qualified inputs may reference
any configured domain and are stored in canonical `domain:LOCAL-ID` form.
