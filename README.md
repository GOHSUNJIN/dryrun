# Dry Run

**Rehearse your pitch before the meeting that matters.**

An AI rehearsal room powered by Gemini. You upload a proposal, face a panel of AI stakeholders, and walk away with a line-by-line coaching report before the real meeting.

**Live:** https://dry-run-1608.web.app  
**Demo:** https://youtu.be/SVNpqS2siMA  
**Category:** Future of Work and Enterprise Productivity  
**Hackathon:** Google Cloud AI Builder Cup 2026  
**Stack:** Gemini Flash + Google Search grounding + Firebase Hosting + Cloud Functions v2

---

## The Team

**A.L.A.N** | Always Learning, Always New

| Role | Name | LinkedIn |
|---|---|---|
| Developer | Goh Sun Jin | [linkedin.com/in/gohsunjin](https://www.linkedin.com/in/gohsunjin) |
| Support | Prabhakaran Ritish | [linkedin.com/in/prabhakaran-ritish-45286921a](https://linkedin.com/in/prabhakaran-ritish-45286921a) |

---

## The Problem

Most proposals fail not because the idea is bad but because the presenter walked in unprepared. Finance wants a three-year cost model. Legal needs a data privacy answer. Operations asks who owns the transition. These objections are entirely predictable yet people face them for the first time in the actual room.

Existing preparation tools are one-sided. Slide decks and bullet-point checklists never push back. There is no way to stress-test your reasoning until you are already standing in front of the committee.

Dry Run gives professionals a safe space to rehearse. An AI panel challenges you the same way a real committee would, tracks whether you have actually addressed each concern and tells you exactly what you missed.

---

## How It Works

1. **Upload your proposal.** Paste text, drop in a PDF/DOCX/PPTX or import directly from Google Drive.
2. **Choose your panel.** Pick from 27 stakeholder roles across Business, Startup, Event Planning, Academic and Policy, plus a general fallback. Gemini auto-suggests the best match for your content. Up to 5 panelists per session.
3. **Enter the room.** A panelist fires the opening challenge immediately. You respond. The AI picks the next speaker, applies rotation logic and sometimes triggers a second panelist to pile on when your answer contradicts their domain.
4. **End the session.** Gemini analyses the full transcript and generates a coaching report.
5. **Read the debrief.** Key moments are annotated: what was asked, what you said, why it worked or fell short, and a scripted alternative or coaching note for next time.

---

## Why It's Different

| What most prep tools do | What Dry Run does |
|---|---|
| Single-turn Q&A with one AI voice | Multi-persona panel where each role has its own agenda and conditions |
| Generic AI responses | Challenges grounded in your actual proposal document |
| Post-hoc feedback | Real-time condition tracking updated after every answer |
| No conversation structure | Speaker rotation, first-right-of-reply and contradiction detection |
| Static tips | Moment-by-moment debrief with annotated turning points, scripted alternatives and coaching notes |

**Key innovations:**

- **Condition tracking.** Each panelist has 2-3 explicit conditions. The session does not resolve cleanly until you have addressed all of them with concrete information.
- **Fact-Checker persona.** Uses Gemini with Google Search grounding to verify your proposal's claims against live web data before the session starts. Challenges from the Fact-Checker include source labels when citing real reports or datasets.
- **Pile-on mechanic.** When your answer contradicts a panelist's domain a second panelist jumps in immediately via `follow_up` without consuming an extra turn.
- **Multi-turn intelligence.** The AI tracks who has spoken, how many consecutive turns they have held and whether they still have unmet conditions before deciding who speaks next.
- **27 built-in roles across 5 industry verticals** plus a general fallback and custom persona creation for any domain.

---

## Google Cloud Stack

| Layer | Technology |
|---|---|
| AI model | Gemini 3.8 Flash via `@google/genai` JS SDK |
| Google Search grounding | Gemini built-in Search tool in `factCheckProposal` |
| API backend | Firebase Cloud Functions v2 (Node 22, ES modules) |
| Hosting | Firebase Hosting with SPA rewrites |
| Secrets | Firebase Secret Manager (`GEMINI_API_KEY`) |
| Proposal import | Google Drive API (file browser and recent docs) |
| Report export | Google Docs API (formatted document creation) |
| Meeting sync | Google Calendar API (upcoming events on the home dashboard) |

Every core feature runs on Google Cloud. The AI, backend, hosting, secrets and all three Google Workspace integrations are native Google services.

---

## How the AI Works

Four structured Gemini calls per session. No streaming. No server-side state. Three return JSON; `factCheckProposal` returns a plain-text briefing injected into the session.

### `factCheckProposal` (Google Search grounding)

Called at session start when the Fact-Checker persona is selected and the proposal is at least 150 words. Gemini searches the web and returns a briefing of verified and disputed claims. Results are cached so repeated sessions on the same proposal skip the call. This briefing is injected into every Fact-Checker response for the rest of the session.

### `generateOpenings`

One call per session. Returns one tailored opening challenge per selected panelist, each written specifically around the uploaded proposal content.

### `generateReply`

Called after every presenter turn. Returns the next panelist's response and an optional second panelist follow-up in a single call. The prompt applies several layers of intelligence:

- **Speaker selection.** The previous questioner has first right of reply. After 2 consecutive turns with the same panelist, the AI rotates to the one with the most unmet conditions.
- **Condition acknowledgment.** How strictly conditions are marked depends on toughness: Supportive accepts a meaningful address of the topic, Balanced requires explicit concrete information and Tough requires every specific detail with concrete evidence.
- **Skip detection.** If the presenter signals they cannot answer, the AI rotates to a different panelist rather than pressing the same question.
- **Pile-on trigger.** If the answer contradicts another panelist's domain a second response is returned in `follow_up`.
- **Regeneration.** When the presenter clicks "Try Different Response" the previously shown responses are sent as rejected examples so the AI cannot repeat them.

### `generateReport`

One call at session end. Returns 2-4 coaching gaps with actionable fixes and up to 7 annotated turning-point moments from the transcript. Framed as preparation coaching only. No approval predictions or probability scores.

---

## Architecture

```
Browser (React 18 SPA)
        |
        |  POST /api/session/detect-panel  (auto-suggest panelists)
        |  POST /api/extract-document      (PDF/DOCX/PPTX text extraction)
        |  POST /api/session/start
        |  POST /api/session/message       (one call per presenter turn)
        |  POST /api/session/end
        v
Firebase Hosting rewrite
        v
Firebase Cloud Functions v2  (us-central1, Node 22)
  functions/index.js     sessionDetectPanel | extractDocument | sessionStart | sessionMessage | sessionEnd
        v
  functions/core.js      Gemini: detectPanel, factCheck, openings, reply, extract, report
  functions/fallback.js  scripted demo data (no-key or AI failure)
        v
Gemini 3.8 Flash  (+  Google Search grounding)
```

The API is fully stateless. Every request carries the full proposal text, persona IDs, complete transcript and current condition state. Functions hold no memory between calls.

**Demo mode.** If `GEMINI_API_KEY` is not set or any Gemini call fails the function returns scripted responses. All screens stay fully functional. The browser shows a banner explaining the fallback.

---

## Project Layout

```
frontend/
  src/
    App.jsx              root routing and session state
    components/
      Sidebar.jsx        left nav with profile footer
      Toast.jsx          ToastStack and useToast hook
    hooks/
      useTTS.js          text-to-speech queue with per-persona voice settings
      useElapsedTimer.js session timer
    screens/
      Home.jsx           dashboard: greeting, upcoming meetings, recent sessions, weak spots
      NewRehearsal.jsx   3-step setup: upload, choose panel, configure
      RehearsalRoom.jsx  live rehearsal: panel seats, transcript, input
      Report.jsx         post-session summary with Conditions / Coaching / Proposal tabs
      Debrief.jsx        moment-by-moment coaching with persona filter
      PastSessions.jsx   history grouped by meeting
      PanelLibrary.jsx   browse built-in personas and create custom ones
      Settings.jsx       voice, defaults, Google account, profile
    utils/
      google.js          OAuth2, Drive, Calendar and Docs helpers
      storage.js         localStorage: sessions, meetings, personas, settings
      time.js            time helpers shared across screens
    data.js              28 persona definitions across 6 categories
    index.css            design system: tokens, components, room theme
functions/
  index.js               Cloud Functions v2: sessionDetectPanel, extractDocument, sessionStart, sessionMessage, sessionEnd
  core.js                Gemini: detectPanel, factCheckProposal, generateOpenings, generateReply, extractFromImages, generateReport
  fallback.js            scripted demo data: getDemoConditions, getDemoOpenings, getDemoReply, getDemoReport
firebase.json            hosting rewrites: /api/* to Cloud Functions; ** to index.html
.firebaserc              project alias: dry-run-1608
```

---

## Feature Summary

### Responsive Design
- Fully responsive across desktop and mobile browsers
- Mobile layout uses a bottom navigation bar; desktop uses a sidebar
- All core flows (setup, rehearsal room, report and debrief) work on phone screens
- Panelist seats scroll horizontally on mobile when 4 or 5 panelists are selected

### Rehearsal Setup
- Paste text, upload PDF/DOCX/PPTX or import from Google Drive; recent Drive docs shown automatically when signed in
- Gemini auto-detects the most relevant panelists for your proposal; falls back to keyword matching if the API is unavailable
- 28 built-in panelists; custom persona creation with name, role, cares, speaking style and conditions
- Session cap at 5 panelists; Usagi (General Reviewer) auto-selected as fallback when no targeted match is found
- Toughness (Supportive / Balanced / Tough) and turn limit (5 / 10 / 15 / 20 / 25) configurable

### Rehearsal Room
- Panelist seats with speaking animations, condition dots and hover tooltip showing met/unmet status
- Text and voice input (Web Speech API)
- Text-to-speech panel voices with playback rate control
- Smart auto-scroll: pauses when the user scrolls up and resumes on new message
- "Try Different Response" on the opening and on the last AI message, both guaranteed to return a genuinely new response
- Elapsed timer and turn counter in the top bar

### Report and Debrief
- Conditions tab: met/unmet per panelist
- Coaching tab: 2-4 gap areas with fixes
- Proposal tab: original filename and word count
- Debrief covers 4-7 annotated moments per session (weak turns get scripted alternatives; strong turns get coaching notes on how to reinforce them)
- Export to Google Docs; copy to clipboard
- Delete run directly from the report page

### History and Home
- Past sessions grouped by linked meeting or proposal; per-session inline rename and delete
- Google Calendar sync: upcoming meetings on the home dashboard; rehearsals can be tied to a specific event
- Recurring weak spot tracking: the home dashboard surfaces patterns across multiple sessions
- "Rehearse again" preserves the original panel, proposal, toughness and turn limit

---

## The Panelists

27 built-in panelists across five categories plus one general-purpose fallback (28 total).

| Category | Panelists |
|---|---|
| Business | Xavier (Finance), Alex (Legal), Renes (Operations), Rek (Board), Ryme (HR), Kevin (Engineering), Ajwad (Marketing), Angelo (Fact-Checker), Ethan (Sustainability), William (Customer Success), Wilfred (DPO) |
| Startup | Janice (VC Investor), Jac (Product Manager), Jamie (Growth Lead) |
| Event Planning | Syaqiq (Event Director), Darren (Finance Approver), Paul (Safety Officer), Samuel (Programme Lead) |
| Academic | Prof. Tan (Supervisor), Johann (External Examiner), Dr. Ramasamy (Internal Examiner), Dr. Ng (Ethics Reviewer), Jawad (Industry Mentor), Dr. Lim (Research Funder) |
| Policy | Jay (Policy Analyst), Bhone (Regulatory Advisor), Justin (Community Representative) |
| General | Usagi (General Reviewer) · auto-selected when no targeted panelists are detected |

Custom personas follow the same structure and are passed to every API call in `custom_personas`.

---

## Session State

State lives in `App.jsx` and flows down as props. Never stored on a server.

```js
{
  proposalText: '',        // full proposal text
  proposalName: '',        // rehearsal name
  documentName: '',        // original filename shown in Report
  personaIds: [...],       // active persona IDs
  config: {
    toughness: 'Balanced', // Supportive | Balanced | Tough
    turnLimit: 15,         // added at session start: 5 | 10 | 15 | 20 | 25
  },
  transcript: [],          // full message history
  conditions: {},          // { f1: false, f2: true, ... }
  factCheckNotes: '',      // Fact-Checker research briefing
  customPersonaDefs: {},   // custom personas for API calls
  reportData: null,        // weak_points and moments from generateReport
  startTime: null,         // timestamp set when session begins
  duration: '',            // formatted duration set on session end
  linkedMeeting: '',       // calendar event this rehearsal is tied to
  demoMode: false,         // set at session start: true when AI is unavailable
}
```

---

## API Reference

### `POST /api/session/detect-panel`

```json
{ "proposal_text": "...", "available_ids": ["finance", "legal", ...] }
```

Returns `persona_ids`: the recommended panel for the proposal. Used to auto-populate the panel selector before the session starts.

### `POST /api/extract-document`

```json
{ "pages": ["<base64>", "<base64>"], "filename": "proposal.pdf" }
```

Returns `text`: extracted plain text from uploaded PDF, DOCX or PPTX files. Handled server-side using Gemini vision for scanned PDFs.

### `POST /api/session/start`

```json
{
  "proposal_text": "...",
  "persona_ids": ["finance", "legal", "ops"],
  "config": { "toughness": "Balanced", "turnLimit": 15 },
  "fact_check": "",
  "custom_personas": {}
}
```

Returns `messages` (opening challenges), `conditions` (initial state) and `fact_check` (Fact-Checker briefing). Includes `"demo": true` if AI is unavailable.

### `POST /api/session/message`

```json
{
  "proposal_text": "...",
  "persona_ids": [...],
  "transcript": [...],
  "conditions": { "f1": false },
  "config": {},
  "fact_check": "",
  "previous_responses": []
}
```

Returns `speaker`, `text`, `conditions_met` and optional `follow_up` (second panelist). The `previous_responses` field is used for regeneration to prevent repeated answers.

### `POST /api/session/end`

```json
{
  "proposal_text": "...",
  "persona_ids": [...],
  "transcript": [...],
  "conditions": { "f1": true }
}
```

Returns `weak_points` (label, issue, fix) and `moments` (annotated turning points; weak moments include a scripted alternative, strong moments include a coaching note).

---

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

The frontend calls `/api/...` which in local dev has no backend. The app runs in demo mode with scripted responses. All screens and navigation work. To connect to live AI, deploy the Functions and point the dev server at the deployed URLs or run the Firebase emulator suite.

---

## Deploy

```bash
cd frontend && npm run build && cd ..
firebase deploy
```

Store the API key in Firebase Secret Manager:

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Firebase Hosting rewrites each `/api/...` endpoint individually to its matching Cloud Function. Everything else serves `index.html` for client-side routing.

---

## Known Limitations

- Timezone is hardcoded to `Asia/Singapore` in `time.js`.
- `pdfjs-dist` loads at runtime for scanned PDF extraction; first upload adds ~2 s on a cold start.
- Demo mode canned responses do not reflect custom persona definitions; custom persona sessions in demo mode show no opening messages but remain functional.
- The panel personas are role archetypes only. No real or named individuals are imitated. The post-session report is framed as preparation coaching and never gives an approval prediction or probability score.
