import Tesseract from 'tesseract.js'

const originalRecognize = typeof Tesseract?.recognize === 'function'
  ? Tesseract.recognize.bind(Tesseract)
  : null

function addIntegerBahtCandidates(rawText) {
  const source = String(rawText || '')
  const numericText = source.replace(/[Oo]/g, '0')
  const candidates = new Set()
  const tokens = numericText.match(/\d+/g) || []

  for (const token of tokens) {
    if (token.length < 4 || token.length > 6) continue

    const variants = [token]

    // OCR sometimes reads the border or a nearby mark as one extra digit,
    // for example 79.00 becomes 79001. Try the token again without that noise.
    if (token.length >= 5) variants.push(token.slice(0, -1))

    for (const digits of variants) {
      if (!/^\d{2,4}00$/.test(digits)) continue

      const baht = Number(digits.slice(0, -2))
      if (!Number.isInteger(baht) || baht <= 0 || baht > 9999) continue
      candidates.add(`${baht}.00`)
    }
  }

  if (!candidates.size) return source
  return `${source}\nOCR amount candidates: ${[...candidates].join(' ')}`
}

if (originalRecognize) {
  try {
    Tesseract.recognize = async (...args) => {
      const result = await originalRecognize(...args)
      if (result?.data) {
        result.data.text = addIntegerBahtCandidates(result.data.text)
      }
      return result
    }
  } catch (error) {
    console.warn('Unable to enable Bread Clip OCR amount correction.', error)
  }
}
