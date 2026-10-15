// Fallback responses used when GEMINI_API_KEY is not set or AI calls fail.
// No fabricated coaching data  -  placeholders only.

const CANNED_OPENINGS = {
  finance:          'You have listed the headcount cost, but what does the full three-year TCO look like once you add tooling, onboarding, cloud infrastructure and the cost of backfilling if someone leaves?',
  legal:            'Before we discuss budget: who owns the data these engineers will access? We need a data classification audit and a GDPR scope assessment before anyone touches production systems.',
  ops:              'Someone is doing this work manually right now. Who is that person, what is the plan for their role, and how long does a parallel run last before we cut over?',
  factcheck:        'The proposal cites a 30-hour-per-month saving and a cost figure. Both need sources. What market data supports the salary range and what evidence backs the time estimate?',
  hr:               'This proposal does not mention the people most affected by it. What is the change management plan for the teams involved and how are you managing retention risk during the transition?',
  tech:             'What are the integration dependencies? Before approving any timeline I need to know which existing systems this touches, what the security model is and who owns it post-launch.',
  marketing:        'The target audience is described in one line. What evidence supports those assumptions about user behaviour and where is the go-to-market plan with confirmed launch timing?',
  board:            'Why this, why now? I need to understand what we are trading off against this initiative and whether the ROI case holds at a board level, not just an operational one.',
  sustainability:   'There is no mention of environmental impact or ESG obligations. What is the carbon footprint of this proposal and how does it align with the organisation\'s sustainability commitments?',
  cx:               'How does this affect existing customers during the transition? I need a customer impact assessment, an onboarding plan and a clear view of the churn risk.',
  dpo:              'What is the legal basis for processing the personal data this proposal involves? I need data flows mapped, retention periods defined and third-party DPAs addressed before any approval.',
  vc:               'The market size is stated without a source. What is the total addressable market, what are the unit economics and where does this become profitable? I need a model, not assumptions.',
  product_manager:  'What is the core user problem this solves and how have you validated it? The MVP scope is undefined and there are no success metrics. What does done actually look like?',
  growth:           'Acquisition strategy is missing entirely. What are the channels, what is the expected cost per acquisition and what is the retention baseline you are optimising from?',
  supervisor:       'Your methodology section describes what you did but not why you chose this approach over alternatives. What is the justification and what sources support that choice?',
  examiner:         'What is the original contribution here? I need you to articulate what this work adds to the existing body of knowledge and where the boundaries of that claim are.',
  internal_examiner:'This does not clearly align with our departmental research guidelines. Is the methodology consistent with institutional standards and does the abstract accurately reflect the conclusions?',
  ethicist:         'The ethics section is one paragraph. Have participants given informed consent, do they understand how their data will be used and has potential for algorithmic bias been assessed?',
  industry_mentor:  'This works as a research prototype. Would a real organisation actually adopt it? What barriers exist outside the lab setting and have you tested with real users in context?',
  research_funder:  'How does this align with the funding call criteria? I need a value-for-money justification, a clear impact pathway and a dissemination plan that extends beyond the academic community.',
  policy_analyst:   'What regulatory framework governs this and which obligations apply? I need a compliance mapping and a view on whether the current policy environment supports or obstructs this proposal.',
  regulator:        'Has the regulatory approval pathway been identified? I need to understand the licensing requirements, the compliance timeline and the enforcement risk if this proceeds without clearance.',
  community_rep:    'Have the communities most affected by this been consulted? I need to see who was involved, what was heard and what the mitigation plan is for any disproportionate impact.',
  event_director:   'This plan describes what will happen on the day but not why the event is being held. What is the purpose, the expected outcome for the organisation and who has final sign-off authority?',
  event_finance:    'The budget is presented as a range rather than a fixed figure. I need an itemised breakdown per line and a contingency plan if attendance or costs exceed the upper estimate.',
  event_safety:     'The plan names a Safety IC but gives no specific procedures. What is the venue\'s certified capacity, what first aid arrangement is in place and how will dietary restrictions be tracked?',
  event_programme:  'There is no consolidated run-of-show with timings. What is the full sequence from doors open to close, and are dry run dates already confirmed?',
  general:          'The purpose and expected outcomes are not clearly stated. What problem does this solve, who benefits from it and what does success look like in concrete terms?',
};

const CANNED_CONDITIONS = {
  finance:          ['f1', 'f2', 'f3'],
  legal:            ['l1', 'l2', 'l3'],
  ops:              ['o1', 'o2', 'o3'],
  factcheck:        ['fc1', 'fc2'],
  hr:               ['hr1', 'hr2', 'hr3'],
  tech:             ['t1', 't2', 't3'],
  marketing:        ['m1', 'm2', 'm3'],
  board:            ['b1', 'b2', 'b3'],
  sustainability:   ['sus1', 'sus2', 'sus3'],
  cx:               ['cx1', 'cx2', 'cx3'],
  dpo:              ['dpo1', 'dpo2', 'dpo3'],
  vc:               ['vc1', 'vc2', 'vc3'],
  product_manager:  ['pm1', 'pm2', 'pm3'],
  growth:           ['gr1', 'gr2', 'gr3'],
  supervisor:       ['sup1', 'sup2', 'sup3'],
  examiner:         ['ex1', 'ex2', 'ex3'],
  internal_examiner:['ie1', 'ie2', 'ie3'],
  ethicist:         ['eth1', 'eth2', 'eth3'],
  industry_mentor:  ['im1', 'im2', 'im3'],
  research_funder:  ['rf1', 'rf2', 'rf3'],
  policy_analyst:   ['pa1', 'pa2', 'pa3'],
  regulator:        ['re1', 're2', 're3'],
  community_rep:    ['cr1', 'cr2', 'cr3'],
  event_director:   ['ed1', 'ed2', 'ed3'],
  event_finance:    ['ef1', 'ef2', 'ef3'],
  event_safety:     ['es1', 'es2', 'es3'],
  event_programme:  ['ep1', 'ep2', 'ep3'],
  general:          ['gen1', 'gen2', 'gen3'],
};

export function getDemoConditions(personaIds) {
  const conditions = {};
  for (const pid of personaIds) {
    for (const id of (CANNED_CONDITIONS[pid] || [])) {
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
    text: 'That response needs more specificity. Can you walk us through the numbers behind that claim and who owns the accountability for delivering on it?',
    conditions_met: [],
  };
}

export function getDemoReport() {
  return {
    weak_points: [
      {
        label: 'Finance',
        issue: 'No full cost breakdown or payback period provided',
        fix: 'Prepare a three-year TCO model covering headcount, tooling, infrastructure and contingency. State the payback period with supporting arithmetic so Finance can evaluate the investment case.',
      },
      {
        label: 'Legal',
        issue: 'Data privacy and vendor accountability left unaddressed',
        fix: 'Identify which data types are involved, confirm the legal basis for processing and name the vendors under evaluation. Confirm whether any have completed a SOC 2 audit.',
      },
      {
        label: 'Operations',
        issue: 'Timeline lacks named milestones and no process owner identified',
        fix: 'Replace the high-level phases with a milestone-based plan that names who owns each stage. Explicitly state who currently does this work and how the transition affects their role.',
      },
    ],
    moments: [
      {
        id: 1,
        type: 'weak',
        turn: 'Turn 1',
        excerpt: 'It should pay for itself within a year.',
        tag: 'Weak answer',
        asked: 'Finance asked for a full cost breakdown including tooling and infrastructure.',
        your_answer: 'It should pay for itself within a year.',
        why: 'The answer restates the conclusion without providing the calculation behind it. Finance needs a model, not an assertion.',
        better: 'Walk through the arithmetic: state the total annual cost including all line items, divide by the hours saved multiplied by the fully loaded hourly rate, and show the break-even month explicitly.',
      },
      {
        id: 2,
        type: 'weak',
        turn: 'Turn 2',
        excerpt: 'We will sort out the data side later.',
        tag: 'Weak answer',
        asked: 'Legal asked who owns the data and whether a GDPR scope assessment has been done.',
        your_answer: 'We will sort out the data side later.',
        why: 'Deferring a data privacy question to Legal signals that the proposal has not been properly scoped. It will not be approved without a clear answer.',
        better: 'Name the data types involved, confirm the legal basis for processing, and state which vendor contracts include DPA provisions. If this has not been done yet, commit to a date and own it.',
      },
    ],
  };
}
