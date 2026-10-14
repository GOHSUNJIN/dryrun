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

