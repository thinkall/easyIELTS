# easyIELTS

[English](README.md) · [简体中文](README.zh-CN.md)

A web app for **IELTS General Training** preparation across all four skills — Listening, Reading, Writing, and Speaking.

- **Listening & Reading** — auto-scored mock tests with band conversion.
- **Writing** — LLM evaluation (4 criteria + feedback + model answer). Logged-in users can
  pick a premium model from their own **GitHub Copilot** account (Claude Opus, GPT-5.x, …).
- **Speaking** — live oral exam via the **Gemini Live API**, then LLM scoring.
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
GITHUB_MODELS_TOKEN=          # a GitHub token with Models access (shared writing eval)
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

## Using your own GitHub Copilot models (Writing)

1. Go to **/settings → "Connect with device code"** and authorize in your browser.
2. An **Evaluation model** dropdown appears, listing your Copilot models.
3. Pick one (e.g. `claude-opus-4.8`, `gpt-5.5`); Writing evaluation then runs on your account.

Your GitHub token stays in an httpOnly cookie and is exchanged for a Copilot token
**server-side** — it is never exposed to the browser.

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
