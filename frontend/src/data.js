export const PERSONAS = [
  // --- Business proposal panel ---
  {
    id: 'finance',
    name: 'Morgan',
    role: 'Head of Finance',
    initial: 'M',
    color: '#F2B35B',
    glow: 'rgba(242,179,91,0.22)',
    dimColor: 'rgba(242,179,91,0.35)',
    panelPct: 12.5,
    cares: ['ROI and full cost breakdown', 'Budget risk and contingency', 'Payback period evidence'],
    conditions: [
      { id: 'f1', text: 'Total cost breakdown provided', met: false },
      { id: 'f2', text: 'Payback period calculated',     met: false },
      { id: 'f3', text: 'Plan if budget is halved',      met: false },
    ],
  },
  {
    id: 'legal',
    name: 'Alex',
    role: 'Legal Counsel',
    initial: 'A',
    color: '#52CFC3',
    glow: 'rgba(82,207,195,0.22)',
    dimColor: 'rgba(82,207,195,0.35)',
    panelPct: 37.5,
    cares: ['Data privacy and GDPR compliance', 'Vendor contract terms', 'Accountability if it fails'],
    conditions: [
      { id: 'l1', text: 'Data privacy plan confirmed',      met: false },
      { id: 'l2', text: 'Vendor contract terms addressed',  met: false },
      { id: 'l3', text: 'Accountability structure defined', met: false },
    ],
  },
  {
    id: 'ops',
    name: 'Jordan',
    role: 'Operations Lead',
    initial: 'J',
    color: '#B9A3FF',
    glow: 'rgba(185,163,255,0.22)',
    dimColor: 'rgba(185,163,255,0.35)',
    panelPct: 62.5,
    cares: ['Realistic timelines', 'Who does the work today', 'Integration disruption risk'],
    conditions: [
      { id: 'o1', text: 'Timeline with milestones given',      met: false },
      { id: 'o2', text: 'Current process owner identified',    met: false },
      { id: 'o3', text: 'Disruption assessment complete',      met: false },
    ],
  },
  {
    id: 'factcheck',
    name: 'Sam',
    role: 'Fact-Checker',
    initial: 'S',
    color: '#9AB0DE',
    glow: 'rgba(154,176,222,0.22)',
    dimColor: 'rgba(154,176,222,0.35)',
    panelPct: 87.5,
    cares: ['Verifies quantitative claims', 'Cites market sources', 'Flags unsupported assertions'],
    conditions: [
      { id: 'fc1', text: 'Key figures verified against sources', met: false },
      { id: 'fc2', text: 'Supporting evidence cited for main claims', met: false },
    ],
  },

  // --- Event planning panel ---
  {
    id: 'event_director',
    name: 'Riya',
    role: 'Event Director',
    initial: 'R',
    color: '#F87171',
    glow: 'rgba(248,113,113,0.22)',
    dimColor: 'rgba(248,113,113,0.35)',
    panelPct: 12.5,
    cares: ['Event purpose and organisational value', 'Success criteria and outcomes', 'Approval chain and accountability'],
    conditions: [
      { id: 'ed1', text: 'Event purpose and expected outcomes clearly stated', met: false },
      { id: 'ed2', text: 'Success criteria defined',                            met: false },
      { id: 'ed3', text: 'Approval chain and accountability identified',        met: false },
    ],
  },
  {
    id: 'event_finance',
    name: 'Darren',
    role: 'Finance Approver',
    initial: 'D',
    color: '#FB923C',
    glow: 'rgba(251,146,60,0.22)',
    dimColor: 'rgba(251,146,60,0.35)',
    panelPct: 37.5,
    cares: ['Itemised budget and per-pax cost', 'Contingency for overruns', 'Vendor payment terms and procurement process'],
    conditions: [
      { id: 'ef1', text: 'Itemised budget with per-pax breakdown provided',          met: false },
      { id: 'ef2', text: 'Contingency plan for cost overruns addressed',             met: false },
      { id: 'ef3', text: 'Vendor selection criteria and payment timeline explained', met: false },
    ],
  },
  {
    id: 'event_safety',
    name: 'Kai',
    role: 'Safety Officer',
    initial: 'K',
    color: '#4ADE80',
    glow: 'rgba(74,222,128,0.22)',
    dimColor: 'rgba(74,222,128,0.35)',
    panelPct: 62.5,
    cares: ['Venue safety and capacity compliance', 'Emergency and first aid procedures', 'Dietary and allergy management'],
    conditions: [
      { id: 'es1', text: 'Venue capacity and safety compliance confirmed',        met: false },
      { id: 'es2', text: 'Emergency response and first aid plan in place',        met: false },
      { id: 'es3', text: 'Dietary restrictions and allergy management addressed', met: false },
    ],
  },
  {
    id: 'event_programme',
    name: 'Cleo',
    role: 'Programme Lead',
    initial: 'C',
    color: '#C084FC',
    glow: 'rgba(192,132,252,0.22)',
    dimColor: 'rgba(192,132,252,0.35)',
    panelPct: 87.5,
    cares: ['Detailed run-of-show with timings', 'Dry run schedule and rehearsal plan', 'Backup plans for no-shows'],
    conditions: [
      { id: 'ep1', text: 'Full programme rundown with timings provided',            met: false },
      { id: 'ep2', text: 'Dry run dates confirmed',                                 met: false },
      { id: 'ep3', text: 'Backup plan for performer or speaker no-shows addressed', met: false },
    ],
  },
];

// Shown when session/start returns no openings and the user has selected the matching persona IDs.
// Each entry is filtered by session.personaIds, so only relevant ones fire.
export const DEMO_TRANSCRIPT = [
  // Business proposal panel
  {
    id: 1, speaker: 'finance', type: 'opening',
    text: 'Thirty hours a month at any plausible internal rate does not approach $240,000 annually. Where is the full cost breakdown: benefits, tooling, cloud infrastructure, management overhead?',
    time: '0:12',
  },
  {
    id: 2, speaker: 'legal', type: 'opening',
    text: 'Before we discuss cost: who owns the data these engineers will access? Has anyone done a data classification audit, or are we assuming our HRIS exports are low-risk?',
    time: '0:24',
  },
  {
    id: 3, speaker: 'ops', type: 'opening',
    text: 'We have no data engineering function today. Someone is doing this work manually right now. Who is that person and what happens to their role during and after the transition?',
    time: '0:36',
  },
  {
    id: 4, speaker: 'factcheck', type: 'opening',
    text: 'The "30 hours per month" figure needs a source. Is that self-reported by the team, time-tracked, or estimated? The entire ROI argument rests on it.',
    time: '0:50',
  },
  // Event planning panel
  {
    id: 5, speaker: 'event_director', type: 'opening',
    text: 'This plan outlines who does what but not why the event is being held. What is the purpose and the expected outcome for the organisation? And who has final sign-off authority if changes need to be made on the day?',
    time: '0:12',
  },
  {
    id: 6, speaker: 'event_finance', type: 'opening',
    text: 'The budget shows $150 to $250 per person for 74 people. What drives that $100 spread and where is the contingency if attendance shifts closer to 180? I need an itemised breakdown, not a range.',
    time: '0:24',
  },
  {
    id: 7, speaker: 'event_safety', type: 'opening',
    text: 'The plan names a Safety IC but has no actual procedures. What is the venue\'s certified capacity versus your 170 to 180 headcount projection, and what is the specific first aid arrangement for the event day?',
    time: '0:36',
  },
  {
    id: 8, speaker: 'event_programme', type: 'opening',
    text: 'There is a programme committee listed but no consolidated run-of-show with timings. What is the full sequence from doors open to event close, and are dry run dates already locked in?',
    time: '0:50',
  },
];

export const SCRIPTED_RESPONSES = [
  {
    speaker: 'finance',
    text: "You've mentioned AWS but not itemised it. AWS data pipeline costs scale with data volume. Give me a three-year TCO model, not a single-year snapshot.",
    follow_up: {
      speaker: 'legal',
      text: "Agreed on the cost gap. And while we're itemising: if those pipelines touch compensation data, we need vendor DPAs scoped before any contract is signed. Has that been looked at?",
    },
  },
  {
    speaker: 'legal',
    text: "If these engineers have access to employee compensation data, we need a DPA in place before day one. Which vendors are you evaluating and have any of them completed a SOC 2 audit?",
    follow_up: null,
  },
  {
    speaker: 'ops',
    text: "Month three is 'development and QA' but who owns the QA? You've listed three engineers plus a PM. None of them are from our current reporting team. Who validates the output is correct?",
    follow_up: {
      speaker: 'factcheck',
      source: { label: 'Gartner Data Pipeline Benchmarks 2024' },
      text: "Supporting Jordan: projects of this scope average 10 to 14 months to full production. A six-month timeline is an outlier without exceptional resourcing. Source: Gartner Data Pipeline Benchmarks 2024.",
    },
  },
  {
    speaker: 'factcheck',
    source: { label: 'McKinsey Analytics Benchmark 2023' },
    text: 'Automation projects of this scope typically take 9 to 14 months to reach full productivity, not six. The compressed timeline is an outlier. Source: McKinsey Analytics Benchmark 2023.',
    follow_up: null,
  },
];

