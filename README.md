# Dry Run

**Rehearse your pitch before the meeting that matters.**

Dry Run puts a panel of AI stakeholders in the room with you. You defend your proposal, they push back with hard questions, pile on when your answers contradict each other, and only back down when you address their specific concerns with real data. After the session you get a coaching report and a moment-by-moment debrief showing exactly what to fix.

**Live:** https://dryrun-swart.vercel.app

---

## Problem statement

Most proposals fail not because the idea is bad but because the presenter was unprepared for the room. Finance wants a three-year cost model. Legal needs a data privacy answer. Operations asks who actually owns the transition. These objections are predictable but people walk in without having rehearsed answers for any of them.

Existing preparation tools are passive. Slide decks, bullet-point checklists and practice-in-the-mirror are all one-sided. There is no way to stress-test your answers until you are already in the room.

Dry Run gives you a safe space to rehearse. An AI panel challenges you the same way a real committee would, tracks whether you have actually answered their concerns and tells you what you missed.

The primary users are professionals who present proposals to approval committees: team leads seeking budget, product managers pitching roadmap changes and consultants defending recommendations to client boards.

---

## How it works

1. **Upload your proposal.** Paste text or drop in a file. The panel reads it and generates challenges specific to your content.
2. **Choose your panel.** Select which stakeholder roles will challenge you. Each role has a different agenda and conditions that must be met before they are satisfied. Custom roles can be created in the Panel Library.
3. **Configure the session.** Set industry context, company size, panel toughness, turn limit and session mode.
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
| API layer | JavaScript serverless functions on Vercel |
| Cloud Run target | FastAPI + uvicorn (Dockerfile ready) |
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
Vercel JS serverless functions
  frontend/api/session/start.js
  frontend/api/session/message.js
  frontend/api/session/end.js
        |
        |  imports
        v
  frontend/api/_lib/core.js            (all Gemini logic)
        |
        |  @google/genai SDK
        v
  Gemini 3.8 Flash
```

The API is fully stateless. Every request includes the full proposal text, the active persona IDs, the complete transcript and the current condition state. The JS functions hold no memory between calls.

---

## Project layout

```
frontend/
  api/
    _lib/
      core.js            Gemini logic: generateOpenings, generateReply, generateReport
    session/
      start.js           POST /api/session/start
      message.js         POST /api/session/message
      end.js             POST /api/session/end
  src/
    App.jsx              root: screen routing and session state
    components/
      Sidebar.jsx        left nav
    screens/
      Home.jsx           dashboard: greeting, upcoming meetings, recent sessions, weak spots
      NewRehearsal.jsx   3-step setup wizard: upload, choose panel, configure
      RehearsalRoom.jsx  live rehearsal: panel seats, transcript, input bar
      Report.jsx         post-session summary with tabbed Conditions / Coaching view
      Debrief.jsx        moment-by-moment coaching with timeline and analysis
      PastSessions.jsx   history grouped by proposal
      PanelLibrary.jsx   browse built-in roles and create custom ones
      Settings.jsx       preferences: voice rate, defaults
    utils/
      storage.js         localStorage helpers
    data.js              static personas, demo openings and scripted fallback responses
    index.css            design system: tokens, components, room theme
  vercel.json            function timeout config
agents/
  core.py                FastAPI-compatible Gemini logic for Cloud Run
server.py                FastAPI server (for Cloud Run deployment)
Dockerfile               multi-stage: Node 20 builds React, Python 3.12 runs FastAPI
main.py                  terminal rehearsal entry point (original prototype)
tests/
  test_core.py           66 pytest tests for agents/core.py
```

---

## AI logic

All three AI calls use a single-call batch approach: one Gemini call returns the complete structured JSON response. No streaming, no server-side state.

### `factCheckProposal` (Google Search grounding)

Called at session start if the Fact-Checker persona is selected. Uses Gemini's Google Search grounding to verify the proposal's key quantitative claims against live web data. The findings are injected into Sam's context so every challenge Sam makes references real market data.

### `generateOpenings`

Called once. Returns one opening challenge per selected panelist written specifically around the proposal content. Openings are shuffled on the client so a random panelist always fires first.

### `generateReply`

Called after every presenter turn. The system prompt applies several layers of intelligence:

- **Speaker selection.** Picks the panelist with the most unmet conditions. Avoids repeating the last speaker.
- **Answer quality assessment.** Classifies the presenter's answer as poor, medium or good based on word count, hedging phrases and presence of specific data. Poor answers are called out directly and cannot satisfy any conditions.
- **Contradiction tracking.** If the current answer conflicts with something said in an earlier turn the panelist references the contradiction explicitly.
- **Condition acknowledgment.** When a condition is met the speaker briefly acknowledges it before pressing on to the next concern.
- **Satisfied panelist mode.** When all of a panelist's conditions are met they shift from challenging to supportive or cooperative.
- **Near-limit urgency.** When three or fewer turns remain the panelist explicitly names the most critical unmet conditions.
- **Multi-voice pile-on.** An optional `follow_up` field lets a second panelist jump in immediately when the answer creates a new issue for them or directly contradicts their concern.

### `generateReport`

Called when the session ends. Returns `weak_points` (2 to 4 gaps with suggested fixes) and `moments` (4 to 7 annotated turning points).

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
  proposalName: '',           // display name from filename or title
  personaIds: [...],          // active persona IDs
  config: {
    mode: 'Type',             // Type | Hybrid
    toughness: 'Balanced',    // Supportive | Balanced | Tough
    turnLimit: 15,            // 5 | 10 | 15 | 20 | 25
    industry: '',
    companySize: '',
    focus: '',
  },
  transcript: [],             // full message history
  conditions: {},             // { f1: false, f2: true, ... }
  factCheckNotes: '',         // Sam's verified research briefing
  customPersonaDefs: {},      // serialised custom personas for API calls
  reportData: null,           // weak_points + moments from generateReport
  startTime: null,            // Date.now() at session start
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
  "config": { "toughness": "Balanced", "industry": "Technology" },
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

### `POST /api/session/message`

**Request**
```json
{
  "proposal_text": "...",
  "persona_ids": ["finance", "legal", "ops", "factcheck"],
  "transcript": [...],
  "conditions": { "f1": false, "f2": true },
  "config": { "turns_remaining": 4 },
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
  "source": null,
  "follow_up": {
    "speaker": "finance",
    "text": "...",
    "conditions_met": [],
    "source": null
  }
}
```

`follow_up` is `null` when only one panelist responds.

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

### Web app without AI (demo mode)

Run the same `npm run dev` command without an API key. The room falls back to scripted responses with multi-voice pile-on pairs. All screens and navigation work.

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

Set `GEMINI_API_KEY` as a Vercel environment variable. The JS functions in `frontend/api/` are picked up automatically.

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
| `GEMINI_API_KEY` | Yes | Google AI Studio key. Set in Vercel dashboard or `frontend/.env` locally. |

---

## Hackathon context

Built for the Google Cloud AI Builder Cup 2026, theme "Future of Work and Enterprise Productivity". Submission deadline: 18 October 2026.

**Requirements checklist:**
- [x] Gemini AI (@google/genai SDK, `gemini-3.8-flash`)
- [x] Live deployment link
- [ ] Google Cloud Run backend (ready in `server.py` and `Dockerfile`, pending billing setup)
- [ ] 3-minute demo video
- [ ] PDF pitch deck

---

## Notes

The panel personas are role archetypes only. No real or named individuals are imitated. The post-session report is framed as preparation coaching and never gives an approval prediction or probability score.
