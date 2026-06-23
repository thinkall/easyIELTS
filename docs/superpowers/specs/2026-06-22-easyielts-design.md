# easyIELTS — Design Specification

**Date:** 2026-06-22
**Status:** Approved (brainstorming) — pending implementation plan
**Repo:** `thinkall/easyIELTS`

## 1. Purpose & Goals

A web app for preparing for **IELTS General Training (GT)**, targeting a personal
goal of **Band 7+ in all four skills** (Listening, Reading, Writing, Speaking).

- **Listening & Reading:** full practice tests with **instant automatic scoring** and
  raw→band conversion.
- **Writing & Speaking:** **LLM-based evaluation** against the official IELTS band
  descriptors.
- **Speaking** additionally offers a **live spoken mock exam** via the Gemini Live API,
  with an AI examiner.
- The dashboard is **Band-7-oriented**: it always shows distance-to-7 per skill and,
  for Writing/Speaking, which criterion is holding the score back.

### Success criteria

1. A user can take a Listening and a Reading test end-to-end and receive a correct
   raw score and band score (verified against the official conversion tables).
2. A user can submit Writing Task 1 + Task 2 and receive per-criterion band scores and
   actionable feedback.
3. A user can complete a live Speaking mock with an AI examiner and receive a band
   score with feedback.
4. Owner-supplied API keys are **never** exposed to the browser.
5. Anonymous users' progress persists in `localStorage`; logged-in users' progress
   persists server-side.
6. The repository contains **no copyrighted third-party exam content**.

## 2. Audience, Deployment & Non-Goals

- **Audience:** Publicly deployed — anyone can use it. Built personal-first but
  multi-user-ready from day one.
- **Auth:** Optional. **"Sign in with GitHub"** (NextAuth GitHub provider) — this also
  serves as "connect your own GitHub Copilot/Models" for LLM calls.
- **Anonymous users:** all data in browser `localStorage`.
- **Logged-in users:** data in a server database.
- **Deployment target:** a **Node server host** (e.g., Render/Railway/Fly/VM), because
  the live-speaking audio proxy needs a long-lived WebSocket server (not pure
  serverless).

### Non-goals (YAGNI)

- No Academic-module-specific features (GT only; Listening/Speaking are shared anyway).
- No payment/billing, no social features, no mobile native apps.
- No fine-tuned models — prompt engineering + structured output only.
- No redistribution of Cambridge or other copyrighted materials (see §11).

## 3. Tech Stack

| Concern | Choice |
|---|---|
| Framework | **Next.js (App Router) + TypeScript** |
| Server | **Custom Node server** (`server.ts`) wrapping Next.js to host the speaking WebSocket proxy |
| UI | React + **Tailwind CSS** |
| DB | **SQLite via Prisma** (file-based); schema is Postgres-compatible for scale |
| Auth | **NextAuth** with GitHub OAuth provider |
| LLM | **GitHub Models API** (`https://models.github.ai/inference`, OpenAI-compatible) |
| Live speech | **Google Gemini Live API** (`@google/genai`), model `gemini-3.1-flash-live-preview` |
| TTS | **Gemini TTS** for listening audio generation |
| Audio (browser) | Web Audio API + **AudioWorklet** (capture 16 kHz PCM, play 24 kHz PCM) |
| Testing | **Vitest** (scoring engine + band tables are the priority) |
| PDF viewing | **PDF.js** (local import tool only) |

## 4. Architecture

```
Browser (Next.js React UI)
  ├─ Test modules: Listening · Reading · Writing · Speaking
  ├─ Dashboard · Library · Settings · Auth
  ├─ Audio: AudioWorklet (mic capture + examiner playback)
  └─ Storage: LocalStorageAdapter (anonymous)
        │  fetch (REST)  +  WebSocket (speaking audio only — never keys)
        ▼
Next.js backend (API routes + custom server)        🔒 holds all owner keys
  ├─ /api/llm/evaluate         → GitHub Models (writing/speaking scoring)
  ├─ /api/content/generate     → GitHub Models (original test generation)
  ├─ /api/tts                  → Gemini TTS (listening audio)
  ├─ /ws/speaking              → WebSocket proxy ↔ Gemini Live
  ├─ /api/attempts             → DB (logged-in users)
  └─ /api/auth/*               → NextAuth (GitHub OAuth)
        ▼
Storage                         External AI (via backend only)
  ├─ SQLite/Prisma (logged-in)  ├─ GitHub Models API
  ├─ localStorage (anonymous)   ├─ Gemini Live API
  ├─ content/ (committed tests) └─ Gemini TTS
  └─ materials/ (gitignored, user's own imports)
```

### 4.1 Key-security model (hard requirement)

- **Owner pre-configured keys** (`GITHUB_MODELS_TOKEN`, `GEMINI_API_KEY`) live **only**
  in server environment variables. They are never sent to the client and cannot be
  retrieved by users.
- All requests that use owner keys are **proxied through the backend**. For the live
  speaking test, the browser streams audio to **our** WebSocket server, which holds the
  Gemini key and relays frames to Gemini. **Not even an ephemeral token** is handed to
  the client on the owner-key path.
- **User-supplied keys** (optional): a user may enter their own Gemini Live key and/or
  connect their own GitHub account. User keys are used **per-request** and stored only
  in the user's own browser (`localStorage`); they are **not** persisted in our DB. When
  a user uses their own Gemini key, the browser may connect to Gemini directly (their
  key, their choice) to save our server cost.
- Cost control: owner-key usage is rate-limited (per session/IP) and the live speaking
  session has a hard time cap.

### 4.2 Storage abstraction

A single interface with two implementations keeps anonymous and logged-in flows
identical to the rest of the app:

```ts
interface StorageAdapter {
  listAttempts(filter?): Promise<Attempt[]>;
  saveAttempt(a: Attempt): Promise<void>;
  getStats(): Promise<SkillStats>;
  getSettings(): Promise<UserSettings>;
  saveSettings(s: UserSettings): Promise<void>;
}
```

- `LocalStorageAdapter` — anonymous; persists to `localStorage`.
- `ApiAdapter` — logged-in; calls `/api/attempts` etc., backed by Prisma/SQLite.

The app selects the adapter based on auth state. `Attempt` has the same shape in both.

## 5. IELTS GT Reference Data (authoritative — drives correctness)

> Sources: ielts.org "understanding-ielts-scoring", ieltsbuddy.com/ielts-scores.html,
> magoosh.com IELTS guides, ieltsliz.com. Tables are industry-standard; official notes
> that exact marks "vary slightly from version to version."

### 5.1 Format

| Skill | Structure | Questions | Time |
|---|---|---|---|
| Listening | 4 parts (P1 social dialogue → P4 academic lecture), audio **plays once** | 40 | ~30 min + (paper) 10 min transfer |
| Reading (GT) | 3 sections: **Social Survival**, **Workplace**, **General Reading** | 40 | 60 min |
| Writing (GT) | Task 1 **letter** (≥150w, formal/semi/informal), Task 2 **essay** (≥250w) | 2 | 60 min (≈20 + 40) |
| Speaking | Part 1 interview · Part 2 cue-card long-turn (1-min prep, ≤2-min talk) · Part 3 discussion | 3 parts | 11–14 min |

### 5.2 Band conversion — Listening (out of 40)

| Raw | Band | Raw | Band |
|---|---|---|---|
| 39–40 | 9 | 23–25 | 6 |
| 37–38 | 8.5 | 18–22 | 5.5 |
| 35–36 | 8 | 16–17 | 5 |
| 32–34 | 7.5 | 13–15 | 4.5 |
| **30–31** | **7** | 11–12 | 4 |
| 26–29 | 6.5 | 8–10 | 3.5 |

**Band 7 Listening = 30–31 correct.**

### 5.3 Band conversion — GT Reading (out of 40)

> GT Reading needs **more** correct answers than Academic for the same band.

| Raw | Band | Raw | Band |
|---|---|---|---|
| 40 | 9 | 30–31 | 6 |
| 39 | 8.5 | 27–29 | 5.5 |
| 37–38 | 8 | 23–26 | 5 |
| 36 | 7.5 | 19–22 | 4.5 |
| **34–35** | **7** | 15–18 | 4 |
| 32–33 | 6.5 | 12–14 | 3.5 |

**Band 7 GT Reading = 34–35 correct.**

### 5.4 Aggregation & rounding

- **Overall** = average(Listening, Reading, Writing, Speaking).
- **Writing band** = `(Task1 + 2 × Task2) / 3` (Task 2 is double-weighted).
- **Writing/Speaking per-skill** = average of their 4 criteria (equal weight).
- **Rounding rule:** averages ending in **.25 round up to the next half band**; **.75
  round up to the next whole band** (i.e., round to nearest 0.5, ties up). Applies to
  the per-skill writing/speaking average and the overall average.

### 5.5 Question-type taxonomy (shared engine)

One discriminated union covers all reading + listening formats:

`single_choice`, `multiple_choice` (choose N), `true_false_notgiven`,
`yes_no_notgiven`, `matching_headings`, `matching_info`, `matching_features`,
`matching_sentence_endings`, `sentence_completion`, `summary_completion`,
`note_completion`, `table_completion`, `flowchart_completion`, `form_completion`,
`diagram_label`, `map_label`, `short_answer`.

Each `Question`: `{ id, type, prompt, options?, answers: AcceptedAnswer[], wordLimit?, points }`.
`AcceptedAnswer` supports multiple accepted variants. Word-limit answers exceeding the
limit are marked **wrong**.

### 5.6 Band-7 descriptor cues (for Writing/Speaking prompts & feedback)

- **Writing/Speaking GRA Band 7:** ~50%+ of sentences error-free; varied complex
  structures; errors minor.
- **Lexical Band 7:** less-common vocabulary, collocation/idiom awareness; minor errors
  tolerated.
- **Coherence/Fluency Band 7:** clear logical progression; cohesive devices/discourse
  markers used well (some over/under-use ok).
- **Task Response/Achievement Band 7:** all parts addressed, clear position; GT Task 1
  covers all 3 bullets with correct register; development may be slightly general.

These cues are embedded in the evaluation system prompts and surfaced in feedback.

## 6. Skill Modules

All four reuse a common **test shell** (top bar with timer + Band-7 target, body, bottom
question navigator / submit).

### 6.1 Listening

- 4 parts, 40 questions. Audio **plays once** (single play; configurable "exam mode"
  disables replay/seek). Questions are presented alongside a synced timeline.
- On submit: objective scoring (see §7) → raw/40 → band (§5.2) → per-question review with
  correct answers and audio-segment references.

### 6.2 Reading

- 3 GT sections, 60-min timer. Split view: passage (left) + question panel (right).
- On submit: objective scoring → raw/40 → band (§5.3) → per-question review.

### 6.3 Writing

- Task 1 (letter) + Task 2 (essay), 60-min timer, live word counter and min-word
  warnings.
- On submit: `/api/llm/evaluate` (GitHub Models, `response_format: json_schema`) returns
  structured evaluation per task across the 4 criteria + task band + feedback + corrected
  examples + model answer. Writing band computed via `(T1 + 2·T2)/3` (§5.4).

**Model selection (premium Copilot models).** Logged-in users can pick the evaluation
model from a dropdown (`/settings`), populated from `GET /api/models`. The device-flow
OAuth token (httpOnly cookie `eielts_gh`, obtained via the Copilot-entitled client id
`01ab8ac9400c4e429b23`) is exchanged **server-side** at `copilot_internal/v2/token` for a
short-lived Copilot token; the request runs against the user's own GitHub Copilot account
(`api[.enterprise].githubcopilot.com`). Model ids without a vendor `/` prefix (e.g.
`claude-opus-4.8`, `gpt-5.5`) route to the Copilot API; OpenAI models with structured-output
support use `/chat/completions`, newer GPT-5.x models use `/responses`. Because some vendors
(Anthropic/Gemini) don't enforce `response_format`, the required JSON shape is also embedded
in the prompt. Slash-prefixed ids (e.g. `openai/gpt-4.1`) and the no-selection default
continue to use the shared GitHub Models path. The Copilot/OAuth token is never exposed to
the browser (§4.1).

**Writing evaluation JSON schema (per task):**

```json
{
  "criteria": {
    "taskResponse": 7.0,           // "taskAchievement" for Task 1
    "coherenceCohesion": 7.0,
    "lexicalResource": 6.5,
    "grammaticalRangeAccuracy": 7.0
  },
  "taskBand": 7.0,
  "wordCount": 268,
  "feedback": {
    "strengths": ["..."],
    "improvements": ["..."],
    "correctedExamples": [{ "original": "...", "corrected": "...", "note": "..." }]
  },
  "modelAnswer": "..."
}
```

### 6.4 Speaking

- **Live mock** via Gemini Live through the backend WS proxy (§8). The model plays an
  IELTS examiner persona (system instruction, server-side) and runs Part 1 → Part 2
  (cue card + 1-min prep + ≤2-min long turn) → Part 3.
- Input/output transcription is enabled; the full transcript is captured.
- On session end: scoring combines (a) the **live model's own assessment** (it heard the
  audio — used especially for **pronunciation**) and (b) a **transcript-based LLM check**
  via GitHub Models for FC/LR/GRA. Result = 4 criteria + speaking band (average, rounded)
  + feedback.
- **Caveat:** transcript-only pronunciation scoring is approximate; this is explicitly
  surfaced to the user.

**Speaking evaluation JSON schema:**

```json
{
  "criteria": {
    "fluencyCoherence": 7.0,
    "lexicalResource": 7.0,
    "grammaticalRangeAccuracy": 6.5,
    "pronunciation": 7.0
  },
  "speakingBand": 7.0,
  "feedback": { "strengths": ["..."], "improvements": ["..."], "examples": ["..."] }
}
```

## 7. Scoring Engine (pure, unit-tested)

`src/lib/scoring/` — framework-free TypeScript, the correctness core:

- `normalizeAnswer(raw, wordLimit?)` — lowercase, trim, collapse whitespace, strip
  articles where appropriate, enforce word limit (over-limit → invalid).
- `scoreObjective(test, answers)` — compares against `AcceptedAnswer[]`, returns raw
  score + per-question correctness.
- `rawToBand(skill, raw)` — table lookup (§5.2/§5.3), tables stored as data with source
  citations.
- `writingBand(t1, t2)` and `skillAverage(criteria)` and `overall(bands)` — apply the
  rounding rule (§5.4).

Vitest covers boundary cases (e.g., 29/30/31/32 Listening; 33/34/35/36 GT Reading; the
.25/.75 rounding edges).

## 8. Live Speaking Proxy

- `server.ts` (custom Next.js server) exposes `ws://…/ws/speaking`.
- Flow: browser opens WS to our server → our server opens WS to Gemini Live using the
  **owner key** → we send the setup message (examiner system instruction + audio config:
  `responseModalities: ["AUDIO"]`, input/output transcription on) → relay base64 PCM
  frames both directions → forward transcript + control events to the client.
- Client captures mic at 16 kHz PCM (AudioWorklet), plays 24 kHz PCM responses; supports
  barge-in/interruptions.
- Hard session time cap + idle disconnect for cost safety.
- **User-own-key path:** the browser connects to Gemini directly with the user's key
  (no proxy), keeping our cost at zero.

## 9. Content Pipeline

1. **Committed seed bank** — `content/tests/*.json`: original + AI-authored GT tests for
   all four skills. Listening tests ship with **pre-generated audio** in `public/audio/`
   (TTS run at authoring/build time → zero runtime cost, fully copyright-free).
2. **On-demand generation** — `/api/content/generate` uses GitHub Models with strict
   prompts + json-schema to produce a complete original test (passages/scripts +
   questions + answer key). Listening: generated script → `/api/tts` → cached audio.
3. **Local import tool** — `scripts/import-materials` + a gitignored `materials/` folder.
   Users place their **own** legally-obtained PDFs/audio locally; the app catalogs and
   views them (PDF.js) and can optionally turn a pasted passage into a scored quiz. This
   content is **never committed** and never served to other users.

## 10. Data Model (Prisma sketch)

```prisma
model User {
  id        String    @id @default(cuid())
  githubId  String?   @unique
  name      String?
  createdAt DateTime  @default(now())
  attempts  Attempt[]
  settings  Json?
}

model Attempt {
  id         String   @id @default(cuid())
  userId     String?
  user       User?    @relation(fields: [userId], references: [id])
  skill      String   // "listening" | "reading" | "writing" | "speaking"
  testId     String
  rawScore   Int?     // listening/reading
  bandScore  Float
  details    Json     // answers, per-criterion bands, feedback, transcript
  createdAt  DateTime @default(now())
}
```

Anonymous users store the same `Attempt` shape in `localStorage`. `userId` nullable so
the model is identical pre/post-login (multi-user-ready without a rewrite).

## 11. Copyright & Compliance

- The repository must contain **no copyrighted third-party exam content** (e.g., Cambridge
  IELTS papers/audio). Such materials are reachable **only** via the user-run local import
  tool into the gitignored `materials/` folder, for that user's private use.
- All committed practice content is **original or AI-generated** and copyright-free.
- TTS-generated audio is produced by us from our own scripts.

## 12. Project Structure

```
easyIELTS/
├─ server.ts                    # custom Next.js server (hosts /ws/speaking)
├─ prisma/schema.prisma
├─ content/tests/               # committed original/AI test bank (JSON)
├─ public/audio/                # pre-generated listening audio
├─ scripts/
│  ├─ generate-content.ts       # batch-generate + commit original tests
│  └─ import-materials.ts       # local-only import (gitignored output)
├─ src/
│  ├─ app/                      # routes + /api/* + /ws handler glue
│  ├─ server/                   # github-models client, gemini client, ws proxy
│  ├─ lib/
│  │  ├─ scoring/               # pure engine + band tables (Vitest)
│  │  ├─ ielts/                 # format constants, descriptors, prompts
│  │  └─ storage/               # StorageAdapter + local/api impls
│  └─ components/               # test shell, question renderers, dashboard
├─ tests/                       # Vitest
└─ materials/                   # gitignored — user's own imports
```

## 13. Testing Strategy

- **Unit (priority):** scoring engine + band tables + rounding (boundary cases).
- **Unit:** answer normalization (word limits, variants, articles).
- **Integration:** content-generation and evaluation schema validation (mock LLM
  responses validate against the json-schemas).
- **Manual/e2e (later):** one full pass per skill module.

## 14. Phased Implementation Roadmap

1. **Phase 1 — Foundation:** Next.js + custom server scaffold, Prisma/SQLite, NextAuth
   (GitHub), `StorageAdapter` (local + api), scoring engine + band tables **with tests**,
   shared test shell.
2. **Phase 2 — Reading:** GT reading module + question renderers + objective scoring +
   review UI; seed reading tests.
3. **Phase 3 — Listening:** audio player (play-once) + synced questions; seed listening
   tests with pre-generated TTS audio.
4. **Phase 4 — Writing:** editor + GitHub Models evaluation (json-schema) + feedback UI.
5. **Phase 5 — Speaking:** WS audio proxy + AudioWorklet client + Gemini Live examiner +
   post-session scoring.
6. **Phase 6 — Content generation & import:** `/api/content/generate`, `/api/tts`,
   local import tool + PDF.js viewer.
7. **Phase 7 — Dashboard & polish:** distance-to-Band-7 analytics, weak-criterion
   surfacing, settings (BYO keys), cost guardrails.

## 15. Open Questions / Future

- Whether to pre-generate a larger committed test bank vs rely more on on-demand.
- Postgres migration trigger (when multi-user traffic warrants it).
- Possible future: vocabulary trainer + synonym banks (patterns exist in reference repos).
