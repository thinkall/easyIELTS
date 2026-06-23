# easyIELTS

[简体中文](README.md) · [English](README.en.md)

A web app for **IELTS General Training** preparation across all four skills — Listening, Reading, Writing, and Speaking.

- **Listening & Reading** — auto-scored mock tests with band conversion.
- **Writing** — LLM evaluation (4 criteria + feedback + model answer).
- **Speaking** — live oral exam via the **Gemini Live API**, then LLM scoring.
- **Bring your own AI** — any user can connect their own **GitHub Copilot** account to use
  premium models (Claude Opus, GPT-5.x, …) and/or supply their own **Gemini** key. Your
  models power LLM scoring **and** AI-generated tests/topics across **every** module
  (Listening, Reading, Writing, Speaking) — no app login required.
- No login required: progress is saved in browser **localStorage**. Owner API keys are
  server-only and never sent to the browser.

Built with Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4, behind a custom
Node server (`server.ts`) that also bridges the Speaking WebSocket proxy.

## Quick start (one command)

The launcher scripts check for Node.js (installing it automatically if it's missing or too
old), install dependencies, build, and start the site:

**Windows (PowerShell):**

```powershell
.\start.ps1          # production build + start
.\start.ps1 -Dev     # development server (hot reload)
```

> If PowerShell blocks the script, allow it for this session with:
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

**Linux / macOS:**

```bash
./start.sh           # production build + start
./start.sh --dev     # development server (hot reload)
```

On Windows the scripts install Node.js via **winget**; on Linux/macOS via **nvm**. If
automatic installation isn't possible they print a link to <https://nodejs.org/>. Then open
the printed URL (default **http://localhost:3000**).

To run things manually instead, see [Prerequisites](#prerequisites) and [Run](#run) below.

## Prerequisites

- Node.js 20+ (tested on 24)
- `npm install`

## Configuration

Copy `.env.example` to `.env` (or `.env.local`) and fill in what you need. **All keys are
optional** — unset keys just disable the shared/owner path; users can supply their own keys
in the app at **/settings**.

```bash
# Server-only owner keys (never exposed to the browser)
GITHUB_MODELS_TOKEN=          # a GitHub token with Models access (shared fallback)
GEMINI_API_KEY=               # owner Gemini key (shared speaking proxy)

# Optional overrides (safe defaults applied if unset)
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview

# Server
PORT=3000
HOST=localhost
```

> In development only, if `GITHUB_MODELS_TOKEN` is empty the server falls back to
> `gh auth token` (so a locally-authenticated GitHub CLI works with zero config).

## Run

**Development** (auto-reload):

```bash
npm run dev
```

**Production**:

```bash
npm run build
npm start
```

Then open **http://localhost:3000** (or your `PORT`). Use `PORT` / `HOST` to change the
address, e.g. `PORT=8080 npm run dev`.

> Use the npm scripts — not bare `next dev` / `next start`. The app runs through the custom
> `server.ts` (via `tsx`), which loads `.env` and attaches the Speaking proxy.

## Using your own GitHub Copilot models

Connecting your GitHub Copilot account lets you use premium models across the **whole** app,
not just one skill:

1. Go to **/settings → "Connect with device code"** and authorize in your browser.
2. A **model** dropdown appears, listing your Copilot models.
3. Pick one (e.g. `claude-opus-4.8`, `gpt-5.5`). Your selection is then used **everywhere an
   LLM is involved** — Writing & Speaking evaluation, and generating new Listening / Reading /
   Writing / Speaking tests and topics.

Once connected, requests run on your own (unlimited) Copilot account instead of the
rate-limited shared path. Your GitHub token stays in an httpOnly cookie and is exchanged for
a Copilot token **server-side** — it is never exposed to the browser.

## Routes

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/listening`, `/reading` | Auto-scored mock tests |
| `/reading/generate` | AI-generated original reading test |
| `/writing` | LLM-evaluated writing tasks |
| `/speaking` | Live Gemini speaking exam |
| `/dashboard` | Your attempts & band progress |
| `/settings` | Your API keys + model selection |
| `/connect` | Connect GitHub (device flow) |

## Test, lint, build

```bash
npm run test     # vitest (unit + component)
npm run lint     # eslint
npm run build    # production build
```

## Deploy (free hosting)

easyIELTS needs a **real Node process** — its API routes hold server-side secrets and it runs
a WebSocket proxy for live speaking — so **static hosts like GitHub Pages won't work**. Use a
host that runs a persistent Node server with WebSocket support.

**Render (free, simplest)** — this repo ships a [`render.yaml`](render.yaml) Blueprint:

1. Push the repo to GitHub.
2. In Render: **New → Blueprint**, select the repo, and apply.
3. (Optional) Set `GITHUB_MODELS_TOKEN` / `GEMINI_API_KEY` in the dashboard, or leave them
   unset and have users bring their own keys at **/settings**.

> Free Render services sleep after ~15 min idle, so the first request after a nap is slow.

**Fly.io / Koyeb / Railway / any Docker host** — this repo ships a [`Dockerfile`](Dockerfile):

```bash
fly launch        # detects the Dockerfile; set secrets with: fly secrets set KEY=value
```

**Always set `HOST=0.0.0.0`** (the `render.yaml` and `Dockerfile` already do) so the server
is reachable, and provide secrets as env vars — never commit them.

**Vercel** runs Next.js natively but is serverless, so the custom-server **live speaking**
proxy won't run there; everything else would work.

## HTTPS (required for the microphone)

Browsers only allow microphone access (`getUserMedia`, used by **Speaking**) on a **secure
context** — HTTPS or `localhost`. A public **HTTP** site has the mic **blocked by Chrome**, so
serve it over HTTPS.

If you self-host on a VM with a domain, this repo includes a one-command **Caddy** reverse
proxy (auto Let's Encrypt TLS; it also proxies the speaking WebSocket):

```bash
# DNS must point the domain at the VM, and ports 80 + 443 must be open.
bash start.sh                                            # app on :3000
sudo EASYIELTS_DOMAIN=your.domain.com bash deploy/setup-https.sh
# then open https://your.domain.com  (mic now allowed)
```

See [`deploy/Caddyfile`](deploy/Caddyfile) / [`deploy/setup-https.sh`](deploy/setup-https.sh).
Managed hosts (Render, Fly.io, …) already give you HTTPS, so the mic works there out of the box.

> Quick local test without TLS: Chrome's `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
> can whitelist a specific `http://host:3000` origin — for your own testing only, not for users.

