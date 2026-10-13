import { factCheckProposal, generateOpenings, getInitialConditions } from '../_lib/core.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const {
      proposal_text = '',
      persona_ids = ['finance', 'legal', 'ops', 'factcheck'],
      config = {},
    } = req.body;
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
