import { factCheckProposal, generateOpenings, getInitialConditions } from '../_lib/core.js';
import { getDemoOpenings, getDemoConditions } from '../_lib/fallback.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    proposal_text = '',
    persona_ids = ['finance', 'legal', 'ops'],
    config = {},
    custom_personas = {},
  } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({
      messages: getDemoOpenings(persona_ids),
      conditions: getDemoConditions(persona_ids),
      fact_check: '',
      demo: true,
    });
  }

  const factCheck = persona_ids.includes('factcheck')
    ? await factCheckProposal(proposal_text)
    : '';

  try {
    res.status(200).json({
      messages: await generateOpenings(proposal_text, persona_ids, config, factCheck, custom_personas),
      conditions: getInitialConditions(persona_ids, custom_personas),
      fact_check: factCheck,
    });
  } catch (err) {
    console.error('[session/start] generateOpenings failed, falling back to demo:', err.message)
    res.status(200).json({
      messages: getDemoOpenings(persona_ids),
      conditions: getDemoConditions(persona_ids),
      fact_check: '',
      demo: true,
    });
  }
}
