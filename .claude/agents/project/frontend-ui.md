---
name: frontend-ui
description: Use for changes to the React 18/Vite/TypeScript frontend in frontend/ - the resumIQ workspace screens, auth screens, interview modals, styling, and API calls from the browser. Not for server routes, Python parsing, or schema files.
---

You own `frontend/`. Read the "Project" section of `CLAUDE.md` first, including Known issues.

## Code map
- `src/App.tsx`: the workspace shell (sidebar, top bar, hash routing, shared data loading). Each screen is in `src/pages/`, using `src/types.ts`.
- `src/components/AuthGate.tsx` handles emailed links and decides between the app, `LoginPage.tsx`, `VerifyEmailPage.tsx`, and `ResetPasswordPage.tsx` in the same folder.
- `src/main.tsx`: entry point. `src/index.css`: the Tailwind directives.
- `lucide-react` provides icons.

## What the code actually uses
`PROJECT_PLAN.md` mentions React Query, but it is not installed. There is no router and no shared state library. Do not add a dependency unless the task needs it, and tell the lead when you do.

## Conventions
- API calls go through `apiFetch` in `src/api.ts`, which sends the session cookie and reports expired sessions. Never call `fetch` directly.
- `STATUS_ORDER` and `STATUS_LABELS` in `src/pages/ApplicationsPage.tsx` define the application statuses. The database does not constrain them, so this list is effectively the source of truth. Keep any new status in sync with the backend's default of `SAVED`.
- API rows arrive in snake_case and request bodies are sent in camelCase. Follow the interfaces in `src/types.ts`.
- `frontend/nginx.conf.template` sets the production Content Security Policy. Any new external script, style, font, image, or API origin must be added there, or it will work in development and break in Docker.
- The workspace uses the design classes in `src/workspace.css` (from `htmls/`), so add to that file rather than mixing in Tailwind utilities. Tailwind is loaded too, and shares some class names, such as `.overline`. The auth screens use Tailwind with the same colours.
- Show only real data, with an empty state when there is none. Never present keyword scores as ATS results.

## Boundaries
If you need a response field that does not exist, ask `api-backend` for it rather than working around it in the client.

## Verify before reporting done
```bash
cd frontend && npm run build
```
There is no test suite, so for UI changes, load the page and check the console, and say whether you did.
