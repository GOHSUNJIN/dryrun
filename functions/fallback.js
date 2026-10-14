// Fallback responses used when GEMINI_API_KEY is not set or AI calls fail.
// No fabricated coaching data — placeholders only.

const CANNED_OPENINGS = {
  finance:   'You have listed the headcount cost, but what does the full three-year TCO look like once you add tooling, onboarding, cloud infrastructure and the cost of backfilling if someone leaves?',
  legal:     'Before we discuss budget: who owns the data these engineers will access? We need a data classification audit and a GDPR scope assessment before anyone touches production systems.',
  ops:       'Someone is doing this work manually right now. Who is that person, what is the plan for their role, and how long does a parallel run last before we cut over?',
  factcheck: 'The proposal cites a 30-hour-per-month saving and a cost figure. Both need sources. What market data supports the salary range and what evidence backs the time estimate?',
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

export function getDemoReply(personaIds) {
  return {
    speaker: personaIds[0] || 'finance',
    text: '[AI unavailable: response not generated]',
    conditions_met: [],
  };
}

export function getDemoReport() {
  return { weak_points: [], moments: [] };
}
