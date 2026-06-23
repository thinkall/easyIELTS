# Admin page for shared credentials — design

## Goal

Add a password-gated **admin page** where the site owner can, for **all** users:

1. **Set / unset a shared Gemini API key.**
2. **Connect / disconnect a server-side shared GitHub Copilot account** (device flow). Once
   connected, every visitor can use the shared Copilot for LLM scoring and test/topic
   generation, without connecting their own.

The existing **per-user** "Connect GitHub with a device code" on `/settings` is unchanged — it
remains personal (stored in the per-browser `eielts_gh` httpOnly cookie).

## Decisions (from brainstorming)

- **Admin auth:** `ADMIN_PASSWORD` env var. Login sets an httpOnly admin-session cookie. If
  `ADMIN_PASSWORD` is unset, the admin page/API is disabled.
- **Storage:** persist to the **`.env` file** (the one the server already loads) AND mirror to
  `process.env` live, so changes apply immediately without a restart and survive restarts.
  - Shared Gemini key reuses the existing **`GEMINI_API_KEY`** (all read sites already read
    `process.env.GEMINI_API_KEY` at request time → zero new wiring).
  - Shared Copilot token is a new **`EASYIELTS_SHARED_COPILOT_TOKEN`** (OAuth token from the
    device flow).
- **Precedence:** a user's **own** credential always wins; the shared admin credential is the
  **fallback** for users who haven't connected/entered their own.
- **Revoke:** "Disconnect"/"Unset" removes the value from `.env` + `process.env` so the app
  stops using it immediately (the Copilot token also expires on its own). Fully revoking the
  GitHub grant is done manually at github.com/settings (device-flow app is a public client
  with no secret, so the server can't revoke it).

## Components

### `src/server/env-file.ts` (server-only; used only by admin routes)
- `upsertEnvVar(key, value)` and `removeEnvVar(key)`.
- Targets the existing env file: `.env.local` if present, else `.env` (create `.env` if
  neither exists).
- Preserves other lines/comments; updates in place or appends; mirrors the change into
  `process.env`.

### `src/server/admin-auth.ts` (server-only)
- `isAdminConfigured()` → `!!process.env.ADMIN_PASSWORD`.
- `verifyAdminPassword(pw)` → constant-time compare.
- Cookie is **stateless**: value = `HMAC-SHA256(ADMIN_PASSWORD, "easyielts-admin")` hex;
  `isValidAdminCookie(value)` recomputes and constant-time-compares. Cookie name
  `eielts_admin`, httpOnly.

### `src/server/shared-credentials.ts` (server-only)
- `getSharedCopilotToken()` → `process.env.EASYIELTS_SHARED_COPILOT_TOKEN` (live).
- `getSharedGeminiKey()` → `process.env.GEMINI_API_KEY` (live).
- `sharedCredentialStatus()` → `{ copilotConnected, geminiSet, geminiHint }` (masked hint
  only; never returns raw secrets).

### LLM router change — `resolveChatJson` (`src/server/llm-router.ts`)
With `cookieToken` (user) and `shared = getSharedCopilotToken()`:
1. **Vendor-prefixed model** (`openai/...`) → GitHub Models path (body/cookie token, else
   rate-limited owner token), as today.
2. **Bare / no model** → prefer Copilot: `copilotOauth = cookieToken ?? shared`. If present,
   run Copilot with the requested bare id, or `pickDefaultCopilotModel(copilotOauth)` when no
   model was given.
3. **No Copilot available:** a bare *premium* id with nobody connected → 401 (message mentions
   the admin can connect a shared account); otherwise no model → rate-limited owner GitHub
   Models, as today.

User cookie always takes precedence over the shared token. When `EASYIELTS_SHARED_COPILOT_TOKEN`
is unset, behaviour is identical to today (existing tests unaffected).

### Admin API routes — `src/app/api/admin/**` (all gated by `isValidAdminCookie`, except login)
- `POST /api/admin/login` `{password}` → set `eielts_admin` cookie or 401.
- `POST /api/admin/logout` → clear cookie.
- `GET  /api/admin/status` → `{ adminConfigured, authenticated, copilot:{connected},
  gemini:{set, hint} }`.
- `POST /api/admin/gemini` `{key}` → upsert `GEMINI_API_KEY`; `DELETE` → remove it.
- `POST /api/admin/copilot/start` → device code (stored in httpOnly `eielts_admin_ghdev`
  cookie, mirroring the user flow).
- `POST /api/admin/copilot/poll` → on `connected`, upsert `EASYIELTS_SHARED_COPILOT_TOKEN`.
- `POST /api/admin/copilot/disconnect` → remove `EASYIELTS_SHARED_COPILOT_TOKEN`.

### Admin UI — `src/app/admin/page.tsx` + `src/components/admin/AdminPanel.tsx`
- Not in the main nav (accessed by URL). Login form → on success show:
  - **Shared GitHub Copilot:** status + Connect (device code) / Disconnect.
  - **Shared Gemini key:** masked status + Set (input) / Unset.
  - Logout.

### Env docs — `.env.example` + README
- Add `ADMIN_PASSWORD=` (enables the admin page) and a documented, admin-managed
  `EASYIELTS_SHARED_COPILOT_TOKEN=` (leave blank).

## Security

- Secrets are written to `.env` (gitignored) on disk, only by the admin-password-gated routes,
  and never returned to the browser (status endpoints expose booleans + a masked hint only).
- Admin session cookie is httpOnly, derived from `ADMIN_PASSWORD` via HMAC, constant-time
  validated. No `ADMIN_PASSWORD` → admin disabled.

## Testing (TDD)

- `env-file`: upsert inserts/updates preserving other lines; remove deletes; both mirror
  `process.env`; targets `.env.local` over `.env` (temp-dir fixtures).
- `admin-auth`: configured/not, verify password, cookie make/validate (good + tampered).
- `llm-router`: no cookie + shared token → Copilot via shared; user cookie still wins; unset
  shared → unchanged; bare premium + nothing connected → 401.
- Admin routes: login success/failure, gating (401 without cookie), gemini set/unset writes
  env, copilot disconnect removes env.
- Reset module/env state between tests (`vi.stubEnv`, existing copilot cache resets).
