import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { GoogleGenAI } from '@google/genai'
import {
  detectPanel, factCheckProposal, generateOpenings, getInitialConditions,
  generateReply, generateReport, extractFromImages,
} from './core.js'
import {
  getDemoOpenings, getDemoConditions, getDemoReply, getDemoReport,
} from './fallback.js'

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')

const opts = { secrets: [GEMINI_API_KEY], cors: true, timeoutSeconds: 120 }

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

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({
      messages: getDemoOpenings(persona_ids),
      conditions: getDemoConditions(persona_ids),
      fact_check: '',
      demo: true,
      demo_reason: 'GEMINI_API_KEY not set',
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
      demo_reason: err.message,
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
  } = req.body

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json(getDemoReply(persona_ids, transcript))
  }

  try {
    res.status(200).json(
      await generateReply(proposal_text, persona_ids, transcript, conditions, config, fact_check, custom_personas)
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
  try {
    res.status(200).json({ text: await extractFromImages(pages, filename) })
  } catch (err) {
    console.error('[extract-document] failed:', err.message)
    res.status(200).json({ text: '', error: err.message })
  }
})

export const sessionTestAI = onRequest(opts, async (req, res) => {
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(200).json({ ok: false, error: 'GEMINI_API_KEY not set' })
  try {
    const ai = new GoogleGenAI({ apiKey: key })

    // Test 1: basic response
    const r1 = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Reply with only this text, no markdown: hello',
      config: { maxOutputTokens: 100 },
    })

    res.status(200).json({ ok: true, key_length: key.length, raw: r1.text })
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message, key_length: key.length })
  }
})
