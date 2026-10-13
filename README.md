# Dry Run

**Rehearse your pitch before the meeting that matters.**

Dry Run puts a panel of AI stakeholders in the room with you. You defend your proposal, they push back with hard questions and they only become satisfied when you have addressed their specific concerns. After the session you get a coaching report and a moment-by-moment debrief showing exactly what to fix before the real meeting.

**Live:** https://dryrun-swart.vercel.app

---

## Problem statement

Most proposals fail not because the idea is bad but because the presenter was unprepared for the room. Finance wants a three-year cost model. Legal needs a data privacy answer. Operations asks who actually owns the transition. These objections are predictable but people walk in without having rehearsed answers for any of them.

Existing preparation tools are passive. Slide decks, bullet-point checklists and practice-in-the-mirror are all one-sided. There is no way to stress-test your answers until you are already in the room.

Dry Run gives you a safe space to rehearse. An AI panel challenges you the same way a real committee would, tracks whether you have actually answered their concerns and tells you what you missed.

The primary users are professionals who present proposals to approval committees: team leads seeking budget, product managers pitching roadmap changes and consultants defending recommendations to client boards. For these users the cost of a failed presentation is high and the opportunity to rehearse with a realistic challenger does not currently exist outside expensive coaching.

---

## How it works

1. **Upload your proposal.** Paste text or drop in a file. The panel reads it and generates challenges specific to your content, not generic template questions.
2. **Choose your panel.** Select which stakeholder roles will challenge you. Each role has a different agenda and a set of conditions that must be met before they are satisfied.
3. **Configure the session.** Set industry context, company size, panel toughness and session mode.
4. **Enter the room.** The panel opens with their first challenges. You type your responses. After each reply Gemini picks the next speaker whose concerns are least addressed and generates a challenge specific to what you just said.
5. **End the session.** Gemini analyses the full transcript and generates a coaching report: conditions met by persona, top weak points and suggested fixes.
6. **Read the debrief.** Every key moment in the session is annotated with what you said, why it worked or fell short and a stronger version to try.
7. **Rehearse again.** One click puts you back in the room. Past sessions are saved locally so you can track improvement across attempts.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 with Vite 5 |
| Animations | Framer Motion |
| Icons | Lucide React |
| AI model | Gemini 2.0 Flash via `google-genai` Python SDK |
| Fact-checking | Gemini 2.0 Flash with Google Search grounding (live web verification) |
| API layer | Python serverless functions on Vercel |
| Cloud Run target | FastAPI + uvicorn (Dockerfile ready) |
| State management | React `useState` with session lifted to `App.jsx` |
| Persistence | `localStorage` for past sessions |
| Styling | Plain CSS with CSS custom properties |

---

## Architecture

```
Browser (React SPA)
        │
        │  POST /api/session/start
        │  POST /api/session/message       (one call per presenter turn)
        │  POST /api/session/end
        ▼
Vercel Python serverless functions
  frontend/api/session/start.py
  frontend/api/session/message.py
  frontend/api/session/end.py
        │
        │  imports
        ▼
  frontend/api/_agents/core.py            (all Gemini logic)
        │
        │  google-genai SDK
        ▼
  Gemini 2.0 Flash
```

The API is fully stateless. Every request includes the full proposal text, the active persona IDs, the complete transcript so far and the current condition state. This means the Python functions hold no memory between calls and scale to zero on Vercel serverless without any coordination layer.

---

## Project layout

```
frontend/
  api/
    _agents/
      core.py            Gemini logic: generate_openings, generate_reply, generate_report
    session/
      start.py           POST /api/session/start  — panel opening challenges
      message.py         POST /api/session/message — next speaker reply
      end.py             POST /api/session/end     — coaching report
  src/
    App.jsx              root: screen routing and session state
    components/
      Sidebar.jsx        left nav (home, past sessions, panel library, settings)
    screens/
      Home.jsx           dashboard: upcoming meetings, recent sessions, weak spots
      NewRehearsal.jsx   3-step setup wizard: upload, choose panel, configure
      RehearsalRoom.jsx  live rehearsal: panel seats, transcript, input bar
      Report.jsx         post-session: conditions by persona, top weak points
      Debrief.jsx        moment-by-moment coaching with timeline and analysis
      PastSessions.jsx   history grouped by proposal with progress tracking
      PanelLibrary.jsx   browse and customise persona cards
      Settings.jsx       preferences
    data.js              static personas, fallback transcript and demo data
    index.css            design system: tokens, components, room theme
  requirements.txt       google-genai for Vercel Python runtime
  vercel.json            function timeout config (30s start/message, 60s end)
agents/
  core.py                same Gemini logic as api/_agents/core.py, used for Cloud Run
server.py                FastAPI server (for Cloud Run deployment)
Dockerfile               multi-stage: Node 20 builds React, Python 3.12 runs FastAPI
main.py                  terminal rehearsal entry point (original prototype)
```

---

## AI logic

All three AI calls use a single batch approach: one Gemini call returns the complete response as structured JSON. There is no streaming and no multi-turn conversation stored on the server side.

### `fact_check_proposal` — Google Search grounding

Called at session start if the Fact-Checker persona is selected. Uses Gemini's `google_search` grounding tool to verify the proposal's key quantitative claims against live web data: salary benchmarks, time estimates, cost projections and productivity figures. The verified findings are injected into Sam's context so every challenge Sam makes in the session is grounded in real market data, not generated claims. This is a separate Gemini call that runs before `generate_openings` so Sam's very first challenge already references the verified facts.

### `generate_openings`

Called once at the start of a session. Takes the proposal text, the selected persona IDs and the session config. Returns one opening challenge per panelist, each written specifically around the proposal content. The system prompt instructs Gemini not to use generic questions and not to let panelists introduce themselves.

### `generate_reply`

Called after every presenter turn. Takes the full transcript, the current condition state and the proposal. Gemini picks the panelist whose concerns are least addressed (avoiding the last speaker unless everyone else is satisfied), writes their response and returns which conditions were met by the presenter's last message. The condition check is strict: a condition is only marked met if the presenter explicitly addressed it with concrete information.

### `generate_report`

Called when the presenter ends the session. Takes the full transcript and all condition states. Returns two arrays: `weak_points` (2 to 4 gaps with concrete suggested fixes) and `moments` (4 to 7 annotated turning points with type, what was asked, what was said, why it worked or fell short and a stronger version to try).

---

## The conditions system

Each persona has 2 to 3 conditions. A condition is a specific claim the presenter must make to satisfy that stakeholder. Conditions are tracked as a flat dictionary keyed by ID.

| Persona | Name | Role | Conditions |
|---------|------|------|-----------|
| `finance` | Morgan | Head of Finance | Total cost breakdown, payback period calculated, plan if budget is halved |
| `legal` | Alex | Legal Counsel | Data privacy plan confirmed, vendor contract terms addressed, accountability structure defined |
| `ops` | Jordan | Operations Lead | Timeline with milestones given, current process owner identified, disruption assessment complete |
| `factcheck` | Sam | Fact-Checker | Salary range verified, 30-hour claim substantiated |

The conditions are passed with every `/api/session/message` request so Gemini can see which are still unmet and prioritise the most unsatisfied persona as the next speaker.

---

## Session state

Session state lives in `App.jsx` and is passed down as props. It is never stored on a server.

```js
{
  proposalText: '',       // full proposal text
  proposalName: '',       // display name derived from filename or title
  personaIds: [...],      // which personas are in this session
  config: {
    mode: 'Type',         // Type | Hybrid | Voice
    toughness: 'Balanced' // Supportive | Balanced | Tough
  },
  transcript: [],         // full message history
  conditions: {},         // { f1: false, f2: true, ... }
  reportData: null,       // weak_points + moments from generate_report
  startTime: null,        // Date.now() at session start
}
```

When a session ends the summary (proposal name, date, mode, conditions met) is written to `localStorage` under `dryrun_sessions`. The `PastSessions` and `Home` screens read from localStorage first and fall back to static demo data.

---

## Screens

### Home

Shows a dashboard with upcoming meetings (static demo data), recent sessions read from localStorage and recurring weak spots aggregated across sessions. Clicking any item navigates to the relevant screen.

### New Rehearsal

A three-step wizard:
1. **Upload proposal** — drag-and-drop file upload with a `FileReader`, or use the built-in sample proposal about hiring data engineers.
2. **Choose panel** — toggle cards for each persona. Minimum two required.
3. **Configure** — set company size, industry, panel focus, toughness level and session mode. Clicking "Enter the room" calls `/api/session/start` and shows a spinner while Gemini generates the opening challenges.

### Rehearsal Room

The main experience. A dark theatre-style interface with:
- **Panel seats** at the top showing each persona with their name, role, condition dots and a waveform animation when they are speaking.
- **Spotlight** that sweeps across the panel to highlight the active speaker using a radial gradient.
- **Transcript** showing the full conversation with speaker labels, timestamps and a streaming text effect on new AI messages.
- **Typing indicator** shown while waiting for the Gemini reply.
- **Input bar** with Enter to send.

Pressing "End session" calls `/api/session/end` and navigates to the Report. If the Gemini call fails the room falls back to scripted responses so the UI always works.

### Report

Shows the post-session summary with:
- Conditions by persona (check or cross for each one)
- Score (conditions met out of total)
- Turn count and duration
- Top weak points with suggested fixes from Gemini

### Debrief

A two-panel view with:
- **Left:** timeline of key moments (strong answers, weak answers, conditions met, persona clashes) with persona filter tabs
- **Right:** coaching card for the selected moment showing what was asked, what was said, why it worked or fell short and a stronger answer

### Past Sessions

All sessions grouped by proposal. Shows the conditions-met progress bar for each attempt so you can see improvement across rehearsals. Sessions can be deleted and the change is reflected immediately from localStorage.

---

## API endpoints

### `POST /api/session/start`

**Request**
```json
{
  "proposal_text": "...",
  "persona_ids": ["finance", "legal", "ops", "factcheck"],
  "config": { "toughness": "Balanced", "industry": "Technology" }
}
```

**Response**
```json
{
  "messages": [
    { "id": 1, "speaker": "finance", "text": "...", "time": "0:12", "type": "opening" }
  ],
  "conditions": { "f1": false, "f2": false, "f3": false, "l1": false }
}
```

### `POST /api/session/message`

**Request**
```json
{
  "proposal_text": "...",
  "persona_ids": ["finance", "legal", "ops", "factcheck"],
  "transcript": [...],
  "conditions": { "f1": false, "f2": true },
  "config": {}
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
  "conditions": { "f1": true, "f2": false }
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
      "tag": "Weak Answer",
      "asked": "...", "your_answer": "...", "why": "...", "better": "..."
    }
  ]
}
```

---

## Run locally

### Web app with live AI

```bash
# terminal 1: Python backend
cp .env.example .env
# add GEMINI_API_KEY=your_key to .env
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# terminal 2: React frontend
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` to `localhost:8000`.

### Web app without AI (demo mode)

```bash
cd frontend
npm install
npm run dev
```

The room falls back to scripted responses. All screens and navigation work without an API key.

### Terminal (original prototype)

```bash
pip install -r requirements.txt
# set GEMINI_API_KEY
python main.py
```

Type at the `You:` prompt. Type `quit` to end and receive a coaching report in the terminal.

---

## Deploy

### Vercel (current)

```bash
cd frontend
vercel --prod
```

Set `GEMINI_API_KEY` as a Vercel environment variable (sensitive type). The Python functions in `frontend/api/` are picked up automatically by the Vercel Python runtime.

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

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google AI Studio key. Set in Vercel dashboard or `.env` locally. |

---

## Hackathon context

Built for the Google Cloud AI Builder Cup 2026, theme "Future of Work and Enterprise Productivity". Submission deadline: 18 October 2026.

**Requirements checklist:**
- [x] Gemini AI (google-genai SDK, `gemini-2.0-flash`)
- [x] Live deployment link
- [ ] Google Cloud Run backend (ready in `server.py` and `Dockerfile`, pending billing setup)
- [ ] Firebase Hosting (planned alongside Cloud Run migration)
- [ ] 3-minute demo video
- [ ] PDF pitch deck

---

## Notes

The panel personas are role archetypes only. No real or named individuals are imitated. The post-session report is framed as preparation coaching and never gives an approval prediction or probability score.
