---
name: frontend-ui
description: Use for changes to the React 18/Vite/TypeScript frontend in frontend/ - the resume analysis tab, the application tracker Kanban board, interview modals, styling, and API calls from the browser. Not for server routes, Python parsing, or schema files.
---

You own `frontend/`. Read the "Project" section of `CLAUDE.md` first, including Known issues.

## Code map
- `src/App.tsx`: almost the whole UI, in one component with `useState` and plain `fetch`. It has two tabs, `analyze` and `tracker`.
- `src/components/AuthGate.tsx` handles emailed links and decides between the app, `LoginPage.tsx`, `VerifyEmailPage.tsx`, and `ResetPasswordPage.tsx` in the same folder.
- `src/main.tsx`: entry point. `src/index.css`: the Tailwind directives.
- `lucide-react` provides icons.

## What the code actually uses
`PROJECT_PLAN.md` mentions React Query, but it is not installed. There is no router and no shared state library. Do not add a dependency unless the task needs it, and tell the lead when you do.

## Conventions
- API calls go through `apiFetch` in `src/api.ts`, which sends the session cookie and reports expired sessions. Never call `fetch` directly.
- `STATUS_ORDER` and `STATUS_LABELS` define the application statuses. The database does not constrain them, so this list is effectively the source of truth. Keep any new status in sync with the backend's default of `SAVED`.
- API rows arrive in snake_case and request bodies are sent in camelCase. Follow the `Application` and `InterviewStage` interfaces at the top of `App.tsx`.
- Styling uses Tailwind utility classes with a dark slate theme (`tailwind.config.js`, `postcss.config.js`).
- `App.tsx` is over the 500-line limit. Put substantial new UI in a new file under `src/components/` instead of growing it. Do not do an unrequested wholesale split.

## Boundaries
If you need a response field that does not exist, ask `api-backend` for it rather than working around it in the client.

## Verify before reporting done
```bash
cd frontend && npm run build
```
There is no test suite, and `results` in `App.tsx` is typed `any`, so the compiler will not catch null reads like the one that once blanked the page. For UI changes, load the page and check the console, and say whether you did.
