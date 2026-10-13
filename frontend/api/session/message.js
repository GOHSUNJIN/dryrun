import { generateReply } from '../_lib/core.js';
import { getDemoReply } from '../_lib/fallback.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    proposal_text = '',
    persona_ids = ['finance', 'legal', 'ops'],
    transcript = [],
    conditions = {},
    config = {},
    fact_check = '',
    custom_personas = {},
  } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json(getDemoReply(persona_ids, transcript));
  }

  try {
    res.status(200).json(
      await generateReply(proposal_text, persona_ids, transcript, conditions, config, fact_check, custom_personas)
    );
  } catch (err) {
    console.error('[session/message] generateReply failed, falling back to demo:', err.message)
    res.status(200).json(getDemoReply(persona_ids, transcript));
  }
}
