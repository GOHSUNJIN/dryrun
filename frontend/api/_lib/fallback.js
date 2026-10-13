// Demo responses used when GEMINI_API_KEY is not configured.
// Keeps the rehearsal room fully usable for local development and demos.

const CANNED_OPENINGS = {
  finance: 'You have listed the headcount cost, but what does the full three-year TCO look like once you add tooling, onboarding, cloud infrastructure and the cost of backfilling if someone leaves?',
  legal: 'Before we discuss budget: who owns the data these engineers will access? We need a data classification audit and a GDPR scope assessment before anyone touches production systems.',
  ops: 'Someone is doing this work manually right now. Who is that person, what is the plan for their role, and how long does a parallel run last before we cut over?',
  factcheck: 'The proposal cites a 30-hour-per-month saving and a $240,000 annual cost. Both figures need sources. What market data supports the salary range and what evidence backs the time estimate?',
};

const CANNED_REPLIES = [
  { speaker: 'finance', text: 'You still have not given me the payback calculation. Take total cost including infrastructure and divide by the hours saved at a loaded hourly rate. What does that number come to?', conditions_met: [] },
  { speaker: 'legal', text: 'I need the vendor contract terms in writing before this can proceed. Which clauses cover data residency and what is the exit provision if the relationship ends?', conditions_met: [] },
  { speaker: 'ops', text: 'A timeline with named milestones is not optional. Give me the weeks-to-hire, onboarding duration and the date the manual process is decommissioned.', conditions_met: [] },
  { speaker: 'finance', text: 'What happens if the board approves only half the budget? Which hires or deliverables get cut first?', conditions_met: [] },
  { speaker: 'legal', text: 'Who is personally accountable if this project runs over cost or fails a compliance audit? I need a name and a written sign-off commitment.', conditions_met: [] },
  { speaker: 'ops', text: 'You have not identified who currently owns the manual reporting work. Until I know who that is I cannot assess the disruption risk to existing cycles.', conditions_met: [] },
];

const CANNED_REPORT = {
  weak_points: [
    {
      label: 'Finance',
      issue: 'No full TCO or payback calculation presented',
      fix: 'Add a table: headcount + tooling + cloud costs over three years, then divide total spend by loaded hourly savings to produce a concrete payback period.',
    },
    {
      label: 'Legal',
      issue: 'Data privacy and accountability left vague',
      fix: 'Name the data owner, list the GDPR classifications affected, and confirm which vendor contract clause covers data residency and exit rights.',
    },
    {
      label: 'Operations',
      issue: 'Current process owner and transition plan not identified',
      fix: 'Name who does the manual work today, state the parallel-run duration, and give a decommission date with a named milestone owner.',
    },
  ],
  moments: [
    {
      id: 1, type: 'weak', turn: 'Turn 1',
      excerpt: 'This pays for itself within a year.',
      tag: 'Weak Answer',
      asked: 'Morgan asked for a full three-year cost breakdown including tooling and infrastructure.',
      your_answer: '"This pays for itself within a year."',
      why: 'The claim lacks any supporting numbers. A payback assertion without a TCO figure reads as a deflection to a finance audience.',
      better: 'Provide total spend: $240k salary plus $30k tooling plus $15k cloud equals $285k year one. At 30 hours saved per month at $120 loaded rate that is $43k per year saved, giving a payback of under seven years. Acknowledge the gap and commit to a full model by next week.',
    },
    {
      id: 2, type: 'weak', turn: 'Turn 2',
      excerpt: 'We will handle data privacy as we go.',
      tag: 'Weak Answer',
      asked: 'Alex asked who owns the data and whether a GDPR scope assessment has been done.',
      your_answer: '"We will handle data privacy as we go."',
      why: 'This signals the risk has not been thought through. Legal stakeholders need written commitments, not assurances of future planning.',
      better: 'Name the data owner today. State which GDPR classifications apply to the datasets involved. Confirm the vendor DPA is in place and reference the exit clause by number.',
    },
    {
      id: 3, type: 'strong', turn: 'Turn 3',
      excerpt: 'The current analytics lead owns the transition.',
      tag: 'Strong Answer',
      asked: 'Jordan asked who currently does the manual work and what happens to their role.',
      your_answer: '"The current analytics lead owns the transition."',
      why: 'Naming a person directly answers the accountability question. It shows you have thought about the human side of the change.',
      better: 'Add a parallel-run date and a formal handover milestone to make this even stronger.',
    },
    {
      id: 4, type: 'weak', turn: 'Turn 4',
      excerpt: 'We can cut scope if needed.',
      tag: 'Weak Answer',
      asked: 'Morgan asked what gets cut if the budget is halved.',
      your_answer: '"We can cut scope if needed."',
      why: 'Vague contingency answers tell a finance audience you have not stress-tested the plan. They expect a specific ranked list.',
      better: 'Prepare a tiered scope table: tier one is the must-have hire, tier two is the second engineer, tier three is the tooling budget. State explicitly which tier you drop first and what the outcome is at each funding level.',
    },
  ],
};

export function getDemoConditions(personaIds) {
  const conditions = {};
  const condMap = {
    finance:   ['f1', 'f2', 'f3'],
    legal:     ['l1', 'l2', 'l3'],
    ops:       ['o1', 'o2', 'o3'],
    factcheck: ['fc1', 'fc2'],
  };
  for (const pid of personaIds) {
    for (const id of (condMap[pid] || [])) {
      conditions[id] = false;
    }
  }
  return conditions;
}

export function getDemoOpenings(personaIds) {
  return personaIds
    .filter(pid => CANNED_OPENINGS[pid])
    .map((pid, i) => ({
      id: i + 1,
      speaker: pid,
      text: CANNED_OPENINGS[pid],
      time: `0:${String((i + 1) * 12).padStart(2, '0')}`,
      type: 'opening',
    }));
}

export function getDemoReply(personaIds, transcript) {
  const presenterTurns = transcript.filter(m => m.speaker === 'presenter').length;
  const available = CANNED_REPLIES.filter(r => personaIds.includes(r.speaker));
  if (!available.length) {
    return { speaker: personaIds[0], text: 'Could you elaborate on that point?', conditions_met: [] };
  }
  return available[presenterTurns % available.length];
}

export function getDemoReport() {
  return CANNED_REPORT;
}
