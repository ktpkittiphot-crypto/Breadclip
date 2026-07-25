const COUPON_RULES = {
  kittiphotlnwza67: { discount: 10, cooldownHours: 24 },
  kittiphotandfriend: { discount: 20, cooldownHours: 144 },
}

const nativeFetch = window.fetch.bind(window)

window.fetch = async (input, init = {}) => {
  try {
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const rawBody = typeof init?.body === 'string' ? init.body : ''

    if (method === 'POST' && rawBody) {
      const payload = JSON.parse(rawBody)

      // Validate the coupon code safely in the browser. The Apps Script backend
      // still checks the 24/144-hour cooldown again when the order is submitted.
      if (payload?.action === 'validateCoupon') {
        const code = String(payload.couponCode || '').trim().toLowerCase()
        const rule = COUPON_RULES[code]

        const result = rule
          ? {
              ok: true,
              status: 'success',
              eligible: true,
              couponCode: code,
              discount: rule.discount,
              cooldownHours: rule.cooldownHours,
              message: `ใช้คูปองสำเร็จ ลด ${rule.discount} บาท`,
            }
          : {
              ok: true,
              status: 'success',
              eligible: false,
              couponCode: code,
              discount: 0,
              message: 'ไม่พบคูปองนี้ หรือคูปองไม่ถูกต้อง',
            }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json;charset=utf-8' },
        })
      }
    }
  } catch (error) {
    console.warn('Coupon validation fallback skipped.', error)
  }

  return nativeFetch(input, init)
}
