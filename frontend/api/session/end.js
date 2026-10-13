import { generateReport } from '../_lib/core.js';
import { getDemoReport } from '../_lib/fallback.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const {
      proposal_text = '',
      persona_ids = ['finance', 'legal', 'ops'],
      transcript = [],
      conditions = {},
      custom_personas = {},
    } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json(getDemoReport());
    }

    res.status(200).json(
      await generateReport(proposal_text, persona_ids, transcript, conditions, custom_personas)
    );
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
}
