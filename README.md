# Dry Run

**Rehearse your pitch before the meeting that matters.**

Dry Run puts a panel of AI stakeholders in the room with you. You defend your proposal, they push back with hard questions, pile on when your answers contradict each other and only back down when you address their specific concerns with real data. After the session you get a coaching report and a moment-by-moment debrief showing exactly what to fix.

**Live (Firebase):** https://dry-run-1608.web.app
**Live (Vercel):** https://dryrun-swart.vercel.app

---

## Problem statement

Most proposals fail not because the idea is bad but because the presenter was unprepared for the room. Finance wants a three-year cost model. Legal needs a data privacy answer. Operations asks who actually owns the transition. These objections are predictable but people walk in without having rehearsed answers for any of them.

Existing preparation tools are passive. Slide decks, bullet-point checklists and practice-in-the-mirror are all one-sided. There is no way to stress-test your answers until you are already in the room.

Dry Run gives you a safe space to rehearse. An AI panel challenges you the same way a real committee would, tracks whether you have actually answered their concerns and tells you what you missed.

The primary users are professionals who present proposals to approval committees: team leads seeking budget, product managers pitching roadmap changes and consultants defending recommendations to client boards.

---

## How it works

1. **Upload your proposal.** Paste text, drop in a file or import directly from Google Drive. The panel reads it and generates challenges specific to your content.
2. **Choose your panel.** Select which stakeholder roles will challenge you. Each role has a different agenda and conditions that must be met before they are satisfied. Custom roles can be created in the Panel Library.
3. **Configure the session.** Set panel toughness and turn limit.
4. **Enter the room.** A random panelist fires the first question immediately. The rest stagger in. You type or speak your responses. After each reply the AI picks the next speaker whose concerns are least addressed, checks whether your answer was specific enough to satisfy any conditions and sometimes triggers a second panelist to pile on.
5. **End the session.** When all conditions are addressed an exit offer appears. You can also end manually. The AI analyses the full transcript and generates a coaching report.
6. **Read the debrief.** Every key moment is annotated with what was asked, what you said, why it worked or fell short and a stronger version to try.
7. **Rehearse again.** One click puts you back in the room. Past sessions are saved locally.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 with Vite 5 |
| Animations | Framer Motion |
| Icons | Lucide React |
| AI model | Gemini 3.8 Flash via `@google/genai` JS SDK |
| Fact-checking | Gemini 3.8 Flash with Google Search grounding |
| API layer (primary) | Firebase Cloud Functions v2 (Node 22, ES modules) |
| API layer (secondary) | JavaScript serverless functions on Vercel |
| Hosting | Firebase Hosting (SPA with function rewrites) |
| Secrets | Firebase Secret Manager (`GEMINI_API_KEY`) |
| State management | React `useState` with session lifted to `App.jsx` |
| Persistence | `localStorage` for past sessions and custom personas |
| Styling | Plain CSS with CSS custom properties |

---

## Architecture

```
Browser (React SPA)
        |
        |  POST /api/session/start
        |  POST /api/session/message       (one call per presenter turn)
        |  POST /api/session/end
        v
Firebase Hosting rewrite
        |
        v
Firebase Cloud Functions v2 (us-central1, Node 22)
  functions/index.js          sessionStart | sessionMessage | sessionEnd
        |
        |  imports
        v
  functions/core.js            all Gemini logic
  functions/fallback.js        scripted demo data (no-key or AI failure path)
        |
        |  @google/genai SDK
        v
  Gemini 3.8 Flash
  (+ Google Search grounding for factCheckProposal)
```

The API is fully stateless. Every request includes the full proposal text, the active persona IDs, the complete transcript and the current condition state. Functions hold no memory between calls.

**Demo mode fallback:** If `GEMINI_API_KEY` is not set or any Gemini call fails, the function returns scripted responses (`demo: true` in the response body). The browser logs the failure reason via `console.error`. All screens remain fully functional.

---

## Project layout

```
frontend/
  api/
    _lib/
      core.js            Gemini logic (Vercel deployment path)
      fallback.js        scripted demo data (Vercel deployment path)
    session/
      start.js           POST /api/session/start  (Vercel)
      message.js         POST /api/session/message  (Vercel)
      end.js             POST /api/session/end  (Vercel)
  src/
    App.jsx              root: screen routing and session state
    components/
      Sidebar.jsx        left nav with profile footer
    screens/
      Home.jsx           dashboard: greeting, upcoming meetings, recent sessions, weak spots
      NewRehearsal.jsx   3-step setup wizard: upload, choose panel, configure
      RehearsalRoom.jsx  live rehearsal: panel seats, transcript, input bar
      Report.jsx         post-session summary with tabbed Conditions / Coaching view
      Debrief.jsx        moment-by-moment coaching with timeline and analysis
      PastSessions.jsx   history grouped by proposal
      PanelLibrary.jsx   browse built-in roles and create custom ones
      Settings.jsx       preferences: voice rate and rehearsal defaults
    utils/
      storage.js         localStorage helpers (sessions, meetings, cal events, dismissed spots, voice settings)
    data.js              static personas and demo openings
    index.css            design system: tokens, components, room theme
  vercel.json            function timeout config (maxDuration 60s for session/start)
functions/
  index.js               Firebase Cloud Functions v2: sessionStart, sessionMessage, sessionEnd
  core.js                Gemini logic: factCheckProposal, generateOpenings, generateReply, generateReport
  fallback.js            scripted demo data: getDemoOpenings, getDemoConditions, getDemoReply, getDemoReport
  package.json           Node 22, ES module, firebase-functions v2 and @google/genai
firebase.json            hosting rewrites: /api/* -> Cloud Functions, ** -> index.html
.firebaserc              project alias: dry-run-1608
backend/
  agents/
    core.py              Python Gemini logic (Cloud Run path)
  main.py                terminal rehearsal entry point (original prototype)
  server.py              FastAPI server (for Cloud Run deployment)
  Dockerfile             multi-stage: Node 20 builds React, Python 3.12 runs FastAPI
tests/
  test_core.py           pytest tests for backend/agents/core.py
```

---

## AI logic

All three AI calls use a single-call batch approach: one Gemini call returns the complete structured JSON response. No streaming, no server-side state.

### `factCheckProposal` (Google Search grounding)

Called at session start if the Fact-Checker persona is selected. Uses Gemini's Google Search grounding to verify the proposal's key quantitative claims against live web data. The findings are injected into Sam's context so every challenge Sam makes references real market data.

### `generateOpenings`

Called once. Returns one opening challenge per selected panelist written specifically around the proposal content.

### `generateReply`

Called after every presenter turn. The system prompt applies several layers of intelligence:

- **Speaker selection.** Picks the panelist with the most unmet conditions. Avoids repeating the last speaker.
- **Condition acknowledgment.** Only marks a condition as met when the presenter's latest message explicitly and specifically addressed it with concrete information.
- **Push-back.** Calls out vague or hedged answers directly without softening.
- **Satisfied panelist mode.** When all of a panelist's conditions are met they shift from challenging to supportive.

### `generateReport`

Called when the session ends. Returns `weak_points` (2 to 4 gaps with suggested fixes) and `moments` (4 to 7 annotated turning points). Framed as preparation coaching only: no approval predictions or probability scores.

---

## The conditions system

Each persona has 2 to 3 conditions. A condition is a specific claim the presenter must make to satisfy that stakeholder. Conditions are tracked as a flat dictionary and passed with every `/api/session/message` request.

| Persona | Name | Role | Conditions |
|---------|------|------|-----------|
| `finance` | Morgan | Head of Finance | Total cost breakdown, payback period calculated, plan if budget is halved |
| `legal` | Alex | Legal Counsel | Data privacy plan confirmed, vendor contract terms addressed, accountability structure defined |
| `ops` | Jordan | Operations Lead | Timeline with milestones given, current process owner identified, disruption assessment complete |
| `factcheck` | Sam | Fact-Checker | Salary range verified, 30-hour claim substantiated |

Custom personas created in the Panel Library follow the same structure and are passed to every API call in `custom_personas`.

---

## Session state

Session state lives in `App.jsx` and is passed down as props. Never stored on a server.

```js
{
  proposalText: '',           // full proposal text
  proposalName: '',           // rehearsal name (user-entered, not auto-filled from filename)
  personaIds: [...],          // active persona IDs
  config: {
    toughness: 'Balanced',    // Supportive | Balanced | Tough
    turnLimit: 15,            // 5 | 10 | 15 | 20 | 25
  },
  transcript: [],             // full message history
  conditions: {},             // { f1: false, f2: true, ... }
  factCheckNotes: '',         // Sam's verified research briefing
  customPersonaDefs: {},      // serialised custom personas for API calls
  reportData: null,           // weak_points + moments from generateReport
  startTime: null,            // Date.now() at session start
  duration: '',               // formatted duration string, set on session end
  linkedMeeting: '',          // name of the upcoming meeting this rehearsal is tied to
  demoMode: false,            // true when AI is unavailable (see browser console for reason)
}
```

---

## API endpoints

### `POST /api/session/start`

**Request**
```json
{
  "proposal_text": "...",
  "persona_ids": ["finance", "legal", "ops", "factcheck"],
  "config": { "toughness": "Balanced", "turnLimit": 15 },
  "custom_personas": {}
}
```

**Response**
```json
{
  "messages": [
    { "id": 1, "speaker": "finance", "text": "...", "time": "0:12", "type": "opening" }
  ],
  "conditions": { "f1": false, "f2": false, "f3": false, "l1": false },
  "fact_check": "..."
}
```

If AI is unavailable the response also includes `"demo": true` and `"demo_reason": "<error message>"`.

### `POST /api/session/message`

**Request**
```json
{
  "proposal_text": "...",
  "persona_ids": ["finance", "legal", "ops", "factcheck"],
  "transcript": [...],
  "conditions": { "f1": false, "f2": true },
  "config": {},
  "fact_check": "...",
  "custom_personas": {}
}
```

**Response**
```json
{
  "speaker": "legal",
  "text": "...",
  "conditions_met": ["l1"],
  "source": null
}
```

### `POST /api/session/end`

**Request**
```json
{
  "proposal_text": "...",
  "persona_ids": ["finance", "legal", "ops", "factcheck"],
  "transcript": [...],
  "conditions": { "f1": true, "f2": false },
  "custom_personas": {}
}
```

**Response**
```json
{
  "weak_points": [
    { "label": "Finance", "issue": "Payback period cited without full TCO", "fix": "..." }
  ],
  "moments": [
    {
      "id": 1, "type": "weak", "turn": "Turn 3",
      "excerpt": "This pays for itself within a year.",
      "tag": "Weak answer",
      "asked": "...", "your_answer": "...", "why": "...", "better": "..."
    }
  ]
}
```

---

## Run locally

### Web app with live AI

```bash
cd frontend
npm install
npm run dev
```

Set `GEMINI_API_KEY` in `frontend/.env`:

```
GEMINI_API_KEY=your_google_ai_studio_key_here
```

The Vite dev server proxies `/api/*` to the local Vercel functions in `frontend/api/`. Gemini calls go directly from the function.

### Web app without AI (demo mode)

Run the same `npm run dev` command without an API key. The room falls back to scripted responses. All screens and navigation work.

### Terminal (original prototype)

```bash
pip install -r requirements.txt
# set GEMINI_API_KEY
python main.py
```

Type at the `You:` prompt. Type `quit` to end and receive a coaching report in the terminal.

---

## Deploy

### Firebase (primary)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Build frontend
cd frontend && npm run build && cd ..

# Deploy hosting + functions
firebase deploy
```

The `GEMINI_API_KEY` is stored in Firebase Secret Manager (not an environment variable). Set it once with:

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Firebase Hosting rewrites `/api/*` paths to the corresponding Cloud Function. Everything else serves `index.html` for client-side routing.

### Vercel (secondary)

```bash
cd frontend
vercel --prod
```

Set `GEMINI_API_KEY` as a Vercel environment variable in the dashboard. The JS functions in `frontend/api/` are picked up automatically.

### Cloud Run (planned)

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/dryrun
gcloud run deploy dryrun \
  --image gcr.io/YOUR_PROJECT/dryrun \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key
```

The `Dockerfile` does a multi-stage build: Node 20 compiles the React app then Python 3.12 runs FastAPI and serves the compiled static files from the same container.

---

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `GEMINI_API_KEY` | Firebase Secret Manager | Set with `firebase functions:secrets:set GEMINI_API_KEY`. Required for live AI. |
| `GEMINI_API_KEY` | Vercel dashboard | Set as an environment variable for the Vercel deployment. |
| `GEMINI_API_KEY` | `frontend/.env` | For local development with `npm run dev`. |

---

## Hackathon context

Built for the Google Cloud AI Builder Cup 2026, theme "Future of Work and Enterprise Productivity". Submission deadline: 18 October 2026.

**Requirements checklist:**
- [x] Gemini AI (`gemini-3.8-flash` via `@google/genai` SDK)
- [x] Google Search grounding (`factCheckProposal` uses Gemini's built-in Google Search tool)
- [x] Firebase Cloud Functions v2 (Google Cloud serverless compute)
- [x] Firebase Hosting (Google Cloud static hosting with rewrite rules)
- [x] Firebase Secret Manager (Google Cloud secrets for API key)
- [x] Live deployment: https://dry-run-1608.web.app
- [ ] Google Cloud Run backend (Python FastAPI ready in `server.py` and `Dockerfile`, pending billing setup)
- [ ] 3-minute demo video
- [ ] PDF pitch deck

**Planned integrations before submission:**
- [x] Google Drive: import proposals with full folder navigation breadcrumb
- [x] Google Docs: export session reports as formatted documents
- [x] Google Calendar: sync upcoming meetings to the Home screen dashboard

---

## Progress and what is left

### Done
- Full React SPA with sidebar navigation, 7 screens and a shared design system
- 3-step rehearsal setup: file upload + meeting link, panel selection, toughness + turn limit
- Live rehearsal room: panel seats, transcript, speaking animations and input bar
- AI-driven panel with per-persona conditions, speaker rotation logic and fact-checking
- Post-session coaching report with weak points and annotated moments
- Demo mode fast path: if `sessionStart` returns demo, all subsequent API calls are skipped entirely with no retry. `generateReply` and `generateReport` use `withRetry(fn, 0)` to fail immediately to fallback
- Custom persona creation in the Panel Library
- Past sessions persisted to `localStorage` with replay navigation
- Firebase Cloud Functions v2 deployment with Secret Manager
- Vercel deployment as a secondary live URL
- Google Search grounding for the Fact-Checker persona
- Google Drive proposal import with folder navigation and breadcrumb trail
- Google Docs report export
- Google Calendar sync: events persisted to `localStorage` so they survive navigation and appear in the meeting picker
- Manual meeting creation from the Home screen
- Meeting linkage: rehearsals can be linked to an upcoming meeting; shown as a badge in Past Sessions rows
- Past Sessions rows show meeting badge, rehearsal name, date and duration
- Rehearsal name field (step 1): user-entered, not auto-filled from uploaded filename
- Home: recurring weak spots section with "Show all" toggle and per-card dismiss (X)
- Home: recent sessions paginated 3 per page with prev/next controls
- Home: upcoming meetings column stretches to fill the grid row height
- Step 3 simplified: removed company size, industry and focus dropdowns
- Proposal rename inline from Past Sessions (pencil icon on group header)

### Still to do
- Google Cloud Run backend (Dockerfile ready)
- 3-minute demo video
- PDF pitch deck

---

## Notes

The panel personas are role archetypes only. No real or named individuals are imitated. The post-session report is framed as preparation coaching and never gives an approval prediction or probability score.
