<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# easyIELTS — project guide for agents

IELTS **General Training** practice app: **Next.js 16 (App Router) + React 19 + TypeScript +
Tailwind v4**, served by a **custom Node server** (`server.ts`, run via `tsx`) that also hosts
a **WebSocket proxy** for live speaking. Four skills: Listening/Reading auto-scored;
Writing/Speaking LLM-evaluated. No app login — progress lives in browser `localStorage`;
users may bring their own GitHub Copilot + Gemini keys at `/settings`.

## Run / build / test

- **Dev:** `npm run dev` · **Prod:** `npm run build` then `npm start`. **Never** use bare
  `next dev` / `next start` — the app must run through `server.ts` (it loads `.env` and
  attaches the speaking proxy).
- One-command launchers: `./start.sh` (Linux/macOS, installs Node via nvm) and `.\start.ps1`
  (Windows, via winget); both accept `--dev` / `-Dev`.
- **Before claiming done, all three must pass:** `npm run test` (vitest), `npm run lint`
  (eslint), `npm run build`. Follow **TDD** (red → green → refactor): write the failing test
  first.

## LLM access — the rule that matters most

All structured-JSON LLM calls from API routes go through **`resolveChatJson` in
`src/server/llm-router.ts`**. Don't call `chatJson` / `chatJsonCopilot` directly from a route
— use the router so model routing, auth, and rate-limits stay consistent.

Two backends:

- **GitHub Copilot** (`api.githubcopilot.com`) — **bare** model ids (`gpt-5.5`,
  `claude-opus-4.8`); the user's own, effectively unlimited account via device-flow. The
  OAuth token lives in the httpOnly **`eielts_gh`** cookie and is exchanged **server-side**
  for a short-lived Copilot token (never exposed to the browser).
- **GitHub Models** (`models.github.ai`) — **vendor-prefixed** ids (`openai/gpt-5`); the
  shared/owner free tier, which is **rate-limited and 429s easily**.

`resolveChatJson` routing: a connected user (cookie present) with no model or a bare id →
**Copilot** (default model from `pickDefaultCopilotModel`, prefers `gpt-4o`); a vendor-prefixed
id → GitHub Models; anonymous → shared owner token (`resolveServerToken`, rate-limited) or the
user's own token. **Default connected users to Copilot** — that is how we avoid GitHub Models
429s. The frontend sends the chosen model as `settings.model` (Settings dropdown, populated
from `/api/models`): bare id = Copilot, slash id = GitHub Models.

## `server-only` constraint (easy to break)

The custom server runs under `tsx` in plain Node, where `import "server-only"` **throws**.
Anything reachable from `server.ts` — i.e. `src/server/speaking-proxy.ts` and everything under
`src/lib/speaking/` — must **NOT** import `server-only` (directly or transitively) and should
read `process.env` directly. API **route handlers** (and modules used only by them: `cookies`,
`github-models`, `copilot-*`, `github-token`, `rate-limit`, `llm-router`, …) may freely use
`server-only`.

## Secrets

Owner keys (`GITHUB_MODELS_TOKEN`, `GEMINI_API_KEY`) are **server-only** and never sent to the
browser; `.env` is gitignored. Users' own keys live in `localStorage` and are passed
per-request. Never commit or log secrets. In production there is **no** `gh auth token`
fallback (dev-only), so the shared path needs a real `GITHUB_MODELS_TOKEN` or users connect
their own accounts.

## Gemini specifics

- **Live speaking** (`speaking-proxy` + `src/lib/speaking/gemini-live.ts`): the session stays
  silent until a kickoff turn is sent; use `realtimeInput.audio` (the deprecated `mediaChunks`
  causes close code 1007); wrap PCM L16 output in a WAV header; `resume()` any `AudioContext`
  created after an `await` (it starts suspended).
- **Speaking eval** (`src/server/gemini-eval.ts`): multimodal `generateContent` over the
  candidate's WAV for real pronunciation; lite-first model list (`gemini-2.5-flash-lite`);
  silence-compress and cap audio length.
- **Listening TTS** (`src/server/listening-tts.ts`): `gemini-2.5-flash-preview-tts`
  multi-speaker (≤2 distinct voices, does not speak the speaker labels); >2 speakers or a
  monologue → single-voice narration.

## Testing external APIs

Route tests stub global `fetch`. The Copilot **token and model catalog are cached at module
scope per OAuth token**, so reset them between cases with `_resetCopilotTokenCache()` and
`_resetCopilotModelsCache()` (plus `_resetRateLimitStore()`) — otherwise cached state leaks
across tests. For GitHub-Models-fallback tests, supply a `bodyToken` so a token resolves
(env is parsed once at import, so `vi.stubEnv` won't change `env.GITHUB_MODELS_TOKEN`).

## UI copy

Keep the product **goal-agnostic**: show band scores and the 0–9 scale, but don't frame the UI
around a specific target (e.g. no "Band 7" goal language). Internal scoring/calibration prompts
may still reference band descriptors.

## Deploy

Needs a **persistent Node process + WebSocket**, so **not** GitHub Pages / static hosts, and
not plain serverless (Vercel can't run the speaking proxy). Use **Render** (`render.yaml`) or
any **Docker** host (`Dockerfile`); always set **`HOST=0.0.0.0`** and provide secrets as env
vars.

## Layout

- `server.ts` — custom HTTP server + `attachSpeakingProxy`.
- `src/app/**` — App Router pages and `api/**` route handlers.
- `src/server/**` — server-side integrations (LLM router, Copilot / GitHub Models, Gemini eval,
  listening TTS, speaking proxy, cookies, rate-limit, token resolution).
- `src/lib/**` — pure domain logic (`content` generators, `ielts` band math, `speaking`,
  `scoring`, `storage`, `settings`, …). Modules under `speaking/` are also safe for the custom
  server (no `server-only`).
- `src/components/**` — UI: `layout/` (nav shell), `ui/` (design system), per-skill runners and
  `Generate*` components.
- `tests/**` — vitest. `public/audio` + `content/` — committed seed assets.

