const RETRY_DELAY = 1500

export async function fetchWithRetry(url, options, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options)
    } catch (err) {
      if (attempt < retries && err instanceof TypeError) {
        await new Promise(r => setTimeout(r, RETRY_DELAY))
        continue
      }
      throw err
    }
  }
}
