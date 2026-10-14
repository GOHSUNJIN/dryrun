export const PERSONAS = [
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
];

export const DEMO_TRANSCRIPT = [
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

export const PAST_SESSIONS = [
  {
    proposal: 'Data Engineering Hires',
    sessions: [
      { id: 's1', date: 'Oct 13, 2026', mode: 'Hybrid', condMet: 3, condTotal: 11, duration: '18 min' },
      { id: 's2', date: 'Oct 11, 2026', mode: 'Type',   condMet: 5, condTotal: 11, duration: '24 min' },
      { id: 's3', date: 'Oct 9, 2026',  mode: 'Type',   condMet: 2, condTotal: 11, duration: '12 min' },
    ],
  },
  {
    proposal: 'Q3 Vendor Switch',
    sessions: [
      { id: 's4', date: 'Sep 28, 2026', mode: 'Voice',  condMet: 8, condTotal: 9,  duration: '31 min' },
    ],
  },
  {
    proposal: 'New Office Lease',
    sessions: [
      { id: 's5', date: 'Sep 14, 2026', mode: 'Type',   condMet: 6, condTotal: 8,  duration: '22 min' },
      { id: 's6', date: 'Sep 10, 2026', mode: 'Type',   condMet: 4, condTotal: 8,  duration: '16 min' },
    ],
  },
];

export const WEAK_SPOTS = [
  { count: 7, text: 'Payback period unclear or unsubstantiated',   sub: 'Across all 6 sessions' },
  { count: 5, text: 'Data privacy and compliance not addressed',   sub: 'Across 4 sessions' },
  { count: 4, text: 'Timeline missing milestones or buffer time',  sub: 'Across 3 sessions' },
];

export const DEBRIEF_MOMENTS = [
  { id: 1, type: 'weak',    turn: 'Turn 5', excerpt: '"This pays for itself within a year."',         tag: 'Weak answer' },
  { id: 2, type: 'strong',  turn: 'Turn 7', excerpt: '"We ran a pilot last quarter with Ops..."',     tag: 'Strong answer' },
  { id: 3, type: 'cond',    turn: 'Turn 6', excerpt: 'Payback period (Finance)',                      tag: 'Condition met' },
  { id: 4, type: 'clash',   turn: 'Turn 7', excerpt: 'Jordan challenged Morgan on cost framing',      tag: 'Persona clash' },
  { id: 5, type: 'weak',    turn: 'Turn 9', excerpt: '"The vendor is TBD but we\'re evaluating..."', tag: 'Weak answer' },
  { id: 6, type: 'cond',    turn: 'Turn 8', excerpt: 'Salary range verified (Fact-Checker)',         tag: 'Condition met' },
  { id: 7, type: 'strong',  turn: 'Turn 11',excerpt: '"HR owns the data; we have a DPA template."', tag: 'Strong answer' },
];

export const UPCOMING_MEETINGS = [
  { name: 'Budget Review: Q4 Headcount',     date: 'Oct 17, 2026',  daysLeft: 4 },
  { name: 'Tech Vendor Shortlist Review',    date: 'Oct 21, 2026',  daysLeft: 8 },
  { name: 'Board Presentation: Growth Plan', date: 'Oct 29, 2026', daysLeft: 16 },
];
