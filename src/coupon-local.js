const COUPON_DISCOUNTS = Object.freeze({
  kittiphotlnwza67: 10,
  kittiphotandfriend: 20,
})

const originalFetch = typeof window.fetch === 'function'
  ? window.fetch.bind(window)
  : null

function couponResultFromBody(rawBody) {
  if (typeof rawBody !== 'string' || !rawBody) return null

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return null
  }

  if (!payload || payload.action !== 'validateCoupon') return null

  const code = String(payload.couponCode || '').trim().toLowerCase()
  const discount = Number(COUPON_DISCOUNTS[code] || 0)

  if (!discount) {
    return {
      ok: true,
      status: 'success',
      eligible: false,
      couponCode: code,
      discount: 0,
      message: 'ไม่พบคูปองนี้ หรือคูปองไม่ถูกต้อง',
    }
  }

  return {
    ok: true,
    status: 'success',
    eligible: true,
    couponCode: code,
    discount,
    message: `ใช้คูปองสำเร็จ ลด ${discount} บาท`,
  }
}

if (originalFetch) {
  window.fetch = (input, init = {}) => {
    const method = String(init && init.method ? init.method : 'GET').toUpperCase()
    const result = method === 'POST' ? couponResultFromBody(init && init.body) : null

    if (!result) return originalFetch(input, init)

    // App.jsx only needs response.json() for coupon validation. Returning a small,
    // browser-compatible response object avoids WebView Response/Request issues.
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => result,
      text: async () => JSON.stringify(result),
    })
  }
}
