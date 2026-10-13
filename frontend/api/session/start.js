import { factCheckProposal, generateOpenings, getInitialConditions } from '../_lib/core.js';
import { getDemoOpenings, getDemoConditions } from '../_lib/fallback.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const {
      proposal_text = '',
      persona_ids = ['finance', 'legal', 'ops'],
      config = {},
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
    res.status(200).json({
      messages: await generateOpenings(proposal_text, persona_ids, config, factCheck),
      conditions: getInitialConditions(persona_ids),
      fact_check: factCheck,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
}
