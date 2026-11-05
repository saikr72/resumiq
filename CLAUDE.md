# Resume Intelligence Platform — Claude Code Configuration

## Project

Analyzes resumes against job descriptions (ATS keyword match plus Claude-generated suggestions) and tracks job applications and interviews. `PROJECT_PLAN.md` is the target design and describes more than exists today; trust the code for current behaviour.

| Path | Stack | Port | Agent |
|------|-------|------|-------|
| `frontend/` | React 18, Vite, TypeScript | 3000 | `frontend-ui` |
| `backend-node/` | Express, TypeScript, `pg`, Anthropic SDK | 5000 | `api-backend` |
| `service-python/` | FastAPI, pdfplumber, python-docx | 8000 (not published by Docker) | `parsing-nlp` |
| `database/` | PostgreSQL on Supabase, used as a plain database through `pg` with raw SQL. Optional local pgvector container with `COMPOSE_PROFILES=local-db` | 5434 on localhost for the local container | `database-schema` |

**Frontend:** `frontend/src/App.tsx` is the workspace shell with hash routing, and each screen is in `src/pages/`. The visual design comes from `htmls/`, and `src/workspace.css` is its stylesheet plus additions at the end.

**Supabase:** it is the database only. Login is ours, and the app doesn't use the Supabase client or Data API. Tables are protected from that public API by Row Level Security with no policies, plus revoked `anon` and `authenticated` access. Every new table must enable RLS. The backend connects as the table owner, so it is unaffected.

**Request flow:** the browser calls `backend-node`, which sends uploads to `service-python` (`/parse`, `/score`), calls Claude (`src/llm.ts`), and stores results in Postgres. The Python service has no database access.

**Environment variables (backend):** `PORT`, `DATABASE_URL`, `PYTHON_SERVICE_URL`, `ANTHROPIC_API_KEY`, `FRONTEND_ORIGIN` (default `http://localhost:3000`), `GOOGLE_CLIENT_ID` (the Google button is hidden when unset), `COOKIE_SECURE` (defaults to on when `NODE_ENV=production`), `NODE_ENV`, `TRUST_PROXY` (number of proxies in front of the API), and `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`. `DATABASE_SSL=true` encrypts the database connection, and `DATABASE_CA_CERT` also verifies the server. Docker Compose requires `DATABASE_URL` (plus `POSTGRES_PASSWORD` for the local container), and takes `VITE_API_URL` (build time) and `API_ORIGIN` (allowed by the frontend's Content Security Policy in `frontend/nginx.conf.template`). Without `SMTP_HOST`, email links are printed to the backend log, unless `NODE_ENV=production`, when they are not sent or logged. Under Docker, `backend-node/.env` is not used: Compose takes these from the shell or a root `.env` file, and without `ANTHROPIC_API_KEY` AI suggestions fail.

**Authentication:** `backend-node/src/auth.ts` handles email/password and Google sign-in. Sessions are random tokens in an `httpOnly` cookie, stored hashed in the `sessions` table. Every `/api` route except `/api/health` and `/api/auth/*` requires a session and a verified email, and each route must scope its queries to `req.user.id`. Verification and reset links (`src/email.ts`) are single-use, stored hashed in `email_tokens`, and carry the token in the URL fragment. Linking Google to an unverified password account removes the password and ends that account's sessions, because its owner hasn't proved control of the email; a verified account keeps both.

### Commands

```bash
docker compose --env-file .env.local up --build   # Full stack using the database in DATABASE_URL; the frontend is at http://localhost:3000
cd backend-node && npm run db:setup   # Applies the schema and all migrations to DATABASE_URL; safe to repeat

# Typecheck and build
cd backend-node && npm run build
cd frontend && npm run build

# Python syntax check
cd service-python && .venv/bin/python -m compileall -q app

# Python tests
cd service-python && .venv/bin/python -m unittest discover -s tests
```

Dev servers: `npm run dev` in `backend-node/` and `frontend/`, and `.venv/bin/python -m uvicorn app.main:app --port 8000` in `service-python/`. To rebuild the venv, use the Python version from `service-python/Dockerfile`: `uv venv --python 3.11 .venv && uv pip install --python .venv/bin/python -r requirements.txt`.

The only automated tests cover skill matching and match scoring in `service-python/tests/`. The backend and frontend have none, and no linter is configured. Report what was actually run rather than implying coverage.

### Working on this repo

- For agents that write in parallel, use a separate git worktree or keep each one in its own service directory.
- For end-to-end checks, use a disposable database rather than the one in `backend-node/.env`. Set `DATABASE_URL` in the environment, which takes priority over `.env`.
- Cross-service changes: the API JSON is a contract between `backend-node/src/index.ts` and `frontend/src/pages/`, and the Python response fields are a contract between `service-python/app/main.py` and `backend-node`. Update both sides in the same task.
- Schema changes go in both `database/schema.sql` and `database/schema_tracker.sql`, plus a new numbered file in `database/migrations/` for existing databases. Nothing applies migrations automatically; run them with `psql`.
- Resumes contain personal data. Do not log their text or commit sample resumes from real people.

### Known issues

Verified against the code. Do not fix these as a side effect of other work; fix one only when asked, then remove it from this list.

**Environment**
- `backend-node/start`, `stop`, and `query` are stray one-line files containing only `postgresql-x64-17`.

**Frontend**
- Application statuses (`SAVED`, `APPLIED`, `SCREENING`, `INTERVIEWING`, `OFFER`, `REJECTED`) are defined only in the frontend, with no database constraint, and the API accepts any value.
- Scheduling an interview closes the modal, so the new round is not shown until it is reopened. Displayed interview dates omit the year.
- The Resume Builder has no backend: it holds a brief in the browser and says so. "Explore Pro" is a placeholder.
- Match scores are estimates. The UI must not present them as real ATS results, and must not show sample data from `htmls/`.

**Backend**
- `POST /api/applications/:id/interviews` ignores the `status` sent by the form, so new rounds are always `SCHEDULED`.
- Interview rows created before the timezone fix may hold shifted times. They have not been corrected.
- Client errors return 500 for missing required fields and malformed UUIDs.
- Signed-in users can't change their password or email address, other than through the reset email.
- If someone registers with another person's address and that person clicks the verification link, the registrant's password stays valid. The email warns against clicking unexpected links, and a password reset removes the access.
- The Python service has no authentication of its own. Docker keeps it off the host network, so keep it that way in any deployment.
- Rate limits are stored in memory per process, so they reset on restart and aren't shared between instances.
- HTTPS isn't set up. A deployment needs a TLS-terminating proxy, with `TRUST_PROXY` set and `NODE_ENV=production`.
- There is no data-retention policy: resumes are kept until the user deletes them or their account.
- Uploads are held in memory while processed (10 MB per file). The `file_path` saved to the DB is a placeholder; the file is never stored.
- When `src/llm.ts` fails, it returns `{ error }` and the upload still returns 201.
- Analyses with `scoring_version` 1 stored only a keyword score, with `0` as a placeholder for `semantic_score` and `experience_score`. The API returns those two as `null` for these rows, so they must never be displayed as measured.

**Python service**
- Skill matching can still misfire on everyday words: `Express` matches "express interest", and a capitalized `Go` matches sentences like "Go live".
- `spacy` and `scikit-learn` are pinned but unused. The `embedding` columns are unused too: scoring compares texts directly with `fastembed` (384 dimensions) and stores no vectors.
- The semantic scale in `app/nlp/semantic.py` was set from about ten made-up resume and job pairs, not real data, so scores can be too high or low on real documents. A strong match can reach 100.
- Experience scoring reads date ranges and phrases such as `5+ years of experience` with regular expressions, so unusual formats are missed and show as not available. It doesn't check which field the years were in, apart from discounting them when the semantic score is low.

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
- There is no root `package.json`, and only `service-python` has tests. If you add tests elsewhere, add the command to this file

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
