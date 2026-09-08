const TARGET_COUPON = 'kittiphotlnwza67'
const MINIMUM_SUBTOTAL = 50

function normalizeCouponCode(value) {
  return String(value || '').trim().toLowerCase()
}

function readNumber(value) {
  const match = String(value || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : 0
}

function calculateProductSubtotal() {
  return [...document.querySelectorAll('.product')].reduce((sum, product) => {
    const price = readNumber(product.querySelector('small')?.textContent)
    const quantity = readNumber(product.querySelector('.stepper span')?.textContent)
    return sum + (price * quantity)
  }, 0)
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button || button.type !== 'button' || button.textContent.trim() !== 'ใช้คูปอง') return

  const card = button.closest('.card')
  const couponInput = card?.querySelector('input')
  const code = normalizeCouponCode(couponInput?.value)

  if (code !== TARGET_COUPON) return
  if (calculateProductSubtotal() >= MINIMUM_SUBTOTAL) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  window.alert(`คูปอง ${TARGET_COUPON} ใช้ได้เมื่อยอดขนมครบ ${MINIMUM_SUBTOTAL} บาทขึ้นไป`)
}, true)
