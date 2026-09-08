const NativeBlob = window.Blob
const RECEIPT_DAY_KEY = 'breadclip_receipt_delivery_day'
const TIME_ZONE = 'Asia/Bangkok'

function getCurrentDeliveryDay() {
  const savedKey = document.documentElement.dataset.deliveryDay
  if (savedKey === 'thursday') return 'พฤหัสบดี'
  if (savedKey === 'monday') return 'จันทร์'

  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: TIME_ZONE,
  }).format(new Date())

  return ['Mon', 'Tue', 'Wed'].includes(weekday) ? 'พฤหัสบดี' : 'จันทร์'
}

function rememberOrderDeliveryDay() {
  try {
    sessionStorage.setItem(RECEIPT_DAY_KEY, getCurrentDeliveryDay())
  } catch {
    // Receipt generation can still fall back to the current Bangkok delivery round.
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return

  const text = String(button.textContent || '').trim()
  if (text === 'ยืนยันการสั่งซื้อ') rememberOrderDeliveryDay()
}, true)

function getReceiptDeliveryDay() {
  try {
    return sessionStorage.getItem(RECEIPT_DAY_KEY) || getCurrentDeliveryDay()
  } catch {
    return getCurrentDeliveryDay()
  }
}

function BreadClipBlob(parts, options) {
  let nextParts = parts

  try {
    const type = String(options?.type || '').toLowerCase()
    const html = Array.isArray(parts) && parts.length === 1 && typeof parts[0] === 'string'
      ? parts[0]
      : null

    if (html && type.includes('text/html') && html.includes('<title>ใบเสร็จ Bread Clip</title>')) {
      const deliveryDay = getReceiptDeliveryDay()
      nextParts = [html.replace(
        'ชำระเงินแล้ว — รอรับขนมวันจันทร์',
        `ชำระเงินแล้ว — รอรับขนมวัน${deliveryDay}`,
      )]
    }
  } catch (error) {
    console.warn('Unable to update Bread Clip receipt delivery day.', error)
  }

  return new NativeBlob(nextParts, options)
}

BreadClipBlob.prototype = NativeBlob.prototype
Object.setPrototypeOf(BreadClipBlob, NativeBlob)
window.Blob = BreadClipBlob
