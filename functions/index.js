import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import {
  detectPanel, factCheckProposal, generateOpenings, getInitialConditions,
  generateReply, generateReport, extractFromImages,
} from './core.js'
import {
  getDemoOpenings, getDemoConditions, getDemoReply, getDemoReport,
} from './fallback.js'

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')

const opts = { secrets: [GEMINI_API_KEY], cors: true, timeoutSeconds: 120, maxInstances: 10 }

const MAX_PROPOSAL_CHARS = 200_000
const MAX_TRANSCRIPT_TURNS = 60
const MAX_PAGES = 10

export const sessionDetectPanel = onRequest(opts, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { proposal_text = '', available_ids = [] } = req.body
  const targeted_ids = available_ids.filter(id => id !== 'general')
  if (!process.env.GEMINI_API_KEY || !targeted_ids.length) {
    return res.status(200).json({ persona_ids: [] })
  }
  try {
    res.status(200).json({ persona_ids: await detectPanel(proposal_text, targeted_ids) })
  } catch (err) {
    console.error('[detect-panel] failed:', err.message)
    res.status(200).json({ persona_ids: [] })
  }
})

export const sessionStart = onRequest(opts, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    proposal_text = '',
    persona_ids = ['finance', 'legal', 'ops'],
    config = {},
    custom_personas = {},
    fact_check: cachedFactCheck = '',
  } = req.body

  if (proposal_text.length > MAX_PROPOSAL_CHARS) {
    return res.status(400).json({ error: 'Proposal text exceeds maximum length.' })
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({
      messages: getDemoOpenings(persona_ids),
      conditions: getDemoConditions(persona_ids),
      fact_check: '',
      demo: true,
      demo_reason: 'no_key',
    })
  }

  const wordCount = proposal_text.trim().split(/\s+/).length
  const needsFactCheck = persona_ids.includes('factcheck') && wordCount >= 150 && !cachedFactCheck
  const factCheck = needsFactCheck
    ? await factCheckProposal(proposal_text)
    : (persona_ids.includes('factcheck') ? cachedFactCheck : '')

  try {
    res.status(200).json({
      messages: await generateOpenings(proposal_text, persona_ids, config, factCheck, custom_personas),
      conditions: getInitialConditions(persona_ids, custom_personas),
      fact_check: factCheck,
    })
  } catch (err) {
    console.error('[sessionStart] generateOpenings failed, falling back to demo:', err.message)
    res.status(200).json({
      messages: getDemoOpenings(persona_ids),
      conditions: getDemoConditions(persona_ids),
      fact_check: '',
      demo: true,
      demo_reason: 'ai_error',
    })
  }
})

export const sessionMessage = onRequest(opts, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    proposal_text = '',
    persona_ids = ['finance', 'legal', 'ops'],
    transcript = [],
    conditions = {},
    config = {},
    fact_check = '',
    custom_personas = {},
    previous_responses = [],
  } = req.body

  if (proposal_text.length > MAX_PROPOSAL_CHARS) {
    return res.status(400).json({ error: 'Proposal text exceeds maximum length.' })
  }
  if (transcript.length > MAX_TRANSCRIPT_TURNS) {
    return res.status(400).json({ error: 'Transcript exceeds maximum turn limit.' })
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json(getDemoReply(persona_ids, transcript))
  }

  try {
    res.status(200).json(
      await generateReply(proposal_text, persona_ids, transcript, conditions, config, fact_check, custom_personas, previous_responses)
    )
  } catch (err) {
    console.error('[sessionMessage] generateReply failed, falling back to demo:', err.message)
    res.status(200).json(getDemoReply(persona_ids, transcript))
  }
})

export const sessionEnd = onRequest(opts, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    proposal_text = '',
    persona_ids = ['finance', 'legal', 'ops'],
    transcript = [],
    conditions = {},
    custom_personas = {},
  } = req.body

  if (proposal_text.length > MAX_PROPOSAL_CHARS) {
    return res.status(400).json({ error: 'Proposal text exceeds maximum length.' })
  }
  if (transcript.length > MAX_TRANSCRIPT_TURNS) {
    return res.status(400).json({ error: 'Transcript exceeds maximum turn limit.' })
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json(getDemoReport())
  }

  try {
    res.status(200).json(
      await generateReport(proposal_text, persona_ids, transcript, conditions, custom_personas)
    )
  } catch (err) {
    console.error('[sessionEnd] generateReport failed, falling back to demo:', err.message)
    res.status(200).json({ ...getDemoReport(), demo: true })
  }
})

export const extractDocument = onRequest({ ...opts, timeoutSeconds: 180 }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { pages = [], filename = '' } = req.body
  if (!process.env.GEMINI_API_KEY) return res.status(200).json({ text: '', error: 'GEMINI_API_KEY not set' })
  if (!pages.length) return res.status(400).json({ error: 'No pages provided' })
  if (pages.length > MAX_PAGES) return res.status(400).json({ error: `Maximum ${MAX_PAGES} pages allowed.` })
  try {
    res.status(200).json({ text: await extractFromImages(pages, filename) })
  } catch (err) {
    console.error('[extract-document] failed:', err.message)
    res.status(200).json({ text: '', error: 'Extraction failed. Try a different file format.' })
  }
})
