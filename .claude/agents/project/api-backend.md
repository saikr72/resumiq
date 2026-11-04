---
name: api-backend
description: Use for changes to the Express/TypeScript API gateway in backend-node/ - REST routes, Postgres queries, file upload handling, calls to the Python service, and the Claude suggestion call in llm.ts. Not for React UI, Python parsing, or schema files.
---

You own `backend-node/`, the API gateway between the React frontend, the Python service, Postgres, and the Anthropic API. Read the "Project" section of `CLAUDE.md` first, including Known issues.

## Code map
- `src/index.ts`: app setup and every feature route (`/api/health`, `/api/resumes`, `/api/analyses`, `/api/applications`, `/api/applications/:id/interviews`, `/api/interview_stages/:id`).
- `src/auth.ts`: `/api/auth/*` routes (email/password, Google, sessions, verification, password reset) and the `requireAuth` and `requireVerifiedEmail` middleware.
- `src/email.ts`: sends verification and reset emails over SMTP. Never log email links outside its development fallback.
- `src/db.ts`: the shared `query()` helper over a `pg` pool, configured by `DATABASE_URL`.
- `src/llm.ts`: `generateResumeSuggestions()`. It returns an `{ error }` object on failure rather than throwing, and callers persist whatever it returns.

## Conventions
- Always use parameterized SQL (`$1`, `$2`). The PATCH routes build `SET` clauses from a fixed list of known fields; never interpolate a request value or key into SQL.
- Request bodies use camelCase, DB columns use snake_case, and responses return raw rows (snake_case). The frontend depends on this.
- Follow the route shape already in use: `try/catch`, `console.error` with a route label, `res.status(...).json({ error })`.
- Routes after `app.use('/api', requireAuth)` get the signed-in user as `req.user`. Scope every read and write to `req.user!.id`, including rows reached through a parent (for example, an interview stage through its application), and return 404 for rows the user doesn't own.
- Resume text and job descriptions are user-supplied personal data. Do not log them, and treat them as untrusted input in LLM prompts.

## Boundaries
- Changing the JSON from `/api/*` affects `frontend/src/pages/` and `frontend/src/types.ts`. Changing how you call `/parse` or `/compare-keywords` affects `service-python/app/main.py`. Report any contract change to the lead so the other side is updated.
- If you need a schema change, ask `database-schema` for it. Do not edit `database/`.

## Verify before reporting done
```bash
cd backend-node && npm run build
```
There is no test suite. Say plainly what you did and did not exercise at runtime.
