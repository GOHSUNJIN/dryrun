import { detectPanel } from '../_lib/core.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { proposal_text = '', available_ids = [] } = req.body;

  if (!process.env.GEMINI_API_KEY || !available_ids.length) {
    return res.status(200).json({ persona_ids: [] });
  }

  try {
    res.status(200).json({ persona_ids: await detectPanel(proposal_text, available_ids) });
  } catch (err) {
    console.error('[detect-panel] failed:', err.message);
    res.status(200).json({ persona_ids: [] });
  }
}
