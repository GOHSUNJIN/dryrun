import { extractFromImages } from './_lib/core.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { pages = [], filename = '' } = req.body

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({ text: '', error: 'GEMINI_API_KEY not set' })
  }
  if (!pages.length) {
    return res.status(400).json({ error: 'No pages provided' })
  }

  try {
    res.status(200).json({ text: await extractFromImages(pages, filename) })
  } catch (err) {
    console.error('[extract-document] failed:', err.message)
    res.status(200).json({ text: '', error: err.message })
  }
}
