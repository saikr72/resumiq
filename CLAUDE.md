# Resume Intelligence Platform — Claude Code Configuration

## Project

Analyzes resumes against job descriptions (ATS keyword match plus Claude-generated suggestions) and tracks job applications and interviews. `PROJECT_PLAN.md` is the target design and describes more than exists today; trust the code for current behaviour.

| Path | Stack | Port | Agent |
|------|-------|------|-------|
| `frontend/` | React 18, Vite, TypeScript | 3000 | `frontend-ui` |
| `backend-node/` | Express, TypeScript, `pg`, Anthropic SDK | 5000 | `api-backend` |
| `service-python/` | FastAPI, pdfplumber, python-docx | 8000 | `parsing-nlp` |
| `database/` | PostgreSQL with pgvector (`ankane/pgvector:v0.5.1`), raw SQL | 5432 | `database-schema` |

**Request flow:** the browser calls `backend-node`, which sends uploads to `service-python` (`/parse`, `/compare-keywords`), calls Claude (`src/llm.ts`), and stores results in Postgres. The Python service has no database access.

**Environment variables (backend):** `PORT`, `DATABASE_URL`, `PYTHON_SERVICE_URL`, `ANTHROPIC_API_KEY`.

### Commands

```bash
docker compose up postgres service-python backend-node   # Docker stack, excluding the frontend (see Known issues)

# Typecheck and build
cd backend-node && npm run build
cd frontend && npm run build

# Python syntax check
cd service-python && .venv/bin/python -m compileall -q app
```

Dev servers: `npm run dev` in `backend-node/` and `frontend/`, and `.venv/bin/python -m uvicorn app.main:app --port 8000` in `service-python/`. To rebuild the venv, use the Python version from `service-python/Dockerfile`: `uv venv --python 3.11 .venv && uv pip install --python .venv/bin/python -r requirements.txt`.

There is **no automated test suite** and no linter configured. Report what was actually run rather than implying coverage.

### Working on this repo

- Git is initialized but **has no commits yet**, so nothing can be reverted with git and worktree isolation is unavailable. Until a first commit exists, run writing agents one at a time, or in parallel only when each stays in its own service directory.
- Cross-service changes: the API JSON is a contract between `backend-node/src/index.ts` and `frontend/src/App.tsx`, and the Python response fields are a contract between `service-python/app/main.py` and `backend-node`. Update both sides in the same task.
- Schema changes go in both `database/schema.sql` and `database/schema_tracker.sql`. There are no migrations, so existing databases also need `ALTER` statements.
- Resumes contain personal data. Do not log their text or commit sample resumes from real people.

### Known issues

Verified against the code. Do not fix these as a side effect of other work; fix one only when asked, then remove it from this list.

**Environment**
- `backend-node/start`, `stop`, and `query` are stray one-line files containing only `postgresql-x64-17`.

**Frontend**
- **The Docker frontend is unreachable as configured.** Its image serves nginx on port 80, but compose maps `3000:3000`.
- The API URL is hardcoded to `http://localhost:5000`, including a separate literal in the upload call.
- Application statuses (`SAVED`, `APPLIED`, `SCREENING`, `INTERVIEWING`, `OFFER`, `REJECTED`) are defined only in the frontend, with no database constraint.

**Backend**
- **There is no authentication.** Every route acts as the first row from `SELECT id FROM users LIMIT 1`, which startup seeds as a test user. CORS is open to all origins. Do not deploy this publicly.
- Uploads have no size limit or type validation in Multer, and are held in memory. The `file_path` saved to the DB is a placeholder; the file is never stored.
- `src/llm.ts` uses the old model ID `claude-3-5-sonnet-20241022` with SDK `^0.18.0`. Check that the model is still available. On failure, it returns `{ error }`, which then gets saved as `improvement_suggestions`.
- `semantic_score` and `experience_score` are saved as `0`, `overall_match_score` is just the keyword score, and `resume_analyses.job_id` is never set.

**Python service**
- **Skill matching gives wrong results.** `\b` regex boundaries mean `C++` and `C#` are never detected, while `Go` and `R` match ordinary text such as "go to" and "R&D".
- Files ending in `.doc` are sent to python-docx, which only reads `.docx`.
- `spacy` and `scikit-learn` are pinned but unused. `sentence-transformers` and all embedding work from the plan don't exist yet.

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — put them in the service they belong to (`backend-node/`, `frontend/`, `service-python/`, `database/`)
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to user commits unless this project's `.claude/settings.json` has `attribution.commit` set (#2078). The Claude Code Bash tool may suggest one in its default commit-message template — ignore it. `Co-Authored-By` is semantic authorship attribution under git/GitHub convention; the tool is the facilitator, not a co-author.
- Keep files under 500 lines
- Validate input at system boundaries

## Ruflo Capability Brain & Implementation Loop

Ruflo is the coordination ledger and policy decision point. Claude Code is the
executor: after a Ruflo coordination call, continue implementing the task.

When it is registered, call
`guidance_brain({ mode: "recommend", task: "..." })` before complex Ruflo
work. Use its live registry instead of guessing tool names. Treat
`registered`, `configured`, `reachable`, `healthy`, and `authorized`
as separate facts. If the brain is unavailable, continue with the compatible
`guidance_recommend` tool, CLI discovery, and repository instructions.

Follow the returned loop:

1. Recall memory and ADR constraints.
2. Inspect source, runtime, dependencies, policy, and health.
3. Route to the smallest capable topology, agents, skills, and tools.
4. Plan acceptance criteria, safety envelope, ownership, and validation.
5. Execute in isolated scopes; the coding agent performs the work.
6. Test focused, regression, and failure paths.
7. Validate types, security, policy, compatibility, and artifacts.
8. Benchmark a source-bound candidate against a source-bound baseline.
9. Optimize measured bottlenecks without weakening safety.
10. Bind claims and evidence to exact source/build receipts.
11. Reconcile concurrent handoffs and disclose limitations.
12. Publish only through a separately authorized release gate.

### Concurrency and authority

- Never allow two writers in one worktree; give each writing agent an isolated
  worktree and explicit file ownership.
- Read-only research may run concurrently and report findings to the owner.
- Only the integration owner edits shared manifests and lockfiles or reconciles
  overlapping changes.
- A child may drop capabilities but cannot add tools, network, secrets, spend,
  concurrency, namespaces, or delegation depth.
- A lease or claim coordinates ownership; it does not authorize a side effect.
- Darwin, Flywheel, MetaHarness, memory, and neural systems may propose or
  evaluate candidates but cannot self-promote or expand their SafetyEnvelope.
- Bind tests, benchmarks, policy decisions, and release evidence to an exact
  commit or immutable dirty-worktree snapshot.

## Agent Comms (SendMessage-First Coordination)

Named agents coordinate via `SendMessage`, not polling or shared state.

```
Lead (you) ←→ database-schema ←→ api-backend ←→ frontend-ui
              (named agents message each other directly)
```

### Spawning a Coordinated Team

```javascript
// ALL agents in ONE message, each knows WHO to message next
Agent({ prompt: "Make the schema change. SendMessage changed columns to 'api'.",
  subagent_type: "database-schema", name: "db", run_in_background: true })
Agent({ prompt: "Wait for 'db'. Update routes. SendMessage the JSON contract to 'ui'.",
  subagent_type: "api-backend", name: "api", run_in_background: true })
Agent({ prompt: "Wait for 'api'. Update the UI for the new contract.",
  subagent_type: "frontend-ui", name: "ui", run_in_background: true })

// Kick off the pipeline
SendMessage({ to: "db", summary: "Start", message: "[task context]" })
```

### Patterns

| Pattern | Flow | Use When |
|---------|------|----------|
| **Pipeline** | A → B → C → D | Sequential dependencies (feature dev) |
| **Fan-out** | Lead → A, B, C → Lead | Independent parallel work (research) |
| **Supervisor** | Lead ↔ workers | Ongoing coordination (complex refactor) |

### Rules

- ALWAYS name agents — `name: "role"` makes them addressable
- ALWAYS include comms instructions in prompts — who to message, what to send
- Spawn ALL agents in ONE message with `run_in_background: true`
- After spawning, continue independent local work; wait only when a dependency
  genuinely blocks progress
- Do not poll repeatedly — agents message back or complete automatically
- Give every writing agent an isolated worktree and a non-overlapping file scope

## Swarm & Routing

### Config
- **Topology**: hierarchical-mesh (anti-drift)
- **Max Agents**: 15
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

### Agent Routing

| Task | Agents | Topology |
|------|--------|----------|
| Bug fix in one service | that service's agent | none needed |
| Resume parsing or matching | `parsing-nlp` | none needed |
| Tracker feature (DB through UI) | `database-schema`, `api-backend`, `frontend-ui` | pipeline, in that order |
| New analysis field (Python through UI) | `parsing-nlp`, `api-backend`, `frontend-ui` | pipeline, in that order |
| Large design work | `planner` or `architecture`, then service agents | hierarchical |
| Pre-deployment check | `production-validator` | none needed |

### When to Swarm
- **YES**: 3+ files, new features, cross-module refactoring, API changes, security, performance
- **NO**: single file edits, 1-2 line fixes, docs updates, config changes, questions

### 3-Tier Model Routing

| Tier | Handler | Use Cases |
|------|---------|-----------|
| 1 | Agent Booster (WASM) | Simple transforms — skip LLM, use Edit directly |
| 2 | Haiku | Simple tasks, low complexity |
| 3 | Sonnet/Opus | Architecture, security, complex reasoning |

## Memory & Learning

### Before Any Task
```bash
npx @claude-flow/cli@latest memory search --query "[task keywords]" --namespace patterns
npx @claude-flow/cli@latest hooks route --task "[task description]"
```

### After Success
```bash
npx @claude-flow/cli@latest memory store --namespace patterns --key "[name]" --value "[what worked]"
npx @claude-flow/cli@latest hooks post-task --task-id "[id]" --success true --store-results true
```

### MCP Tools (use `ToolSearch("keyword")` to discover)

| Category | Key Tools |
|----------|-----------|
| **Memory** | `memory_store`, `memory_search`, `memory_search_unified` |
| **Bridge** | `memory_import_claude`, `memory_bridge_status` |
| **Swarm** | `swarm_init`, `swarm_status`, `swarm_health` |
| **Agents** | `agent_spawn`, `agent_list`, `agent_status` |
| **Hooks** | `hooks_route`, `hooks_post-task`, `hooks_worker-dispatch` |
| **Security** | `aidefence_scan`, `aidefence_is_safe`, `aidefence_has_pii` |
| **Hive-Mind** | `hive-mind_init`, `hive-mind_consensus`, `hive-mind_spawn` |

### Background Workers

| Worker | When |
|--------|------|
| `audit` | After security changes |
| `optimize` | After performance work |
| `testgaps` | After adding features |
| `map` | Every 5+ file changes |
| `document` | After API changes |

```bash
npx @claude-flow/cli@latest hooks worker dispatch --trigger audit
```

## Agents

Installed in `.claude/agents/`. Prefer the project agents for implementation work.

**Project**: `api-backend`, `frontend-ui`, `parsing-nlp`, `database-schema`
**Planning**: `planner`, `specification`, `pseudocode`, `architecture`, `refinement`
**Testing**: `production-validator`, `tdd-london-swarm`
**Coordination**: `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`
**Consensus**: `byzantine-coordinator`, `crdt-synchronizer`, `gossip-coordinator`, `performance-benchmarker`, `quorum-manager`, `raft-manager`, `security-manager`

Only agents listed here can be used as `subagent_type`. Generic ones like `coder` and `reviewer` are not installed in this project.

## Build & Test

- After code changes, run the typecheck or syntax check for each service you touched (see Commands under Project)
- There is no root `package.json`, and no service has a test script. If you add tests, add the command to this file

## CLI Quick Reference

```bash
npx @claude-flow/cli@latest init --wizard           # Setup
npx @claude-flow/cli@latest swarm init --v3-mode     # Start swarm
npx @claude-flow/cli@latest memory search --query "" # Vector search
npx @claude-flow/cli@latest hooks route --task ""    # Route to agent
npx @claude-flow/cli@latest doctor --fix             # Diagnostics
npx @claude-flow/cli@latest security scan            # Security scan
npx @claude-flow/cli@latest performance benchmark    # Benchmarks
```

26 commands, 140+ subcommands. Use `--help` on any command for details.

## Setup

The `ruflo` MCP server is registered at user scope, so this project has no `.mcp.json`. A first `npx ruflo@latest` run after a new release can take about 40s and exceed Claude Code's 30s limit. If it fails to connect, start Claude Code with `MCP_TIMEOUT=90000 claude`.

```bash
npx ruflo@latest doctor --fix
```

> The background `daemon` is optional. It runs interval workers that each spawn
> a headless `claude` session, so it consumes tokens continuously. Start it only
> if you want those sweeps: `npx ruflo@latest daemon start` (self-stops after 12h
> by default; `--ttl 0` to disable, `daemon status --all` to audit running daemons).

**Agent tool** handles execution (agents, files, code, git). **MCP tools** handle coordination (swarm, memory, hooks). **CLI** is the same via Bash.
