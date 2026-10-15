# Dry Run

**Rehearse your pitch before the meeting that matters.**

Dry Run puts a panel of AI stakeholders in the room with you. You defend your proposal, they push back with hard questions, pile on when your answers contradict each other and only back down when you address their specific concerns with real data. After the session you get a coaching report and a moment-by-moment debrief showing exactly what to fix.

**Live (Firebase):** https://dry-run-1608.web.app
**Live (Vercel):** https://dryrun-swart.vercel.app
**Live (Cloud Run):** https://dryrun-148827357723.us-central1.run.app

---

## Problem statement

Most proposals fail not because the idea is bad but because the presenter was unprepared for the room. Finance wants a three-year cost model. Legal needs a data privacy answer. Operations asks who actually owns the transition. These objections are predictable but people walk in without having rehearsed answers for any of them.

Existing preparation tools are passive. Slide decks, bullet-point checklists and practice-in-the-mirror are all one-sided. There is no way to stress-test your answers until you are already in the room.

Dry Run gives you a safe space to rehearse. An AI panel challenges you the same way a real committee would, tracks whether you have actually answered their concerns and tells you what you missed.

The primary users are professionals who present proposals to approval committees: team leads seeking budget, product managers pitching roadmap changes and consultants defending recommendations to client boards.

---

## How it works

1. **Upload your proposal.** Paste text, drop in a file or import directly from Google Drive. Recent Drive docs appear automatically if you are already signed in. The panel reads the proposal and generates challenges specific to your content.
2. **Choose your panel.** Select which stakeholder roles will challenge you across five categories: Business, Startup, Event Planning, Academic and Policy. The AI auto-suggests up to 4 panelists relevant to your document, mixing categories freely, and shows a recommendation banner. If no targeted panelists are detected, Usagi (General Reviewer) is selected as a fallback. Each role has a different agenda and conditions that must be met before they are satisfied. Custom roles can be created in the Panel Library. Your last selection is remembered.
3. **Configure the session.** Set panel toughness (Supportive, Balanced, Tough) and turn limit.
4. **Enter the room.** A random panelist fires the first question immediately. You type or speak your responses. After each reply the AI picks the next speaker, gives the last questioner first right of reply if they still have unmet conditions and sometimes triggers a second panelist to pile on immediately when your answer contradicts their domain. An elapsed timer and turn counter are shown in the top bar.
5. **End the session.** When all conditions are addressed an exit offer appears. You can also end manually at any time. The AI analyses the full transcript and generates a coaching report.
6. **Read the debrief.** Every key moment is annotated: what was asked, what you said, why it worked or fell short and a stronger version to try. Filter moments by persona.
7. **Rehearse again.** One click puts you back in the room. Past sessions are saved locally and grouped by meeting.

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
| API layer (tertiary) | Python FastAPI on Google Cloud Run |
| Hosting | Firebase Hosting (SPA with function rewrites) |
| Secrets | Firebase Secret Manager (`GEMINI_API_KEY`) |
| State management | React `useState` with session lifted to `App.jsx` |
| Persistence | `localStorage` for sessions, personas, meetings, cal events, voice settings |
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
      Toast.jsx          ToastStack component and useToast hook
    hooks/
      useTTS.js          text-to-speech queue with per-persona pitch and rate
      useElapsedTimer.js session elapsed timer with helper to get elapsed minutes
    screens/
      Home.jsx           dashboard: greeting, upcoming meetings, recent sessions, weak spots
      NewRehearsal.jsx   3-step setup wizard: upload, choose panel, configure
      RehearsalRoom.jsx  live rehearsal: panel seats, transcript, elapsed timer, input bar
      Report.jsx         post-session summary with tabbed Conditions / Coaching / Proposal view
      Debrief.jsx        moment-by-moment coaching with timeline and persona filter
      PastSessions.jsx   history grouped by meeting with inline proposal preview
      PanelLibrary.jsx   browse built-in roles by category and create custom personas
      Settings.jsx       voice settings, rehearsal defaults, Google account management
    utils/
      google.js          OAuth2 token client, Drive, Calendar and Docs helpers
      storage.js         localStorage helpers: sessions, meetings, cal events, personas, settings
      time.js            shared time helpers: getCurrentTime, formatDate, daysFromNow, formatSessionDate
    data.js              28 persona definitions across 5 categories plus General Reviewer; demo openings
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
  test_core.py           126 pytest tests for backend/agents/core.py
```

---

## AI logic

All three AI calls use a single-call batch approach: one Gemini call returns the complete structured JSON response. No streaming, no server-side state.

### `factCheckProposal` (Google Search grounding)

Called at session start if the Fact-Checker persona is selected. Uses Gemini's Google Search grounding to verify the proposal's key quantitative claims against live web data. The findings are injected into Ritish's context so every challenge Ritish makes references real market data.

### `generateOpenings`

Called once. Returns one opening challenge per selected panelist written specifically around the proposal content.

### `generateReply`

Called after every presenter turn. The system prompt applies several layers of intelligence:

- **Speaker selection.** Picks the panelist with the most unmet conditions. The last questioner gets first right of reply: if they still have unmet conditions they are preferred before switching to another panelist.
- **Multi-panelist pile-on.** After any reply a second panelist can jump in via `follow_up` when the presenter's answer directly contradicts their domain or raises a cross-domain concern. The presenter can face two challenges in a single turn.
- **Answer quality check.** Classifies the presenter's latest message as poor, medium or good. A poor answer (vague, hedged or too short) injects a push-back instruction into the prompt; a good answer (specific, contains numbers or 40+ words) injects an acknowledgment instruction.
- **Condition acknowledgment.** Only marks a condition as met when the presenter's latest message explicitly and specifically addressed it with concrete information.
- **Contradiction detection.** If the presenter's current answer contradicts an earlier turn, the panelist is instructed to reference both statements directly.
- **Satisfied panelist mode.** When all of a panelist's conditions are met they shift from challenging to supportive.

### `generateReport`

Called when the session ends. Returns `weak_points` (2 to 4 gaps with suggested fixes) and `moments` (up to 7 annotated turning points, capped to the actual number of presenter turns). Framed as preparation coaching only: no approval predictions or probability scores. The prompt explicitly tells the model how many turns occurred so it cannot hallucinate turns beyond the transcript.

---

## The panelist roster

28 built-in panelists across five categories plus one general-purpose fallback. Each has a speaking style, a set of concerns and 2 to 3 conditions that must be met before they are satisfied.

| Category | Panelists |
|----------|-----------|
| Business | Alan (Finance), Alex (Legal), Renes (Operations), Rek (Board), Ryme (HR), Kevin (Engineering), Ajwad (Marketing), Ritish (Fact-Checker), Linh (Sustainability), Hui (Customer Success), Farhan (DPO) |
| Startup | Janice (VC Investor), Jac (Product Manager), Jamie (Growth Lead) |
| Event Planning | Shalini (Event Director), Darren (Finance Approver), Haziq (Safety Officer), Pei (Programme Lead) |
| Academic | Prof. Tan (Supervisor), Johann (External Examiner), Dr. Ramasamy (Internal Examiner), Dr. Ng (Ethics Reviewer), Arjun (Industry Mentor), Dr. Lim (Research Funder) |
| Policy | Zul (Policy Analyst), Boon (Regulatory Advisor), Nurul (Community Representative) |
| General | Usagi (General Reviewer), used only when AI detects no targeted panelists; never auto-selected alongside targeted picks |

Custom personas follow the same structure and are passed to every API call in `custom_personas`.

---

## Session state

Session state lives in `App.jsx` and is passed down as props. Never stored on a server.

```js
{
  proposalText: '',           // full proposal text
  proposalName: '',           // rehearsal name, auto-filled from filename or Drive doc title if not set
  personaIds: [...],          // active persona IDs
  config: {
    toughness: 'Balanced',    // Supportive | Balanced | Tough
    turnLimit: 15,            // 5 | 10 | 15 | 20 | 25
  },
  transcript: [],             // full message history
  conditions: {},             // { f1: false, f2: true, ... }
  factCheckNotes: '',         // Jun's verified research briefing
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
  "source": null,
  "follow_up": {
    "speaker": "finance",
    "text": "...",
    "conditions_met": []
  }
}
```

`follow_up` is omitted when only one panelist responds. When present it is rendered as a second message immediately after the primary response with no additional presenter turn required.

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

### Cloud Run

```bash
gcloud builds submit --tag gcr.io/dry-run-1608/dryrun
gcloud run deploy dryrun \
  --image gcr.io/dry-run-1608/dryrun \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --project dry-run-1608
```

The `Dockerfile` does a multi-stage build: Node 20 compiles the React app then Python 3.12 runs FastAPI and serves the compiled static files from the same container. `GEMINI_API_KEY` is pulled from Firebase Secret Manager at runtime.

**Live URL:** https://dryrun-148827357723.us-central1.run.app

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
- [x] Google Cloud Run backend (Python FastAPI, deployed at https://dryrun-148827357723.us-central1.run.app)
- [ ] 3-minute demo video
- [ ] PDF pitch deck

**Google integrations:**
- [x] Google Drive: import proposals with full folder navigation and breadcrumb trail; auto-shows recent docs when signed in
- [x] Google Docs: export session report as a formatted document, with error recovery if not signed in
- [x] Google Calendar: sync upcoming meetings to Home dashboard; persisted to localStorage; individual event deletion; disconnect from Settings

---

## Feature summary

### Rehearsal setup
- 3-step wizard: upload, panel selection, configure
- File upload (drag and drop or browse) or Google Drive import
- Auto-fills rehearsal name from filename or Drive doc title if not already set
- Recent Drive docs shown automatically when signed in (no picker required); dismissible with Clear
- Uploaded filename shown in the Choose Panel step so you always know which file is loaded
- Word count shown on uploaded file card
- Meeting link: connect a rehearsal to an upcoming calendar event
- Panel selection with six tabs: All, Business, Startup, Event Planning, Academic and Policy
- AI auto-detects up to 4 relevant panelists, mixing categories freely; recommendation banner shows pre-selected count
- If AI finds no targeted panelists, Usagi (General Reviewer) is auto-selected
- 6 per page (2x3) with pagination controls in panel selection
- Panel selection remembers the last configuration across sessions
- Custom turn limit (5/10/15/20/25) and toughness level (Supportive/Balanced/Tough)

### Rehearsal room
- Panelist seats with speaking animations, condition dots and met/total counts
- Transcript with time-stamped messages, source chips for fact-checked claims
- Elapsed timer and turn counter in the top bar
- Smart auto-scroll: pauses when the user scrolls up, resumes on new message
- Voice input via Web Speech API
- Text-to-speech panel voices with playback rate control
- Copy-on-hover for every transcript message
- Condition met flash banner
- Turn limit warning with actionable "End and get report" button
- All-conditions-met exit offer with keep-going option
- Retry banner when API connection is lost, pre-fills last message into input
- Demo mode banner when AI is unavailable

### Report and debrief
- Post-session summary: conditions met, turn count, session duration
- Tabbed view: Conditions, Coaching (weak points), Proposal text
- Copy report to clipboard
- Export to Google Docs (opens new tab; retries gracefully on auth failure)
- Full session debrief: annotated moments timeline with persona filter
- Per-moment coaching: what was asked, what you said, why it worked or fell short, stronger answer to try
- "Next weak point" button cycles through weak moments

### Home dashboard
- Time-of-day greeting with profile name (configurable in Settings)
- Upcoming meetings column: Google Calendar sync and manual entries
- Individual calendar event deletion
- Recent sessions with meeting badge, paginated 3 per page
- Recurring weak spots section: per-card dismiss with recovery ("Show dismissed")
- Click any weak spot card to open a detail popup with the full issue, a how-to-fix callout and the list of sessions it appeared in

### Past sessions
- Sessions grouped by linked meeting or proposal
- Calendar-synced meetings appear as groups even before any rehearsals are done
- Per-group rename and bulk delete
- Per-session: conditions met, turns, duration, demo badge
- Inline proposal text expand/collapse per session row
- "Rehearse again" restores linked meeting context
- Assign to meeting: reassign any session to a different meeting inline without leaving the page

### Panel Library
- 28 built-in personas across five category tabs: Business, Startup, Event Planning, Academic and Policy
- 9 per page with pagination controls per tab
- Cards are uniform height per row with Read-only label anchored to the bottom-right
- Built-in cards show name, role, conditions and areas of focus
- Custom persona creation with name, role, speaking style and conditions
- Edit and delete custom personas

### Settings
- Voice output: enable/disable and playback rate
- Default toughness and turn limit (applied to new rehearsals)
- Google account: connect for Drive, Docs and Calendar; connection state persists across reloads; disconnect with one click
- Profile name and role

---

## Progress

### Done
- Full React SPA with sidebar navigation, 7 screens and a shared design system
- All features listed in the Feature summary section above
- 28 built-in panelists across five categories plus Usagi (General Reviewer) fallback; AI-driven panel detection mixes categories freely, caps at 4
- AI-driven panel with per-persona conditions, speaker rotation and fact-checking
- Demo mode fast path: if `sessionStart` returns demo, all subsequent API calls are skipped with no retry
- Firebase Cloud Functions v2 deployment with Secret Manager
- Vercel deployment as a secondary live URL
- Google Cloud Run deployment (Python FastAPI, multi-stage Docker build)
- Google Drive, Docs and Calendar integrations
- Code refactor: TTS and elapsed timer extracted to custom hooks, shared time utilities, deduplicated session save and launch logic, CSS classes for room status banners
- Multi-panelist pile-on via `follow_up`: second panelist jumps in when presenter contradicts their domain
- First right of reply: last questioner is preferred for the next turn until their conditions are met
- Contradiction detection: panelist references both conflicting statements when answer contradicts an earlier turn
- Answer quality classification drives automatic push-back or acknowledgment instructions
- Weak spot detail popup: issue text, how-to-fix callout and session list on click
- Calendar-synced meetings appear in Past Sessions as empty groups before any rehearsals
- Singapore-localised persona names across all 28 built-in roles
- 126 pytest tests covering all Gemini logic including full multi-turn session simulation

### Still to do
- 3-minute demo video
- PDF pitch deck

---

## Notes

The panel personas are role archetypes only. No real or named individuals are imitated. The post-session report is framed as preparation coaching and never gives an approval prediction or probability score.
